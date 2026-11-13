"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeSpreadsheetCell } from "@/lib/excel";
import {
  QLGD_HEADERS,
  SMAS_HEADERS,
  VNEDU_MAU1_HEADERS,
  toQlgdRow,
  toSmasRow,
  toVneduRow,
  type VneduStudent,
} from "@/lib/vnedu";

interface ClassGroup {
  id: string;
  name: string;
  gvcnName: string | null;
  students: VneduStudent[];
}

type ExportFormat = "vnedu" | "smas" | "qlgd" | "full";

const FORMATS: Record<
  ExportFormat,
  { label: string; desc: string; headers: readonly string[]; toRow: (s: VneduStudent, i: number, clsName: string) => string[]; file: string }
> = {
  vnedu: {
    label: "Mẫu 1 vnEdu (26 cột)",
    desc: "File xlsx đúng mẫu-1 vnEdu - import ngược vào vnEdu hoặc nộp lên CSDL ngành csdl.moet.gov.vn",
    headers: VNEDU_MAU1_HEADERS,
    toRow: toVneduRow,
    file: "vnedu_mau1",
  },
  smas: {
    label: "SMAS (Viettel)",
    desc: "File xlsx theo template import HS của SMAS - Họ đệm/Tên tách cột, đủ cột cha mẹ liên hệ",
    headers: SMAS_HEADERS,
    toRow: (s, i) => toSmasRow(s, i),
    file: "smas_danh_sach",
  },
  qlgd: {
    label: "CSDL ngành / Quảng Ích (QLGD)",
    desc: "File theo mẫu 4.1.2 'Nhập danh sách học sinh từ excel' của cổng CSDL ngành (hsdttruong.qlgd.edu.vn / truong.csdl.moet.gov.vn) - có Mã lớp, danh mục chuẩn",
    headers: QLGD_HEADERS,
    toRow: (s, i, clsName) => toQlgdRow(s, i, clsName),
    file: "csdl_nganh",
  },
  full: {
    label: "CSV đầy đủ (không mất dữ liệu)",
    desc: "CSV interchange - toàn bộ trường VieSchool kể cả những cột mẫu vnEdu/SMAS không hỗ trợ",
    headers: [
      "code", "national_id", "full_name", "dob", "gender", "address", "status",
      "ten_cha", "sdt_cha", "email_cha", "ten_me", "sdt_me", "email_me",
    ] as const,
    toRow: (s, i) => {
      const cha = s.parents?.find((p) => p.relationship === "cha");
      const me = s.parents?.find((p) => p.relationship === "me");
      return [
        String(i), s.code ?? "", s.national_id ?? "", s.full_name, s.dob ?? "",
        s.gender ?? "", s.address ?? "", s.status ?? "",
        cha?.full_name ?? "", cha?.phone ?? "", cha?.email ?? "",
        me?.full_name ?? "", me?.phone ?? "", me?.email ?? "",
      ];
    },
    file: "vieschool_full",
  },
};

/**
 * CR-116-W3: xuat danh sach lop ra file tuong thich he thong cu.
 * - vnEdu mau-1: khoi tieu de 4 dong + 26 cot chuan y het file export that
 *   cua vnEdu -> vnEdu/SMAS/csdl.moet.gov.vn import lai duoc.
 * - SMAS: template import HS cua Viettel SMAS (Ho dem + Ten tach cot).
 * - CSV day du: interchange giu het truong, khong de leo cot mau khong ho tro.
 */
export function VneduExport({
  classes,
  schoolName,
}: {
  classes: ClassGroup[];
  schoolName: string;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [format, setFormat] = useState<ExportFormat>("vnedu");
  const [busy, setBusy] = useState(false);
  const cls = classes.find((c) => c.id === classId);
  const fmt = FORMATS[format];

  function downloadBlob(name: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportFile() {
    if (!cls || cls.students.length === 0) return;
    setBusy(true);
    try {
      const safeName = cls.name.replace(/\s+/g, "_");
      if (format === "full") {
        // CSV interchange - quote field co dau phay, sanitize chong formula
        const esc = (v: string) => `"${sanitizeSpreadsheetCell(v).replace(/"/g, '""')}"`;
        const lines = [
          ["stt", ...fmt.headers].map(esc).join(","),
          ...cls.students.map((s, i) => fmt.toRow(s, i + 1, cls.name).map(esc).join(",")),
        ];
        downloadBlob(
          `${fmt.file}_${safeName}.csv`,
          new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }),
        );
      } else {
        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("HocSinh");
        // Khoi tieu de giong file export that cua he thong nganh
        ws.addRow([schoolName.toUpperCase()]);
        ws.addRow(["DANH SÁCH HỌC SINH"]);
        ws.addRow([`Lớp: ${cls.name}`, "", `GVCN: ${cls.gvcnName ?? ""}`]);
        ws.addRow([]);
        const head = ws.addRow([...fmt.headers]);
        head.font = { bold: true };
        cls.students.forEach((s, i) => {
          ws.addRow(fmt.toRow(s, i + 1, cls.name).map(sanitizeSpreadsheetCell));
        });
        fmt.headers.forEach((h, i) => {
          ws.getColumn(i + 1).width = Math.max(10, Math.min(28, h.length + 4));
        });
        const buf = await wb.xlsx.writeBuffer();
        downloadBlob(
          `${fmt.file}_${safeName}.xlsx`,
          new Blob([buf], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <h2 className="text-base font-semibold">Xuất file cho hệ thống cũ</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tải danh sách lớp ra file tương thích hệ thống cũ để import ngược lại
        vào vnEdu/SMAS hoặc nộp lên CSDL ngành Bộ GD&ĐT (csdl.moet.gov.vn).
        Cột &quot;Mã VEMIS&quot; = mã định danh ngành 20 ký tự (TT 26/2019).
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
        <select
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={format}
          onChange={(e) => setFormat(e.target.value as ExportFormat)}
        >
          {(Object.keys(FORMATS) as ExportFormat[]).map((f) => (
            <option key={f} value={f}>
              {FORMATS[f].label}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          onClick={exportFile}
          disabled={busy || !cls || cls.students.length === 0}
        >
          <FileSpreadsheet /> {busy ? "Đang xuất..." : "Xuất file"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{fmt.desc}</p>
    </div>
  );
}
