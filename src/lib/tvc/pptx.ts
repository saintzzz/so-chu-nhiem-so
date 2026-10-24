import PptxGenJS from "pptxgenjs";
import type { DocContent, DocBlock } from "@/types/tvc";
import { injectInteractions, type SlideJob } from "./pptx-anim.ts";

// CR-052: dong bat dau bang "Đáp án"/"Answer"/"ĐA:" la dap an - khi doc
// .interactive, tach ra shape rieng an, hien khi click vao cau hoi.
const ANSWER_LINE = /^\s*(đáp\s*án|answer|đa|trả\s*lời)\s*[::]/i;
// QA r30: AI co the nhung "Đáp án:" giua mot dong dai - cat tai marker de
// phan duoi van bat duoc boi ANSWER_LINE khi interactive. "trả lời" bi loai
// khoi inline vi "HS trả lời:" la van thuong, khong phai truong dap an.
const ANSWER_INLINE = /(đáp\s*án|answer|đa)\s*[::]/i;
// Phan duoi sau dap an thuong di kem ghi chu to chuc ("Thời gian: 8 phút") -
// cat bo khi dua len slide.
const NOTE_TAIL_CUT = /\s*[-.]?\s*(thời\s*gian|ghi\s*chú|lưu\s*ý|tổ\s*chức)\s*[::].*$/i;

// Chuyen DocContent -> .pptx: moi section = 1 slide.
// Font Arial de dam bao Unicode tieng Viet trong PowerPoint.
const FONT = "Arial";

// CR-018 P3: slide themes - doc.theme chon palette. navy = giu nguyen cu.
const THEMES: Record<
  string,
  { cover: string; coverSub: string; coverAuthor: string; title: string; accent: string; body: string }
> = {
  navy: { cover: "1F3B73", coverSub: "D6E4FF", coverAuthor: "B8C9E8", title: "1F3B73", accent: "2F5BA8", body: "222222" },
  emerald: { cover: "14532D", coverSub: "D1FAE5", coverAuthor: "A7F3D0", title: "14532D", accent: "16A34A", body: "1F2937" },
  plum: { cover: "581C87", coverSub: "E9D5FF", coverAuthor: "D8B4FE", title: "581C87", accent: "9333EA", body: "1F2937" },
  light: { cover: "F8FAFC", coverSub: "475569", coverAuthor: "64748B", title: "0F172A", accent: "2563EB", body: "1F2937" },
};

export const PPTX_THEMES = Object.keys(THEMES);

function blockToLines(b: DocBlock): { text: string; bullet: boolean }[] {
  switch (b.kind) {
    case "heading":
      return [{ text: b.text, bullet: false }];
    case "para":
      return [{ text: b.text, bullet: false }];
    case "list":
      return b.items.map((t) => ({ text: t, bullet: true }));
    case "kv":
      return b.pairs.map(([k, v]) => ({ text: `${k}: ${v}`, bullet: true }));
    case "table":
      return [
        { text: b.header.join(" | "), bullet: false },
        ...b.rows.map((r) => ({ text: r.join(" | "), bullet: true })),
      ];
    case "formula":
      return [{ text: b.tex, bullet: false }];
    case "note":
      return [{ text: b.text, bullet: false }];
    case "divider":
      return [];
    case "image":
      return [];
    case "audio":
      // CR-018 P1: audio nhung bang addMedia - dong caption chi la nhan.
      return b.caption ? [{ text: `Audio: ${b.caption}`, bullet: false }] : [];
  }
}

// CR-031: media -> PNG base64 cho pptx.addImage
async function imageToPng64(
  b: { svg?: string; path?: string },
): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    if (b.svg) {
      const buf = await sharp(Buffer.from(b.svg), { density: 150 })
        .resize({ width: 480, withoutEnlargement: true })
        .png()
        .toBuffer();
      return `image/png;base64,${buf.toString("base64")}`;
    }
    if (b.path) {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tvc-media/${b.path}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!r.ok) return null;
      const buf = await sharp(Buffer.from(await r.arrayBuffer()))
        .resize({ width: 480, withoutEnlargement: true })
        .png()
        .toBuffer();
      return `image/png;base64,${buf.toString("base64")}`;
    }
  } catch {
    return null;
  }
  return null;
}

// CR-018 P1: tai mp3 tu bucket public -> base64 de addMedia nhung vao slide.
// Gioi han 15MB/file, 15s timeout + tong ngan sach media 120MB/deck (AC-52.4:
// deck phai duoi 150MB, chua cho XML/anh).
const AUDIO_MAX_BYTES = 15 * 1024 * 1024;
const MEDIA_BUDGET = 120 * 1024 * 1024;
// budget dem theo tung lan docToPptx - khong de module-level vi request
// concurrent se dung chung bo dem.
async function audioToB64(
  path: string,
  budget: { used: number },
): Promise<string | null> {
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tvc-media/${path}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok || !r.body) return null;
    const len = Number(r.headers.get("content-length") ?? 0);
    if (len > AUDIO_MAX_BYTES || budget.used + len > MEDIA_BUDGET) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || buf.length > AUDIO_MAX_BYTES) return null;
    if (budget.used + buf.length > MEDIA_BUDGET) return null;
    budget.used += buf.length;
    // Gemini TTS luu .wav (PCM + header), openai/edge luu .mp3.
    const mime = path.endsWith(".wav") ? "audio/wav" : "audio/mpeg";
    return `${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function docToPptx(
  doc: DocContent,
  author: string,
  opts: { interactive?: boolean } = {},
): Promise<Buffer> {
  const interactive = opts.interactive ?? doc.interactive === true;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 10, height: 5.625 });
  pptx.layout = "WIDE";
  pptx.title = doc.title;
  pptx.author = author;
  const th = THEMES[doc.theme ?? ""] ?? THEMES.navy;
  const lightCover = (doc.theme ?? "") === "light";
  const slideJobs: SlideJob[] = [];
  const mediaBudget = { used: 0 };

  // Slide bia
  const cover = pptx.addSlide();
  cover.background = { color: th.cover };
  cover.addText(doc.title, {
    x: 0.6, y: 1.6, w: 8.8, h: 1.4,
    fontFace: FONT, fontSize: 30, bold: true,
    color: lightCover ? "0F172A" : "FFFFFF", align: "center",
  });
  const metaLine = (doc.meta ?? [])
    .map(([k, v]) => `${k}: ${v}`)
    .join("   ·   ");
  if (metaLine) {
    cover.addText(metaLine, {
      x: 0.6, y: 3.2, w: 8.8, h: 0.5,
      fontFace: FONT, fontSize: 14, color: th.coverSub, align: "center",
    });
  }
  cover.addText(author, {
    x: 0.6, y: 4.7, w: 8.8, h: 0.4,
    fontFace: FONT, fontSize: 12, color: th.coverAuthor, align: "center",
  });

  let slideNo = 1;
  for (const sec of doc.sections ?? []) {
    const s = pptx.addSlide();
    slideNo++;
    // CR-018 P3: thanh accent duoi title + so slide o footer.
    s.addText(sec.title, {
      x: 0.5, y: 0.25, w: 9, h: 0.7,
      fontFace: FONT, fontSize: 22, bold: true, color: th.title,
    });
    s.addShape("rect", { x: 0.5, y: 0.98, w: 1.4, h: 0.06, fill: { color: th.accent } });
    s.addText(`${slideNo}`, {
      x: 9.3, y: 5.15, w: 0.5, h: 0.3,
      fontFace: FONT, fontSize: 10, color: "94A3B8", align: "right",
    });
    // CR-042: note blocks = loi thuyet trinh cua GV -> speaker notes,
    // khong hien thi tren slide chieu cho HS.
    const notes = (sec.blocks ?? [])
      .filter((b) => b.kind === "note")
      .map((b) => b.text);
    const allLines = (sec.blocks ?? [])
      .filter((b) => b.kind !== "note" && b.kind !== "audio")
      .flatMap(blockToLines)
      .flatMap((l) => {
        if (!interactive) return [l];
        const m = l.text.match(ANSWER_INLINE);
        if (!m || m.index === undefined || m.index === 0) return [l];
        return [
          { ...l, text: l.text.slice(0, m.index).trim() },
          { ...l, text: l.text.slice(m.index).trim() },
        ];
      })
      .filter((l) => l.text.trim());
    // CR-052: interactive -> dong "Dap an:" tach thanh shape an ben duoi,
    // reveal khi click vao vung cau hoi (scn:q -> scn:ans interactiveSeq).
    // QA r30: prompt cu dua dap an vao note block (speaker notes) - khi
    // interactive van trich dap an tu notes len slide cho co che reveal.
    const noteAnswers = interactive
      ? notes.flatMap((t) =>
          (t ?? "").split(/\n+/).flatMap((line) => {
            const m = line.match(ANSWER_INLINE);
            if (!m || m.index === undefined) return [];
            const full = line.slice(m.index).trim();
            // r30 M: chi cat duoi ghi chu ("Thời gian:"...) khi no xuat hien
            // sau noi dung dap an thuc - "Đáp án: Thời gian: 8 giờ" la dap
            // an hop le, khong duoc cat thanh "Đáp án:".
            const cut = full.search(NOTE_TAIL_CUT);
            const tail = (cut > 12 ? full.slice(0, cut) : full).trim();
            return tail ? [{ text: tail, bullet: false }] : [];
          }),
        )
      : [];
    const answerLines = [
      ...(interactive ? allLines.filter((l) => ANSWER_LINE.test(l.text)) : []),
      ...noteAnswers,
    ];
    const lines = (interactive
      ? allLines.filter((l) => !ANSWER_LINE.test(l.text))
      : allLines
    ).slice(0, 9);
    if (notes.length) s.addNotes(notes.join("\n\n"));
    const hasReveal = interactive && answerLines.length > 0;
    s.addText(
      lines.map((l) => ({
        text: l.text,
        options: { bullet: l.bullet ? { code: "2022" } : undefined },
      })),
      {
        x: 0.7, y: 1.1, w: 8.6, h: 3.6,
        fontFace: FONT, fontSize: 16, color: th.body,
        valign: "top", lineSpacingMultiple: 1.25,
        ...(hasReveal ? { objectName: `scn:q:${slideNo}` } : {}),
      },
    );
    if (hasReveal) {
      s.addText(
        answerLines.slice(0, 4).map((l) => ({
          text: l.text,
          options: { bullet: false },
        })),
        {
          x: 0.7, y: 4.15, w: 8.6, h: 1.0,
          fontFace: FONT, fontSize: 15, bold: true, color: "15803D",
          valign: "top", lineSpacingMultiple: 1.2,
          objectName: `scn:ans:${slideNo}`,
        },
      );
      slideJobs.push({
        slideNo,
        reveals: [{ trigger: `scn:q:${slideNo}`, target: `scn:ans:${slideNo}` }],
      });
    }
    // CR-031: image blocks trong slide
    const imgBlocks = (sec.blocks ?? []).filter((b) => b.kind === "image");
    for (let i = 0; i < Math.min(imgBlocks.length, 2); i++) {
      const b64 = await imageToPng64(imgBlocks[i]);
      if (b64)
        s.addImage({
          data: b64,
          x: 6.4 + i * 1.6, y: 1.4, w: 2.8, h: 2.1,
          sizing: { type: "contain", w: 2.8, h: 2.1 },
        });
    }
    // CR-018 P1: audio blocks nhung that vao slide (mo trong PowerPoint
    // -> bieu tuong loa, click phat truc tiep). Fetch lo -> caption van in.
    const audioBlocks = (sec.blocks ?? []).filter((b) => b.kind === "audio");
    for (let i = 0; i < Math.min(audioBlocks.length, 2); i++) {
      const ab = audioBlocks[i] as { path?: string; caption?: string };
      const b64 = ab.path ? await audioToB64(ab.path, mediaBudget) : null;
      if (b64) {
        s.addMedia({
          type: "audio",
          data: b64,
          x: 0.5, y: 4.85, w: 0.5, h: 0.5,
        });
      }
      s.addText(`Audio${i + 1}: ${ab.caption ?? "nghe tai lieu"}`, {
        x: 1.1, y: 4.95, w: 8, h: 0.3,
        fontFace: FONT, fontSize: 11, italic: true, color: th.accent,
      });
    }
  }

  for (const ap of doc.appendix ?? []) {
    const s = pptx.addSlide();
    slideNo++;
    s.addText(ap.title, {
      x: 0.5, y: 0.25, w: 9, h: 0.7,
      fontFace: FONT, fontSize: 20, bold: true, color: "5B6577",
    });
    s.addShape("rect", { x: 0.5, y: 0.98, w: 1.4, h: 0.06, fill: { color: th.accent } });
    s.addText(`${slideNo}`, {
      x: 9.3, y: 5.15, w: 0.5, h: 0.3,
      fontFace: FONT, fontSize: 10, color: "94A3B8", align: "right",
    });
    const notes = (ap.blocks ?? [])
      .filter((b) => b.kind === "note")
      .map((b) => b.text);
    const lines = (ap.blocks ?? [])
      .filter((b) => b.kind !== "note")
      .flatMap(blockToLines)
      .filter((l) => l.text.trim())
      .slice(0, 9);
    if (notes.length) s.addNotes(notes.join("\n\n"));
    s.addText(
      lines.map((l) => ({
        text: l.text,
        options: { bullet: l.bullet ? { code: "2022" } : undefined },
      })),
      {
        x: 0.7, y: 1.1, w: 8.6, h: 4.1,
        fontFace: FONT, fontSize: 15, color: "333333",
        valign: "top", lineSpacingMultiple: 1.2,
      },
    );
  }

  const buf = await pptx.write({ outputType: "nodebuffer" });
  const raw = Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
  // CR-052: patch XML - fade transition moi slide + interactiveSeq reveal.
  if (interactive && raw.length) {
    return injectInteractions(raw, slideJobs);
  }
  return raw;
}
