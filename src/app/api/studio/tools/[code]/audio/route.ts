import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TOOL_MAP } from "@/lib/tvc/registry";
import { takeAiQuota } from "@/lib/ai-quota";
import { pseudonymizeNames } from "@/lib/ai-privacy";
import { schoolPiiNames } from "@/lib/ai-pii-roster";
import { hasFeature } from "@/lib/permissions";
import { hasAnyRole } from "@/lib/roles";
import type { DocContent } from "@/types/tvc";
import type { Role } from "@/types";

const TOOL_ROLES: Role[] = ["gvcn", "gvbm", "to_truong", "bgh", "admin"];

// CR-056: TTS tach khoi generate - route nay co budget RIENG (~100s) chi
// cho audio, nen audio gan nhu luon thanh cong thay vi bi skip khi
// generate da an het 115s. Client merge audio blocks vao doc sau.
export const maxDuration = 120;
const TTS_BUDGET_MS = 100_000;

// CR-052: khong doc TTS dong dap an - de click-reveal trong PPT.
const ANSWER_SKIP = /(đáp\s*án|answer|trả\s*lời|key)\s*[::]/i;

interface AudioInsert {
  section: number;
  block: { kind: "audio"; path: string; caption?: string };
}

// Bo text TTS theo tool - tra inserts theo section index de client merge.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const tool = TOOL_MAP.get(code);
  if (!tool) {
    return NextResponse.json({ error: "Công cụ không tồn tại." }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId)
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, role, school_id, concurrent_roles")
    .eq("id", userId)
    .single();
  if (profErr && profErr.code !== "PGRST116") {
    console.error("[studio/audio] profile:", profErr.message);
    return NextResponse.json(
      { error: "Không tải được dữ liệu nguồn." },
      { status: 500 },
    );
  }
  if (!profile || !hasAnyRole(profile, TOOL_ROLES)) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }
  if (!(await hasFeature("studio.ai")) || !(await hasFeature("studio"))) {
    return NextResponse.json({ error: "Tính năng đã bị quản trị tắt." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    doc?: DocContent;
    input?: Record<string, unknown>;
  };
  const doc = body.doc;
  if (!doc?.sections?.length) {
    return NextResponse.json({ inserts: [] });
  }
  const input: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.input ?? {})) {
    if (typeof v === "string") input[k] = v.slice(0, 4000);
    else if (typeof v === "number" || typeof v === "boolean")
      input[k] = String(v);
  }

  // Quota TTS cung chinh sach AI - tranh spam goi provider tra phi.
  const quotaOk = await takeAiQuota(`tvc-tts:${code}`, userId);
  if (!quotaOk) return NextResponse.json({ inserts: [] });

  const sid = (profile as { school_id?: string | null }).school_id ?? null;
  // r30 H + r10 H6: doc client gui lai da DEANON (ten HS/GV that) - phai
  // alias lai truoc khi dua cho TTS provider ngoai. Roster khong chung
  // minh duoc day du -> fail-closed, tra doc khong audio.
  const roster = await schoolPiiNames(sid ?? "");
  if (roster.error) return NextResponse.json({ inserts: [] });
  const mask = (t: string) => pseudonymizeNames(t, roster.names);

  const { synthesizeSpeech, synthesizeDialogue, extractDialogueTurns, uploadTtsAudio } =
    await import("@/lib/tvc/tts");
  const inserts: AudioInsert[] = [];

  try {
    if (code === "DC-06" && input.audio === "yes") {
      // Narration per-section: chi doc doan Tieng Anh, bo dap an.
      const englishLine = /[a-zA-Z]{4,}/;
      let budget = TTS_BUDGET_MS;
      const deadline = Date.now() + budget;
      for (let i = 0; i < doc.sections.length; i++) {
        budget = deadline - Date.now();
        if (budget < 15_000) break;
        const sec = doc.sections[i];
        const text = (sec.blocks ?? [])
          .flatMap((b) =>
            b.kind === "list"
              ? (b.items ?? [])
              : "text" in b && typeof b.text === "string"
                ? [b.text]
                : [],
          )
          .filter((t) => englishLine.test(t) && !ANSWER_SKIP.test(t))
          .slice(0, 3)
          .join(" ");
        if (text.trim().length < 12) continue;
        const audio = await synthesizeSpeech(mask(text.trim().slice(0, 800)), budget - 8_000);
        if (!audio) break;
        const p = await uploadTtsAudio(sid, audio);
        if (p) inserts.push({ section: i, block: { kind: "audio", path: p, caption: "Nghe mẫu đọc" } });
      }
    } else if (code === "A-03") {
      const turns = extractDialogueTurns(doc);
      if (turns.length >= 2) {
        const maskedTurns = turns.map((t) => ({
          speaker: mask(t.speaker),
          line: mask(t.line),
        }));
        const audio = await synthesizeDialogue(maskedTurns, TTS_BUDGET_MS - 10_000);
        if (audio) {
          const p = await uploadTtsAudio(sid, audio);
          if (p) {
            const secIdx = doc.sections.findIndex((s) =>
              extractDialogueTurns({ sections: [s] }).length >= 2,
            );
            inserts.push({
              section: secIdx >= 0 ? secIdx : 0,
              block: { kind: "audio", path: p, caption: `Audio hội thoại - ${turns.length} lượt` },
            });
          }
        }
      }
    } else {
      // Narration 1 giong: A-01 bai doc, A-02 tu vung, V-02 van ban tieng Viet.
      const plan: { text: string; voice?: string; lang?: "en" | "vi"; caption: string } | null =
        code === "A-01"
          ? (() => {
              const sec = [...doc.sections].sort(
                (a, b) =>
                  (b.blocks ?? []).filter((x) => x.kind === "para")
                    .map((x) => x.text?.length ?? 0).reduce((s, n) => s + n, 0) -
                  (a.blocks ?? []).filter((x) => x.kind === "para")
                    .map((x) => x.text?.length ?? 0).reduce((s, n) => s + n, 0),
              )[0];
              const text = (sec?.blocks ?? [])
                .filter((b) => b.kind === "para")
                .map((b) => b.text ?? "")
                .join(" ")
                .trim();
              return text.length >= 40
                ? { text, caption: "Audio bài đọc - nghe và đọc theo" }
                : null;
            })()
          : code === "A-02"
            ? (() => {
                const words = String(input.words ?? "")
                  .split(/\r?\n/).map((w) => w.trim()).filter(Boolean).slice(0, 24);
                return words.length
                  ? {
                      text: words.map((w) => `${w}.`).join(" "),
                      caption: `Audio từ vựng - ${words.length} từ, nghe và lặp lại`,
                    }
                  : null;
              })()
            : code === "V-02"
              ? (() => {
                  const text = String(input.text ?? "").trim();
                  return text.length >= 40
                    ? {
                        text,
                        voice: process.env.TTS_VOICE_VI ?? "nova",
                        lang: "vi" as const,
                        caption: "Audio văn bản - giọng đọc tiếng Việt",
                      }
                    : null;
                })()
              : null;
      if (plan) {
        const audio = await synthesizeSpeech(
          mask(plan.text),
          TTS_BUDGET_MS - 10_000,
          plan.voice,
          plan.lang,
        );
        if (audio) {
          const p = await uploadTtsAudio(sid, audio);
          if (p) inserts.push({ section: 0, block: { kind: "audio", path: p, caption: plan.caption } });
        }
      }
    }
  } catch (e) {
    console.error("[studio/audio] skipped:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ inserts });
}
