"use client";

import { useState, useTransition } from "react";
import { importLiterature } from "@/lib/tvc/actions";
import { Upload, Download, Loader2 } from "lucide-react";

const TEMPLATE_CSV =
  "title,author,text_type,difficulty,topics,grade_min,grade_max,content,license_note\n" +
  '"Tên văn bản","Tác giả","Thơ","2","quê hương; thiên nhiên","6","9","Nội dung văn bản đầy đủ...","Ghi chú quyền tác giả"\n';

export function LiteratureImport() {
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const onImport = (file: File) => {
    setError("");
    setMsg("");
    const isXlsx = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        let rows: string[][] = [];
        if (isXlsx) {
          try {
            const XLSX = await import("xlsx");
            const wb = XLSX.read(reader.result, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            rows = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][])
              .map((r) => r.map((c) => String(c ?? "").trim()))
              .filter((r) => r.some((c) => c));
          } catch {
            return setError("Không đọc được file Excel.");
          }
        } else {
          rows = String(reader.result ?? "")
            .split(/\r?\n/)
            .filter((l) => l.trim())
            .map((line) =>
              line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) =>
                c.trim().replace(/^"|"$/g, ""),
              ),
            );
        }
        const parsed = rows
          .slice(1)
          .map((cols) => {
            const [title, author, text_type, difficulty, topics, grade_min, grade_max, content, license_note] = cols;
            if (!title || !content) return null;
            return {
              title,
              author: author || undefined,
              text_type: text_type || "Văn bản",
              difficulty: Number(difficulty) || 2,
              topics: (topics ?? "").split(/[;|]/).map((t) => t.trim()).filter(Boolean),
              grade_min: Number(grade_min) || 6,
              grade_max: Number(grade_max) || 9,
              content,
              license_note: license_note || undefined,
            };
          })
          .filter(Boolean) as Parameters<typeof importLiterature>[0];
        if (!parsed.length) return setError("File không có dòng dữ liệu hợp lệ (cần title + content).");
        start(async () => {
          const r = await importLiterature(parsed);
          if (r.error) return setError(r.error);
          setMsg(`Đã import ${r.count} văn bản.`);
          window.location.reload();
        });
      })();
    };
    if (isXlsx) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`}
        download="template_ngulieu.csv"
        className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted"
      >
        <Download className="h-4 w-4" /> Tải template
      </a>
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Import CSV/XLSX
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
        />
      </label>
      {error && <span className="text-sm text-destructive">{error}</span>}
      {msg && <span className="text-sm text-emerald-300">{msg}</span>}
    </div>
  );
}

interface ExportRow {
  title: string;
  author: string | null;
  text_type: string;
  difficulty: number;
  topics: string[];
  grade_min: number;
  grade_max: number;
  license_note: string | null;
  content: string;
}

/** Xuất kho ngữ liệu đang lọc ra file Excel - cùng cột với template import. */
export function LiteratureExport({ rows }: { rows: ExportRow[] }) {
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const data = rows.map((r) => ({
        title: r.title,
        author: r.author ?? "",
        text_type: r.text_type,
        difficulty: r.difficulty,
        topics: (r.topics ?? []).join("; "),
        grade_min: r.grade_min,
        grade_max: r.grade_max,
        content: r.content,
        license_note: r.license_note ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [{ wch: 32 }, { wch: 22 }, { wch: 14 }, { wch: 9 }, { wch: 28 }, { wch: 9 }, { wch: 9 }, { wch: 40 }, { wch: 60 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ngữ liệu");
      XLSX.writeFile(wb, "kho_ngu_lieu.xlsx");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={onExport}
      disabled={busy || !rows.length}
      className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Xuất Excel
    </button>
  );
}
