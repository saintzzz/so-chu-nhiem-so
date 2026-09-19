"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { semesterAverage } from "@/lib/tt22";
import { downloadXlsxTemplate, parseSpreadsheet } from "@/lib/excel";
import { cn } from "@/lib/utils";

export interface GradeStudent {
  id: string;
  code: string;
  full_name: string;
}

export interface ExistingGrade {
  id: string;
  student_id: string;
  assessment_type: "ddg_tx" | "ddg_gk" | "ddg_ck";
  score: number | null;
  result: "dat" | "chua_dat" | null;
}

interface CellState {
  tx: string;
  gk: string;
  ck: string;
  result: "" | "dat" | "chua_dat";
}

function parseScores(raw: string): number[] | null {
  const parts = raw
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return [];
  const nums: number[] = [];
  for (const p of parts) {
    const n = Number(p.replace(",", "."));
    if (Number.isNaN(n) || n < 0 || n > 10) return null;
    nums.push(n);
  }
  return nums;
}

function cellAvg(c: CellState): number | null {
  const tx = parseScores(c.tx);
  const gk = c.gk.trim() === "" ? null : Number(c.gk.replace(",", "."));
  const ck = c.ck.trim() === "" ? null : Number(c.ck.replace(",", "."));
  if (tx === null) return null;
  if (gk != null && (Number.isNaN(gk) || gk < 0 || gk > 10)) return null;
  if (ck != null && (Number.isNaN(ck) || ck < 0 || ck > 10)) return null;
  const rows = [
    ...tx.map((score) => ({ assessment_type: "ddg_tx", score })),
    ...(gk != null ? [{ assessment_type: "ddg_gk", score: gk }] : []),
    ...(ck != null ? [{ assessment_type: "ddg_ck", score: ck }] : []),
  ];
  return semesterAverage(rows);
}

function cellInvalid(c: CellState): boolean {
  if (parseScores(c.tx) === null) return true;
  for (const v of [c.gk, c.ck]) {
    if (v.trim() !== "") {
      const n = Number(v.replace(",", "."));
      if (Number.isNaN(n) || n < 0 || n > 10) return true;
    }
  }
  return false;
}

function isEmpty(c: CellState): boolean {
  return !c.tx.trim() && !c.gk.trim() && !c.ck.trim() && !c.result;
}

/** Sổ điểm TT22 - mỗi HS một dòng: ĐĐGtx (nhiều điểm), ĐĐGgk, ĐĐGck, ĐTBm tự tính. */
export function GradesEditor({
  students,
  grades,
  subjectId,
  term,
  method,
  meId,
}: {
  students: GradeStudent[];
  grades: ExistingGrade[];
  subjectId: string;
  term: string;
  method: "score" | "comment";
  meId: string;
}) {
  const router = useRouter();
  const [cells, setCells] = useState<Record<string, CellState>>(() => {
    const init: Record<string, CellState> = {};
    for (const s of students) {
      const rows = grades.filter((g) => g.student_id === s.id);
      init[s.id] = {
        tx: rows
          .filter((g) => g.assessment_type === "ddg_tx")
          .map((g) => g.score)
          .join(" "),
        gk:
          rows.find((g) => g.assessment_type === "ddg_gk")?.score?.toString() ??
          "",
        ck:
          rows.find((g) => g.assessment_type === "ddg_ck")?.score?.toString() ??
          "",
        result: (rows.find((g) => g.result)?.result as CellState["result"]) ?? "",
      };
    }
    return init;
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const byCode = new Map(students.map((s) => [s.code.toLowerCase(), s.id]));

  function downloadTemplate() {
    if (method === "comment") {
      void downloadXlsxTemplate(
        "mau-nhap-danh-gia.xlsx",
        ["Mã HS", "Họ và tên", "Đánh giá"],
        students.map((s) => [
          s.code,
          s.full_name,
          cells[s.id]?.result === "chua_dat" ? "Chưa đạt" : "Đạt",
        ]),
      );
      return;
    }
    void downloadXlsxTemplate(
      "mau-nhap-diem.xlsx",
      ["Mã HS", "Họ và tên", "ĐĐGtx", "ĐĐGgk", "ĐĐGck"],
      students.map((s) => [
        s.code,
        s.full_name,
        cells[s.id]?.tx ?? "",
        cells[s.id]?.gk ?? "",
        cells[s.id]?.ck ?? "",
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
    const isHeader = (cells: string[]) =>
      (cells[0] ?? "").toLowerCase().includes("mã");
    const dataRows = table.filter((r) => !isHeader(r));
    let matched = 0;
    const missed: string[] = [];
    setCells((prev) => {
      const next = { ...prev };
      for (const r of dataRows) {
        const code = (r[0] ?? "").trim().toLowerCase();
        if (!code) continue;
        const id = byCode.get(code);
        if (!id) {
          missed.push(r[0]);
          continue;
        }
        matched += 1;
        if (method === "comment") {
          const v = (r[2] ?? "").trim().toLowerCase();
          const result =
            v.includes("chưa") || v === "chua_dat"
              ? "chua_dat"
              : v
                ? "dat"
                : "";
          next[id] = { ...next[id], result: result as CellState["result"] };
        } else {
          next[id] = {
            ...next[id],
            tx: (r[2] ?? "").trim(),
            gk: (r[3] ?? "").trim(),
            ck: (r[4] ?? "").trim(),
          };
        }
      }
      return next;
    });
    setSaved(false);
    setImportMsg(
      `Đã điền ${matched} học sinh từ file${missed.length ? ` - không khớp mã: ${missed.slice(0, 5).join(", ")}${missed.length > 5 ? "…" : ""}` : ""}. Kiểm tra rồi bấm Lưu điểm.`,
    );
    if (fileRef.current) fileRef.current.value = "";
  }

  function setCell(id: string, patch: Partial<CellState>) {
    setSaved(false);
    setCells((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function save() {
    setSaved(false);
    setError(null);
    for (const s of students) {
      const c = cells[s.id];
      if (c && cellInvalid(c)) {
        setError(`Điểm không hợp lệ cho học sinh ${s.full_name} (0-10).`);
        return;
      }
    }

    startTransition(async () => {
      const supabase = createClient();
      const studentIds = students.map((s) => s.id);
      const { error: delErr } = await supabase
        .from("grades")
        .delete()
        .in("student_id", studentIds)
        .eq("subject_id", subjectId)
        .eq("term", term);
      if (delErr) {
        setError(delErr.message);
        return;
      }

      const rows: Record<string, unknown>[] = [];
      for (const s of students) {
        const c = cells[s.id];
        if (!c || isEmpty(c)) continue;
        if (method === "comment") {
          if (c.result) {
            rows.push({
              student_id: s.id,
              subject_id: subjectId,
              term,
              assessment_type: "ddg_ck",
              result: c.result,
              entered_by: meId,
            });
          }
          continue;
        }
        const tx = parseScores(c.tx) ?? [];
        const gk = c.gk.trim() === "" ? null : Number(c.gk.replace(",", "."));
        const ck = c.ck.trim() === "" ? null : Number(c.ck.replace(",", "."));
        tx.forEach((score, i) => {
          rows.push({
            student_id: s.id,
            subject_id: subjectId,
            term,
            assessment_type: "ddg_tx",
            score,
            seq: i + 1,
            entered_by: meId,
          });
        });
        if (gk != null) {
          rows.push({
            student_id: s.id,
            subject_id: subjectId,
            term,
            assessment_type: "ddg_gk",
            score: gk,
            seq: 1,
            entered_by: meId,
          });
        }
        if (ck != null) {
          rows.push({
            student_id: s.id,
            subject_id: subjectId,
            term,
            assessment_type: "ddg_ck",
            score: ck,
            seq: 1,
            entered_by: meId,
          });
        }
      }

      if (rows.length) {
        const { error: insErr } = await supabase.from("grades").insert(rows);
        if (insErr) {
          setError(insErr.message);
          return;
        }
      }
      setSaved(true);
      router.refresh();
    });
  }

  const columns =
    method === "score"
      ? ["Mã HS", "Họ và tên", "ĐĐGtx", "ĐĐGgk", "ĐĐGck", "ĐTBm"]
      : ["Mã HS", "Họ và tên", "Đánh giá"];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {students.length} học sinh
        </span>
        <span className="flex flex-wrap items-center gap-3">
          {saved && <span className="text-sm text-success">Đã lưu điểm.</span>}
          {error && <span className="text-sm text-error">{error}</span>}
          {importMsg && (
            <span className="text-sm text-primary">{importMsg}</span>
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
          <Button onClick={save} disabled={pending} size="sm">
            {pending ? "Đang lưu…" : "Lưu điểm"}
          </Button>
        </span>
      </div>
      <DataTable
        columns={columns}
        footer={<span>{students.length} học sinh</span>}
      >
        {students.map((s) => {
          const c = cells[s.id] ?? { tx: "", gk: "", ck: "", result: "" };
          const invalid = cellInvalid(c);
          const avg = method === "score" ? cellAvg(c) : null;
          const inputCls = (bad: boolean) =>
            cn(
              "h-8 w-full min-w-16 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring",
              bad && "border-destructive",
            );
          return (
            <tr key={s.id}>
              <td className="font-mono text-xs text-muted-foreground">
                {s.code}
              </td>
              <td className="font-medium">{s.full_name}</td>
              {method === "score" ? (
                <>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="8 9 7.5"
                      value={c.tx}
                      onChange={(e) => setCell(s.id, { tx: e.target.value })}
                      className={cn(inputCls(invalid && parseScores(c.tx) === null), "w-28")}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={c.gk}
                      onChange={(e) => setCell(s.id, { gk: e.target.value })}
                      className={cn(inputCls(false), "w-20")}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={c.ck}
                      onChange={(e) => setCell(s.id, { ck: e.target.value })}
                      className={cn(inputCls(false), "w-20")}
                    />
                  </td>
                  <td className="font-semibold">
                    {avg != null ? avg.toFixed(1) : "-"}
                  </td>
                </>
              ) : (
                <td>
                  <select
                    value={c.result}
                    onChange={(e) =>
                      setCell(s.id, {
                        result: e.target.value as CellState["result"],
                      })
                    }
                    className="h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring"
                  >
                    <option value="">-</option>
                    <option value="dat">Đạt</option>
                    <option value="chua_dat">Chưa đạt</option>
                  </select>
                </td>
              )}
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}
