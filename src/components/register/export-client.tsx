"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import type { Grade, Student, StudentGroup } from "@/types";
import { semesterAverage } from "@/lib/tt22";
import { sortByVietnameseName } from "@/lib/utils";

interface ExportRow {
  code: string;
  name: string;
  group: string;
  avgScore: string;
  unexcused: number;
  excused: number;
  late: number;
  points: number;
  attDetail: { date: string; status: string }[];
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm";

const STATUS_LABEL: Record<string, string> = {
  present: "Có mặt",
  excused: "Vắng có phép",
  unexcused: "Vắng không phép",
  late: "Đi muộn",
};

/** Ngày cuối tháng của "YYYY-MM" - tránh lỗi "-31" cho tháng 30 ngày. */
function monthEnd(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function ExportClient({
  classes,
  defaultPeriod,
}: {
  classes: { id: string; name: string }[];
  defaultPeriod: string;
}) {
  const supabase = createClient();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [period, setPeriod] = useState(defaultPeriod);
  const [rows, setRows] = useState<ExportRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadRows(): Promise<ExportRow[]> {
    const [{ data: studentsData }, { data: groupsData }] = await Promise.all([
      supabase
        .from("students")
        .select("*")
        .eq("class_id", classId)
        .eq("status", "active"),
      supabase.from("student_groups").select("*").eq("class_id", classId),
    ]);
    const students = sortByVietnameseName((studentsData ?? []) as Student[], (s) => s.full_name);
    const groups = (groupsData ?? []) as StudentGroup[];
    const groupMap = new Map(groups.map((g) => [g.id, g.name]));
    const ids = students.map((s) => s.id);

    const [{ data: gradesData }, { data: attData }] =
      ids.length > 0
        ? await Promise.all([
            supabase.from("grades").select("*").in("student_id", ids),
            supabase
              .from("attendance_records")
              .select("*")
              .in("student_id", ids)
              .gte("date", `${period}-01`)
              .lte("date", monthEnd(period))
              .order("date"),
          ])
        : [{ data: [] }, { data: [] }];
    const grades = (gradesData ?? []) as Grade[];
    const attendance = (attData ?? []) as {
      student_id: string;
      status: string;
      date: string;
    }[];

    return students.map((s) => {
      const gs = grades.filter((g) => g.student_id === s.id);
      const byCell = new Map<string, Grade[]>();
      for (const g of gs) {
        const key = `${g.subject_id}|${g.term}`;
        const arr = byCell.get(key) ?? [];
        arr.push(g);
        byCell.set(key, arr);
      }
      const cellAvgs: number[] = [];
      for (const rows of byCell.values()) {
        const a = semesterAverage(rows);
        if (a != null) cellAvgs.push(a);
      }
      const avg =
        cellAvgs.length > 0
          ? (cellAvgs.reduce((x, y) => x + y, 0) / cellAvgs.length).toFixed(1)
          : "-";
      const att = attendance.filter((a) => a.student_id === s.id);
      return {
        code: s.code,
        name: s.full_name,
        group: s.group_id ? (groupMap.get(s.group_id) ?? "-") : "-",
        avgScore: avg,
        unexcused: att.filter((a) => a.status === "unexcused").length,
        excused: att.filter((a) => a.status === "excused").length,
        late: att.filter((a) => a.status === "late").length,
        points: s.positive_points,
        attDetail: att.map((a) => ({ date: a.date, status: a.status })),
      };
    });
  }

  async function exportXlsx() {
    setBusy(true);
    setMessage(null);
    const data = await loadRows();
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();

    // Sheet 1: tổng hợp theo học sinh
    const ws = wb.addWorksheet("Tổng hợp");
    const headers = [
      "Mã HS",
      "Họ tên",
      "Tổ",
      "Điểm TB",
      "Có mặt",
      "Vắng CP",
      "Vắng KP",
      "Đi muộn",
      "Điểm tích cực",
    ];
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    headers.forEach((h, i) => {
      ws.getColumn(i + 1).width = Math.max(14, h.length + 4);
    });
    data.forEach((r) => {
      ws.addRow([
        r.code,
        r.name,
        r.group,
        r.avgScore,
        r.attDetail.filter((a) => a.status === "present").length,
        r.excused,
        r.unexcused,
        r.late,
        r.points,
      ]);
    });

    // Sheet 2: chuyên cần chi tiết theo ngày
    const ws2 = wb.addWorksheet("Chuyên cần chi tiết");
    ws2.addRow(["Mã HS", "Họ tên", "Ngày", "Trạng thái"]);
    ws2.getRow(1).font = { bold: true };
    ws2.getColumn(1).width = 12;
    ws2.getColumn(2).width = 28;
    ws2.getColumn(3).width = 14;
    ws2.getColumn(4).width = 18;
    for (const r of data) {
      for (const a of r.attDetail) {
        ws2.addRow([r.code, r.name, a.date, STATUS_LABEL[a.status] ?? a.status]);
      }
    }

    const cls = classes.find((c) => c.id === classId);
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `so-chu-nhiem-${cls?.name ?? "lop"}-${period}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`Đã xuất Excel cho ${data.length} học sinh (2 sheet: tổng hợp + chuyên cần chi tiết).`);
    setBusy(false);
  }

  async function exportPrint() {
    setBusy(true);
    setMessage(null);
    const data = await loadRows();
    setRows(data);
    setBusy(false);
    setTimeout(() => window.print(), 100);
  }

  const clsName = classes.find((c) => c.id === classId)?.name ?? "";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)] print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">
              Lớp
            </span>
            <select
              className={inputCls}
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">
              Kỳ (tháng)
            </span>
            <input
              className={inputCls}
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
          <Button onClick={exportXlsx} disabled={busy || !classId}>
            <Download /> Xuất Excel
          </Button>
          <Button variant="outline" onClick={exportPrint} disabled={busy || !classId}>
            <Printer /> Bản in
          </Button>
        </div>
        {message && (
          <p className="mt-3 rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary">
            {message}
          </p>
        )}
      </div>

      {rows && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">
            Sổ chủ nhiệm lớp {clsName} - {period}
          </h2>
          <DataTable
            columns={[
              "Mã HS",
              "Họ tên",
              "Tổ",
              "Điểm TB",
              "Vắng KP",
              "Vắng CP",
              "Đi muộn",
              "Điểm tích cực",
            ]}
          >
            {rows.map((r) => (
              <tr key={r.code}>
                <td className="text-muted-foreground">{r.code}</td>
                <td className="font-medium">{r.name}</td>
                <td>{r.group}</td>
                <td>{r.avgScore}</td>
                <td>{r.unexcused}</td>
                <td>{r.excused}</td>
                <td>{r.late}</td>
                <td>{r.points}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </div>
  );
}
