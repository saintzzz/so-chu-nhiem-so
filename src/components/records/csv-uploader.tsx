"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ParsedRow {
  line: number;
  code: string;
  fullName: string;
  dob: string;
  gender: string;
  errors: string[];
}

const HEADER_ALIASES: Record<string, keyof ParsedRow | null> = {
  code: "code",
  ma_hs: "code",
  mahs: "code",
  mssv: "code",
  full_name: "fullName",
  ho_ten: "fullName",
  hoten: "fullName",
  name: "fullName",
  dob: "dob",
  ngay_sinh: "dob",
  ngaysinh: "dob",
  gender: "gender",
  gioi_tinh: "gender",
  gioitinh: "gender",
};

function normalizeKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, "_");
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const firstCells = splitCsvLine(lines[0], delimiter).map(normalizeKey);
  const headerMap = firstCells.map((c) => HEADER_ALIASES[c] ?? null);
  const hasHeader = headerMap.some((m) => m !== null);

  const rows: ParsedRow[] = [];
  const dataLines = hasHeader ? lines.slice(1) : lines;
  dataLines.forEach((line, i) => {
    const cells = splitCsvLine(line, delimiter);
    const row: ParsedRow = {
      line: i + (hasHeader ? 2 : 1),
      code: "",
      fullName: "",
      dob: "",
      gender: "",
      errors: [],
    };
    if (hasHeader) {
      headerMap.forEach((key, idx) => {
        if (key && key !== "line" && key !== "errors") {
          row[key] = cells[idx] ?? "";
        }
      });
    } else {
      row.code = cells[0] ?? "";
      row.fullName = cells[1] ?? "";
      row.dob = cells[2] ?? "";
      row.gender = cells[3] ?? "";
    }
    if (!row.fullName) row.errors.push("Thiếu họ tên");
    if (row.gender && !["nam", "nu", "khac", "nữ"].includes(row.gender.toLowerCase()))
      row.errors.push("Giới tính không hợp lệ");
    if (row.dob && !/^\d{4}-\d{2}-\d{2}$/.test(row.dob) && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(row.dob))
      row.errors.push("Ngày sinh sai định dạng");
    rows.push(row);
  });
  return rows;
}

export function CsvUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    setParseError(null);
    setRows([]);
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setParseError("File rỗng hoặc không đọc được nội dung CSV.");
      } else {
        setRows(parsed);
      }
    } catch {
      setParseError("Không đọc được file. Vui lòng thử file CSV khác.");
    }
  }

  const valid = rows.filter((r) => r.errors.length === 0);
  const invalid = rows.length - valid.length;
  const preview = rows.slice(0, 50);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center shadow-[var(--shadow-sm-token)]">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <p className="text-sm text-muted-foreground">
          Chọn file CSV danh sách học sinh để xem trước dữ liệu.
        </p>
        <Button
          type="button"
          className="mt-3"
          onClick={() => inputRef.current?.click()}
        >
          Chọn file CSV
        </Button>
        {fileName && (
          <p className="mt-2 text-xs text-muted-foreground">
            Đã chọn: {fileName}
          </p>
        )}
      </div>

      {parseError && (
        <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error">
          {parseError}
        </p>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-success-bg px-2.5 py-1 font-medium text-success">
              {valid.length} dòng hợp lệ
            </span>
            {invalid > 0 && (
              <span className="rounded-full bg-error-bg px-2.5 py-1 font-medium text-error">
                {invalid} dòng lỗi
              </span>
            )}
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              Xem trước {preview.length}/{rows.length} dòng
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {["Dòng", "Mã HS", "Họ tên", "Ngày sinh", "Giới tính", "Kiểm tra"].map(
                    (c) => (
                      <th
                        key={c}
                        className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        {c}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="[&_tr]:border-b [&_tr]:border-border [&_tr:last-child]:border-0 [&_td]:px-4 [&_td]:py-2.5">
                {preview.map((r) => (
                  <tr key={r.line}>
                    <td className="text-muted-foreground">{r.line}</td>
                    <td className="font-mono text-xs">{r.code || "—"}</td>
                    <td className="font-medium">{r.fullName || "—"}</td>
                    <td>{r.dob || "—"}</td>
                    <td>{r.gender || "—"}</td>
                    <td>
                      {r.errors.length === 0 ? (
                        <span className="text-xs font-medium text-success">
                          Hợp lệ
                        </span>
                      ) : (
                        <span
                          className={cn("text-xs font-medium text-error")}
                          title={r.errors.join("; ")}
                        >
                          {r.errors.join("; ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">
            Đây là bản xem trước phía client. Trong bản demo, việc import thật
            được thực hiện qua script seed (scripts/seed.mjs) — dữ liệu chưa được
            ghi vào hệ thống.
          </p>
        </>
      )}
    </div>
  );
}
