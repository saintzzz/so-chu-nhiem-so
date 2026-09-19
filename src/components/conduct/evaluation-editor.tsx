"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAiJob } from "@/hooks/use-ai-job";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { downloadXlsxTemplate, parseSpreadsheet } from "@/lib/excel";
import { sortByVietnameseName } from "@/lib/utils";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

export interface EvalStudent {
  id: string;
  code: string;
  national_id: string | null;
  full_name: string;
  dob: string | null;
}

export interface ExistingEval {
  id: string;
  student_id: string;
  rating: string;
  comment: string | null;
}

export const RATINGS = [
  { value: "tot", label: "Tốt" },
  { value: "kha", label: "Khá" },
  { value: "dat", label: "Đạt" },
  { value: "chua_dat", label: "Chưa đạt" },
];

/** Editable hạnh kiểm table - one row per student, upsert on save. */
export function ConductEvaluationEditor({
  students: rawStudents,
  evaluations,
  term,
  meId,
  classId,
}: {
  students: EvalStudent[];
  evaluations: ExistingEval[];
  term: string;
  meId: string;
  classId: string;
}) {
  const students = sortByVietnameseName(rawStudents, (s) => s.full_name);
  const router = useRouter();
  const [draft, setDraft] = useState<
    Record<string, { rating: string; comment: string }>
  >(() =>
    Object.fromEntries(
      students.map((s) => {
        const ev = evaluations.find((e) => e.student_id === s.id);
        return [
          s.id,
          { rating: ev?.rating ?? "tot", comment: ev?.comment ?? "" },
        ];
      }),
    ),
  );
  const [pending, startTransition] = useTransition();
  const [aiBusy, setAiBusy] = useState<string | "all" | null>(null);
  const aiJob = useAiJob();

  function applyComments(
    comments: Record<string, string>,
    list: EvalStudent[],
  ) {
    setDraft((prev) => {
      const next = { ...prev };
      for (const s of list) {
        const c = comments[s.code];
        if (c) {
          next[s.id] = {
            ...(next[s.id] ?? { rating: "tot", comment: "" }),
            comment: c,
          };
        }
      }
      return next;
    });
    setSaved(false);
  }

  // Kết quả Devin (fallback khi LLM hết quota) về sau qua ai_jobs
  useEffect(() => {
    if (!aiJob.done || !aiJob.result) return;
    const obj = aiJob.result as Record<string, unknown>;
    const comments: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && v.trim()) comments[k] = v.trim();
    }
    applyComments(comments, students);
    aiJob.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiJob.done, aiJob.result]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const RATING_LABEL = Object.fromEntries(RATINGS.map((r) => [r.value, r.label]));

  function normName(s: string): string {
    return s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/\s+/g, " ");
  }
  const LABEL_TO_RATING: Record<string, string> = {
    tốt: "tot",
    tot: "tot",
    khá: "kha",
    kha: "kha",
    đạt: "dat",
    dat: "dat",
    "chưa đạt": "chua_dat",
    chua_dat: "chua_dat",
  };

  function downloadTemplate() {
    // Mẫu rèn luyện CSDL ngành: STT | Mã định danh | Họ tên | Ngày sinh | Kết quả rèn luyện | Nhận xét
    void downloadXlsxTemplate(
      `mau-ren-luyen-${term}.xlsx`,
      [
        "STT",
        "Mã định danh Bộ GD&ĐT",
        "Họ và tên",
        "Ngày sinh",
        "Kết quả rèn luyện",
        "Nhận xét",
      ],
      students.map((s, i) => [
        String(i + 1),
        s.national_id ?? s.code,
        s.full_name,
        s.dob ?? "",
        RATING_LABEL[draft[s.id]?.rating ?? "tot"],
        draft[s.id]?.comment ?? "",
      ]),
    );
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    setImportMsg(null);
    setError(null);
    let table: string[][];
    try {
      table = await parseSpreadsheet(file);
    } catch {
      setImportMsg("Không đọc được file. Dùng file .xlsx hoặc .csv.");
      return;
    }
    const byCode = new Map(students.map((s) => [s.code.toLowerCase(), s.id]));
    const byNid = new Map(
      students
        .filter((s) => s.national_id)
        .map((s) => [s.national_id!.toLowerCase(), s.id]),
    );
    const byNameDob = new Map(
      students.map((s) => [
        `${normName(s.full_name)}|${s.dob ?? ""}`,
        s.id,
      ]),
    );
    // Dò cột theo header: mã định danh / mã hs / họ tên / ngày sinh / kết quả / nhận xét
    const headerIdx = table.findIndex((r) =>
      r.some((c) => {
        const k = normName(c);
        return (
          k.includes("ma dinh danh") ||
          k === "ma hs" ||
          k.includes("ket qua") ||
          k === "xep loai"
        );
      }),
    );
    const header = headerIdx >= 0 ? table[headerIdx] : null;
    let keyCol = 0;
    let nameCol = -1;
    let dobCol = -1;
    let ratingCol = 2;
    let commentCol = 3;
    if (header) {
      ratingCol = -1;
      commentCol = -1;
      header.forEach((h, i) => {
        const k = normName(h);
        if (k.includes("ma dinh danh") || k === "ma hs" || k === "mahs") keyCol = i;
        else if (k.includes("ho va ten") || k === "ho ten") nameCol = i;
        else if (k === "ngay sinh") dobCol = i;
        else if (k.includes("ket qua") || k === "xep loai") ratingCol = i;
        else if (k.includes("nhan xet")) commentCol = i;
      });
      if (ratingCol === -1) ratingCol = 4;
    }
    const dataRows = table.slice(headerIdx >= 0 ? headerIdx + 1 : 0);
    let matched = 0;
    const missed: string[] = [];
    setDraft((prev) => {
      const next = { ...prev };
      for (const r of dataRows) {
        if (r.every((c) => !c.trim())) continue;
        const key = (r[keyCol] ?? "").trim().toLowerCase();
        let id: string | undefined =
          byNid.get(key) ?? (key && !key.includes("mã") ? byCode.get(key) : undefined);
        if (!id && nameCol >= 0) {
          id = byNameDob.get(
            `${normName(r[nameCol] ?? "")}|${(dobCol >= 0 ? r[dobCol] : "") ?? ""}`,
          );
        }
        if (!id) {
          missed.push(r[keyCol] ?? r[nameCol] ?? "");
          continue;
        }
        matched += 1;
        const rating = LABEL_TO_RATING[(r[ratingCol] ?? "").trim().toLowerCase()];
        next[id] = {
          rating: rating ?? next[id]?.rating ?? "tot",
          comment:
            commentCol >= 0
              ? (r[commentCol] ?? "").trim()
              : (next[id]?.comment ?? ""),
        };
      }
      return next;
    });
    setSaved(false);
    setImportMsg(
      `Đã điền ${matched} học sinh từ file${missed.length ? ` - không khớp: ${missed.slice(0, 5).join(", ")}${missed.length > 5 ? "…" : ""}` : ""}. Kiểm tra rồi bấm Lưu đánh giá.`,
    );
    if (fileRef.current) fileRef.current.value = "";
  }

  function patch(id: string, part: { rating?: string; comment?: string }) {
    setSaved(false);
    setDraft((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { rating: "tot", comment: "" }), ...part },
    }));
  }

  function save() {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const rows = students.map((s) => {
        const ev = evaluations.find((e) => e.student_id === s.id);
        const d = draft[s.id] ?? { rating: "tot", comment: "" };
        return {
          id: ev?.id ?? crypto.randomUUID(),
          student_id: s.id,
          term,
          rating: d.rating,
          comment: d.comment.trim() || null,
          evaluated_by: meId,
        };
      });
      const { error: err } = await supabase
        .from("conduct_evaluations")
        .upsert(rows);
      if (err) {
        setError(err.message);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  async function aiSuggest(target: EvalStudent | "all") {
    const list =
      target === "all"
        ? students.filter((s) => !(draft[s.id]?.comment ?? "").trim())
        : [target];
    if (list.length === 0) {
      setError("Tất cả ô nhận xét đã có nội dung.");
      return;
    }
    setAiBusy(target === "all" ? "all" : target.id);
    setError(null);
    try {
      const res = await fetch("/api/ai/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          term,
          students: list.map((s) => ({
            code: s.code,
            name: s.full_name,
            rating: draft[s.id]?.rating ?? "tot",
          })),
        }),
      });
      const json = (await res.json()) as {
        comments?: Record<string, string> | null;
        pending?: boolean;
        jobId?: string;
        devinUrl?: string;
      };
      if (json.pending && json.jobId && json.devinUrl) {
        aiJob.start(json.jobId, json.devinUrl);
        return;
      }
      if (!json.comments) {
        setError("AI chưa sẵn sàng (chưa cấu hình API key).");
        return;
      }
      applyComments(json.comments, list);
      setSaved(false);
    } catch {
      setError("Không gọi được dịch vụ AI.");
    } finally {
      setAiBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div data-slot="toolbar" className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {students.length} học sinh
        </span>
        <span className="flex flex-wrap items-center gap-3">
          {saved && <span className="text-sm text-success">Đã lưu đánh giá.</span>}
          {error && <span className="text-sm text-error">{error}</span>}
          {importMsg && (
            <span className="text-sm text-primary">{importMsg}</span>
          )}
          {aiJob.job && (
            <span className="text-sm text-muted-foreground">
              LLM hết hạn mức - Devin đang xử lý{" "}
              <a
                href={aiJob.job.devinUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                (mở session)
              </a>
              , nhận xét sẽ tự điền khi xong.
            </span>
          )}
          {aiJob.failed && (
            <span className="text-sm text-error">Tác vụ Devin thất bại.</span>
          )}
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            Tải template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            Import Excel
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => void onImport(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={aiBusy !== null}
            onClick={() => aiSuggest("all")}
          >
            <Sparkles />
            {aiBusy === "all" ? "AI đang viết..." : "AI gợi ý nhận xét"}
          </Button>
          <Button onClick={save} disabled={pending} size="sm">
            {pending ? "Đang lưu…" : "Lưu đánh giá"}
          </Button>
        </span>
      </div>
      <DataTable
        columns={["Mã định danh", "Họ và tên", "Xếp loại", "Nhận xét"]}
        footer={<span>{students.length} học sinh</span>}
      >
      {students.map((s) => {
        const d = draft[s.id] ?? { rating: "tot", comment: "" };
        return (
          <tr key={s.id}>
            <td className="font-mono text-xs text-muted-foreground">
              {s.national_id ?? s.code}
            </td>
            <td className="font-medium">{s.full_name}</td>
            <td>
              <select
                value={d.rating}
                onChange={(e) => patch(s.id, { rating: e.target.value })}
                className="h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring"
              >
                {RATINGS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </td>
            <td>
              <span className="flex items-center gap-1.5">
                <AutoGrowTextarea
                  value={d.comment}
                  onChange={(e) => patch(s.id, { comment: e.target.value })}
                  placeholder="Nhận xét…"
                  className="min-w-48"
                />
                <button
                  type="button"
                  title="AI gợi ý nhận xét cho em này"
                  disabled={aiBusy !== null}
                  onClick={() => aiSuggest(s)}
                  className="shrink-0 rounded-md p-1.5 text-primary hover:bg-primary-bg disabled:opacity-40"
                >
                  <Sparkles className="size-4" />
                </button>
              </span>
            </td>
          </tr>
        );
      })}
      </DataTable>
    </div>
  );
}
