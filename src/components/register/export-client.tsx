"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import type { Grade, Student, StudentGroup } from "@/types";

interface ExportRow {
  code: string;
  name: string;
  group: string;
  avgScore: string;
  unexcused: number;
  excused: number;
  late: number;
  points: number;
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm";

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
        .eq("status", "active")
        .order("full_name"),
      supabase.from("student_groups").select("*").eq("class_id", classId),
    ]);
    const students = (studentsData ?? []) as Student[];
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
              .lte("date", `${period}-31`),
          ])
        : [{ data: [] }, { data: [] }];
    const grades = (gradesData ?? []) as Grade[];
    const attendance = (attData ?? []) as {
      student_id: string;
      status: string;
    }[];

    return students.map((s) => {
      const gs = grades.filter((g) => g.student_id === s.id);
      const avg =
        gs.length > 0
          ? (gs.reduce((a, g) => a + g.score, 0) / gs.length).toFixed(1)
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
      };
    });
  }

  async function exportCsv() {
    setBusy(true);
    setMessage(null);
    const data = await loadRows();
    const header = [
      "Mã HS",
      "Họ tên",
      "Tổ",
      "Điểm TB",
      "Vắng KP",
      "Vắng CP",
      "Đi muộn",
      "Điểm tích cực",
    ];
    const csv = [
      header.join(","),
      ...data.map((r) =>
        [
          r.code,
          r.name,
          r.group,
          r.avgScore,
          r.unexcused,
          r.excused,
          r.late,
          r.points,
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const cls = classes.find((c) => c.id === classId);
    a.href = url;
    a.download = `so-chu-nhiem-${cls?.name ?? "lop"}-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`Đã xuất CSV cho ${data.length} học sinh.`);
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
          <Button onClick={exportCsv} disabled={busy || !classId}>
            <Download /> Xuất CSV
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
