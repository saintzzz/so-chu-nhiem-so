"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadXlsxTemplate, parseSpreadsheet } from "@/lib/excel";

interface ParsedRow {
  line: number;
  code: string;
  fullName: string;
  dob: string;
  gender: string;
  errors: string[];
}

interface ClassOption {
  id: string;
  name: string;
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

function normalizeGender(g: string): "nam" | "nu" | "khac" | null {
  const n = normalizeKey(g);
  if (n === "nam") return "nam";
  if (n === "nu") return "nu";
  if (!g) return null;
  return "khac";
}

function normalizeDob(d: string): string | null {
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

function parseRows(table: string[][]): ParsedRow[] {
  if (table.length === 0) return [];
  const headerMap = table[0].map((c) => HEADER_ALIASES[normalizeKey(c)] ?? null);
  const hasHeader = headerMap.some((m) => m !== null);
  const dataLines = hasHeader ? table.slice(1) : table;
  return dataLines.map((cells, i) => {
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
    if (row.gender && !normalizeGender(row.gender))
      row.errors.push("Giới tính không hợp lệ");
    if (row.dob && !normalizeDob(row.dob))
      row.errors.push("Ngày sinh sai định dạng");
    return row;
  });
}

export function StudentUploader({ classes }: { classes: ClassOption[] }) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    setParseError(null);
    setMessage(null);
    setRows([]);
    if (!file) return;
    setFileName(file.name);
    try {
      const table = await parseSpreadsheet(file);
      const parsed = parseRows(table);
      if (parsed.length === 0) {
        setParseError("File rỗng hoặc không đọc được nội dung.");
      } else {
        setRows(parsed);
      }
    } catch {
      setParseError("Không đọc được file. Vui lòng thử file Excel (.xlsx) hoặc CSV khác.");
    }
  }

  async function importRows() {
    const valid = rows.filter((r) => r.errors.length === 0);
    if (valid.length === 0 || !classId) return;
    setBusy(true);
    setMessage(null);

    const { data: existing } = await supabase
      .from("students")
      .select("code")
      .like("code", "HS%")
      .order("code", { ascending: false })
      .limit(1);
    let seq = 1;
    const top = (existing?.[0] as { code: string } | undefined)?.code;
    const m = top?.match(/^HS(\d+)$/);
    if (m) seq = parseInt(m[1], 10) + 1;

    const insert = valid.map((r, i) => ({
      class_id: classId,
      code: r.code || `HS${String(seq + i).padStart(6, "0")}`,
      full_name: r.fullName,
      dob: normalizeDob(r.dob),
      gender: normalizeGender(r.gender),
      status: "active" as const,
    }));
    const { error } = await supabase.from("students").insert(insert);
    setMessage(
      error
        ? "Không thể nhập danh sách - kiểm tra quyền ghi hoặc mã HS trùng."
        : `Đã nhập ${insert.length} học sinh vào lớp.`,
    );
    if (!error) setRows([]);
    setBusy(false);
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
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <p className="text-sm text-muted-foreground">
          Chọn file Excel (.xlsx) hoặc CSV danh sách học sinh để xem trước dữ
          liệu.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Button type="button" onClick={() => inputRef.current?.click()}>
            <FileSpreadsheet /> Chọn file
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              downloadXlsxTemplate(
                "template_danh_sach_hoc_sinh.xlsx",
                ["ma_hs", "ho_ten", "ngay_sinh", "gioi_tinh"],
                [
                  ["HS000101", "Nguyễn Văn An", "2013-05-12", "nam"],
                  ["HS000102", "Trần Thị Bình", "15/08/2013", "nu"],
                ],
              )
            }
          >
            <Download /> Tải template
          </Button>
        </div>
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
          <div className="flex flex-wrap items-center gap-2 text-sm">
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
                    <td className="font-mono text-xs">{r.code || "-"}</td>
                    <td className="font-medium">{r.fullName || "-"}</td>
                    <td>{r.dob || "-"}</td>
                    <td>{r.gender || "-"}</td>
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
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
            <label className="text-sm font-medium" htmlFor="import-class">
              Nhập vào lớp
            </label>
            <select
              id="import-class"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button
              onClick={importRows}
              disabled={busy || valid.length === 0 || !classId}
            >
              <Upload /> {busy ? "Đang nhập..." : `Nhập ${valid.length} học sinh`}
            </Button>
          </div>
        </>
      )}

      {message && (
        <p className="rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary">
          {message}
        </p>
      )}
    </div>
  );
}
