"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { semesterAverage } from "@/lib/tt22";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const CONDUCT_LABEL: Record<string, string> = {
  tot: "Tốt",
  kha: "Khá",
  dat: "Đạt",
  chua_dat: "Chưa đạt",
};

const LEVEL_LABEL: Record<string, string> = {
  T: "Tốt",
  H: "Hoàn thành",
  C: "Chưa hoàn thành",
};

interface GradeRow {
  student_id: string;
  subject_id: string;
  assessment_type: string;
  score: number | null;
  result: string | null;
  level: string | null;
}

/** Xuất Mẫu 3 CSDL ngành: ma trận lớp × môn (ĐTBm từng môn) + Kết quả rèn luyện + Kết quả học tập. */
export function ClassReportExport({
  classId,
  className,
  term,
  schoolLevel,
}: {
  classId: string;
  className: string;
  term: string;
  schoolLevel: "th" | "thcs" | "thpt" | "lien_cap";
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const isTh = schoolLevel === "th";

  async function exportReport() {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();

    const [{ data: studentData }, { data: subjectData }] = await Promise.all([
      supabase
        .from("students")
        .select("id,code,national_id,full_name,dob")
        .eq("class_id", classId)
        .eq("status", "active")
        .order("full_name"),
      supabase.from("subjects").select("id,name,assessment_method").order("name"),
    ]);
    const students = (studentData ?? []) as {
      id: string;
      code: string;
      national_id: string | null;
      full_name: string;
      dob: string | null;
    }[];
    const subjects = (subjectData ?? []) as {
      id: string;
      name: string;
      assessment_method: string;
    }[];
    const studentIds = students.map((s) => s.id);

    const [{ data: gradeData }, { data: conductData }] = studentIds.length
      ? await Promise.all([
          supabase
            .from("grades")
            .select("student_id,subject_id,assessment_type,score,result,level")
            .in("student_id", studentIds)
            .eq("term", term)
            .limit(20000),
          supabase
            .from("conduct_evaluations")
            .select("student_id,rating")
            .in("student_id", studentIds)
            .eq("term", term),
        ])
      : [{ data: [] }, { data: [] }];
    const grades = (gradeData ?? []) as GradeRow[];
    const conductByStudent = new Map(
      ((conductData ?? []) as { student_id: string; rating: string }[]).map(
        (c) => [c.student_id, c.rating],
      ),
    );

    // ĐTBm/môn (THCS/THPT) hoặc mức T/H/C cuối kỳ (TH)
    const cellByKey = new Map<string, string>();
    const avgByStudent = new Map<string, number[]>();
    for (const s of students) {
      for (const sub of subjects) {
        const rows = grades.filter(
          (g) => g.student_id === s.id && g.subject_id === sub.id,
        );
        if (!rows.length) continue;
        if (isTh) {
          const ck = rows.find((r) => r.assessment_type === "ddg_ck");
          const lv = ck?.level ?? rows.find((r) => r.level)?.level;
          cellByKey.set(`${s.id}|${sub.id}`, lv ? (LEVEL_LABEL[lv] ?? lv) : "");
          continue;
        }
        if (sub.assessment_method === "comment") {
          const res = rows.find((r) => r.result)?.result;
          cellByKey.set(
            `${s.id}|${sub.id}`,
            res === "dat" ? "Đạt" : res === "chua_dat" ? "Chưa đạt" : "",
          );
          continue;
        }
        const avg = semesterAverage(
          rows.map((r) => ({
            assessment_type: r.assessment_type,
            score: r.score,
          })),
        );
        cellByKey.set(`${s.id}|${sub.id}`, avg != null ? avg.toFixed(1) : "");
        if (avg != null) {
          avgByStudent.set(s.id, [...(avgByStudent.get(s.id) ?? []), avg]);
        }
      }
    }

    // Kết quả học tập: ĐTB tất cả môn tính điểm → Tốt≥8, Khá≥6.5, Đạt≥5, Chưa đạt<5
    function hocTapLabel(sId: string): string {
      const avgs = avgByStudent.get(sId) ?? [];
      if (!avgs.length) return "";
      const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length;
      return mean >= 8 ? "Tốt" : mean >= 6.5 ? "Khá" : mean >= 5 ? "Đạt" : "Chưa đạt";
    }

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Mẫu 3");
    const headers = [
      "STT",
      "Lớp",
      "Mã định danh Bộ GD&ĐT",
      "Họ và tên",
      "Ngày sinh",
      ...subjects.map((s) => s.name),
      "Kết quả rèn luyện",
      "Kết quả học tập",
    ];
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    headers.forEach((h, i) => {
      ws.getColumn(i + 1).width = Math.max(12, h.length + 4);
    });
    students.forEach((s, i) => {
      ws.addRow([
        String(i + 1),
        className,
        s.national_id ?? s.code,
        s.full_name,
        s.dob ?? "",
        ...subjects.map((sub) => cellByKey.get(`${s.id}|${sub.id}`) ?? ""),
        CONDUCT_LABEL[conductByStudent.get(s.id) ?? ""] ?? "",
        hocTapLabel(s.id),
      ]);
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: XLSX_MIME });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mau-3-bang-diem-${className}-${term}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setBusy(false);
    setMsg(`Đã xuất ${students.length} học sinh × ${subjects.length} môn.`);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void exportReport()}
        disabled={busy}
      >
        <FileSpreadsheet className="size-4" />
        {busy ? "Đang xuất…" : "Xuất Mẫu 3 (toàn bộ môn)"}
      </Button>
      {msg && <span className="text-xs text-success">{msg}</span>}
    </span>
  );
}
