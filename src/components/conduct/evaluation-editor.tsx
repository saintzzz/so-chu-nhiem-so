"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { downloadXlsxTemplate, parseSpreadsheet } from "@/lib/excel";

export interface EvalStudent {
  id: string;
  code: string;
  full_name: string;
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
  students,
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
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const RATING_LABEL = Object.fromEntries(RATINGS.map((r) => [r.value, r.label]));
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
    void downloadXlsxTemplate(
      "mau-danh-gia-hanh-kiem.xlsx",
      ["Mã HS", "Họ và tên", "Xếp loại", "Nhận xét"],
      students.map((s) => [
        s.code,
        s.full_name,
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
    let matched = 0;
    const missed: string[] = [];
    setDraft((prev) => {
      const next = { ...prev };
      for (const r of table) {
        const code = (r[0] ?? "").trim().toLowerCase();
        if (!code || code.includes("mã")) continue;
        const id = byCode.get(code);
        if (!id) {
          missed.push(r[0]);
          continue;
        }
        matched += 1;
        const rating = LABEL_TO_RATING[(r[2] ?? "").trim().toLowerCase()];
        next[id] = {
          rating: rating ?? next[id]?.rating ?? "tot",
          comment: (r[3] ?? "").trim(),
        };
      }
      return next;
    });
    setSaved(false);
    setImportMsg(
      `Đã điền ${matched} học sinh từ file${missed.length ? ` - không khớp mã: ${missed.slice(0, 5).join(", ")}${missed.length > 5 ? "…" : ""}` : ""}. Kiểm tra rồi bấm Lưu đánh giá.`,
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
        comments: Record<string, string> | null;
      };
      if (!json.comments) {
        setError("AI chưa sẵn sàng (chưa cấu hình API key).");
        return;
      }
      setDraft((prev) => {
        const next = { ...prev };
        for (const s of list) {
          const c = json.comments?.[s.code];
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
    } catch {
      setError("Không gọi được dịch vụ AI.");
    } finally {
      setAiBusy(null);
    }
  }

  return (
    <DataTable
      columns={["Mã HS", "Họ và tên", "Xếp loại", "Nhận xét"]}
      footer={
        <>
          <span>{students.length} học sinh</span>
          <span className="flex flex-wrap items-center gap-3">
            {saved && <span className="text-success">Đã lưu đánh giá.</span>}
            {error && <span className="text-error">{error}</span>}
            {importMsg && <span className="text-primary">{importMsg}</span>}
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
        </>
      }
    >
      {students.map((s) => {
        const d = draft[s.id] ?? { rating: "tot", comment: "" };
        return (
          <tr key={s.id}>
            <td className="font-mono text-xs text-muted-foreground">{s.code}</td>
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
                <input
                  value={d.comment}
                  onChange={(e) => patch(s.id, { comment: e.target.value })}
                  placeholder="Nhận xét…"
                  className="h-8 w-full min-w-48 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring"
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
  );
}
