"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadXlsxTemplate, parseSpreadsheet } from "@/lib/excel";
import {
  normalizeDob,
  normalizeGender,
  parseStudentTable,
  type ParsedStudentRow,
} from "@/lib/vnedu";

type ParsedRow = ParsedStudentRow;

interface ClassOption {
  id: string;
  name: string;
}

export function StudentUploader({ classes }: { classes: ClassOption[] }) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
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
      const parsed = parseStudentTable(table);
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

    const { data: existing, error: existErr } = await supabase
      .from("students")
      .select("code")
      .like("code", "HS%")
      .order("code", { ascending: false })
      .limit(1);
    // r24: lookup loi -> seq quay ve 1 -> sinh ma HS trung -> import fail
    // tren unique constraint. Chan som thay vi de import that bai tung phan.
    if (existErr) {
      console.error("[student-uploader] code lookup:", existErr.message);
      setMessage("Không tải được dữ liệu nguồn - vui lòng thử lại.");
      setBusy(false);
      return;
    }
    let seq = 1;
    const top = (existing?.[0] as { code: string } | undefined)?.code;
    const m = top?.match(/^HS(\d+)$/);
    if (m) seq = parseInt(m[1], 10) + 1;

    const insert = valid.map((r, i) => ({
      class_id: classId,
      code: r.code || `HS${String(seq + i).padStart(6, "0")}`,
      national_id: r.nationalId.trim() || null,
      full_name: r.fullName,
      dob: normalizeDob(r.dob),
      gender: normalizeGender(r.gender),
      address: r.address.trim() || null,
      status: "active" as const,
    }));
    const { data: inserted, error } = await supabase
      .from("students")
      .insert(insert)
      .select("id");
    if (error) {
      setMessage("Không thể nhập danh sách - kiểm tra quyền ghi hoặc mã HS trùng.");
      setBusy(false);
      return;
    }

    // CR-116-W3: file vnEdu/SMAS co Ten cha/Ten me/SDT/Email -> tao parents +
    // lien ket parent_students de PHHS nhan thong bao ngay (import 2 chieu).
    let linked = 0;
    const studentIds = (inserted ?? []).map((s) => s.id);
    if (studentIds.length === valid.length) {
      // Dedupe theo (moi quan he, ho ten, sdt) trong cung batch - anh/chi em
      // cung bo me chi tao 1 ban ghi parents.
      const seen = new Map<string, string>();
      const parentInserts: { full_name: string; phone: string | null; email: string | null; relationship: string }[] = [];
      const linkRows: { student_id: string; parent_key: string }[] = [];
      valid.forEach((r, i) => {
        const sid = studentIds[i];
        const mk = (rel: string, name: string) => {
          if (!name.trim()) return;
          const key = `${rel}|${name.trim().toLowerCase()}|${r.sdtPH.trim()}`;
          if (!seen.has(key)) {
            seen.set(key, `p${seen.size}`);
            parentInserts.push({
              full_name: name.trim(),
              phone: r.sdtPH.trim() || null,
              email: r.emailPH.trim() || null,
              relationship: rel,
            });
          }
          linkRows.push({ student_id: sid, parent_key: key });
        };
        mk("cha", r.tenCha);
        mk("me", r.tenMe);
      });
      if (parentInserts.length > 0) {
        const { data: newParents, error: parentErr } = await supabase
          .from("parents")
          .insert(parentInserts)
          .select("id");
        if (parentErr) {
          console.error("[student-uploader] parents insert:", parentErr.message);
        }
        if (newParents && !parentErr) {
          const keyToId = new Map<string, string>();
          parentInserts.forEach((p, i) => {
            const key = [...seen.entries()].find(([, v]) => v === `p${i}`)?.[0];
            if (key) keyToId.set(key, newParents[i].id);
          });
          const links = linkRows
            .map((l) => ({ student_id: l.student_id, parent_id: keyToId.get(l.parent_key)! }))
            .filter((l) => l.parent_id);
          if (links.length > 0) {
            const { error: linkErr } = await supabase.from("parent_students").insert(links);
            if (!linkErr) linked = links.length;
          }
        }
      }
    }
    setMessage(
      `Đã nhập ${insert.length} học sinh vào lớp` +
        (linked > 0 ? `, liên kết ${linked} phụ huynh` : "") +
        ".",
    );
    setRows([]);
    setBusy(false);
  }

  const valid = rows.filter((r) => r.errors.length === 0);
  const invalid = rows.length - valid.length;
  const preview = rows.slice(0, 50);

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-xl border border-dashed bg-card p-6 text-center shadow-[var(--shadow-sm-token)] transition-colors",
          dragOver ? "border-primary bg-primary-bg" : "border-border",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFile(e.dataTransfer.files?.[0]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <p className="text-sm text-muted-foreground">
          Kéo thả file vào đây hoặc chọn file Excel (.xlsx) / CSV danh sách học
          sinh để xem trước dữ liệu.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Chấp nhận cả file xuất từ SMAS / vnEdu - tự nhận diện cột Mã học
          sinh / Mã VEMIS (mã định danh), Họ đệm + Tên, Ngày sinh, Giới tính,
          Chỗ ở hiện nay / Hộ khẩu thường trú.
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
                ["ma_hs", "ma_dinh_danh", "ho_ten", "ngay_sinh", "gioi_tinh"],
                [
                  ["HS000101", "1000000001", "Nguyễn Văn An", "2013-05-12", "nam"],
                  ["HS000102", "1000000002", "Trần Thị Bình", "15/08/2013", "nu"],
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
          <div className="relative overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {["Dòng", "Mã HS", "Mã định danh", "Họ tên", "Ngày sinh", "Giới tính", "Kiểm tra"].map(
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
                    <td className="font-mono text-xs">{r.nationalId || "-"}</td>
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
          <div data-slot="toolbar" className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
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
