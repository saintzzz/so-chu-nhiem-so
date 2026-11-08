"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeSpreadsheetCell } from "@/lib/excel";
import { VNEDU_MAU1_HEADERS, toVneduRow, type VneduStudent } from "@/lib/vnedu";

interface ClassGroup {
  id: string;
  name: string;
  gvcnName: string | null;
  students: VneduStudent[];
}

/**
 * CR-116-W3: xuat danh sach lop ra file Excel dung "mau 1" cua vnEdu de
 * he thong cu (vnEdu/SMAS) import nguoc lai duoc - khoi tieu de 4 dong +
 * 26 cot chuan y het file export that cua vnEdu.
 */
export function VneduExport({
  classes,
  schoolName,
}: {
  classes: ClassGroup[];
  schoolName: string;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const cls = classes.find((c) => c.id === classId);

  async function exportFile() {
    if (!cls || cls.students.length === 0) return;
    setBusy(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("HocSinh");
      // Khoi tieu de giong file export that cua vnEdu
      ws.addRow([schoolName.toUpperCase()]);
      ws.addRow(["DANH SÁCH HỌC SINH"]);
      ws.addRow([`Lớp: ${cls.name}`, "", `GVCN: ${cls.gvcnName ?? ""}`]);
      ws.addRow([]);
      const head = ws.addRow([...VNEDU_MAU1_HEADERS]);
      head.font = { bold: true };
      cls.students.forEach((s, i) => {
        ws.addRow(toVneduRow(s, i + 1).map(sanitizeSpreadsheetCell));
      });
      VNEDU_MAU1_HEADERS.forEach((h, i) => {
        ws.getColumn(i + 1).width = Math.max(10, Math.min(28, h.length + 4));
      });
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vnedu_mau1_${cls.name.replace(/\s+/g, "_")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <h2 className="text-base font-semibold">Xuất file cho hệ thống cũ</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tải danh sách lớp ra file Excel đúng &quot;mẫu 1&quot; của vnEdu (26 cột
        chuẩn, Mã VEMIS = mã định danh ngành) - dùng để import ngược lại vào
        vnEdu/SMAS hoặc nộp lên CSDL ngành Bộ GD&ĐT (csdl.moet.gov.vn).
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.students.length} HS)
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          onClick={exportFile}
          disabled={busy || !cls || cls.students.length === 0}
        >
          <FileSpreadsheet /> {busy ? "Đang xuất..." : "Xuất file mẫu 1 vnEdu"}
        </Button>
      </div>
    </div>
  );
}
