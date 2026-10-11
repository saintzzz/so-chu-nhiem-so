"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { semesterAverage } from "@/lib/tt22";
import { compareVietnameseName } from "@/lib/utils";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { gradeYearOr } from "@/lib/grades-year";
import { sanitizeSpreadsheetCell } from "@/lib/excel";

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

    const { data: classRow, error: classErr } = await supabase
      .from("classes")
      .select("school_id,academic_year_id")
      .eq("id", classId)
      .single();
    if (classErr) {
      console.error("[class-report] class lookup:", classErr.message);
      setMsg("Không tải được dữ liệu lớp - vui lòng thử lại.");
      setBusy(false);
      return;
    }
    const [
      { data: studentData, error: stuErr },
      { data: subjectData, error: subjErr },
    ] = await Promise.all([
      supabase
        .from("students")
        .select("id,code,national_id,full_name,dob")
        .eq("class_id", classId)
        .eq("status", "active"),
      supabase
        .from("subjects")
        .select("id,name,assessment_method")
        .eq("school_id", classRow?.school_id ?? "")
        .order("name"),
    ]);
    if (stuErr || subjErr) {
      console.error(
        "[class-report] source lookup:",
        stuErr?.message ?? subjErr?.message,
      );
      setMsg("Không tải được dữ liệu nguồn - vui lòng thử lại.");
      setBusy(false);
      return;
    }
    const students = (studentData ?? []) as {
      id: string;
      code: string;
      national_id: string | null;
      full_name: string;
      dob: string | null;
    }[];
    students.sort((a, b) => compareVietnameseName(a.full_name, b.full_name));
    const subjects = (subjectData ?? []) as {
      id: string;
      name: string;
      assessment_method: string;
    }[];
    const studentIds = students.map((s) => s.id);

    const [gradesRes, { data: conductData, error: condErr }] = studentIds.length
      ? await Promise.all([
          fetchAllRows<GradeRow>((f, t) =>
            supabase
              .from("grades")
              .select("student_id,subject_id,assessment_type,score,result,level")
              .in("student_id", studentIds)
              .eq("term", term)
              // CR-049 r9 M8: chi diem nam hoc cua lop (NULL-legacy giu)
              .or(gradeYearOr(classRow?.academic_year_id))
              .order("id")
              .range(f, t),
          ),
          supabase
            .from("conduct_evaluations")
            .select("student_id,rating")
            .in("student_id", studentIds)
            .eq("term", term),
        ])
      : [
          { rows: [] as GradeRow[], error: null, truncated: false },
          { data: [], error: null },
        ];
    // r24: bao cao xuat ra phai day du - nguon diem/hanh kiem loi hoac bi
    // cat ngang tuyet doi khong duoc xuat file thieu du lieu.
    if (gradesRes.error || gradesRes.truncated || condErr) {
      console.error(
        "[class-report] grades/conduct:",
        gradesRes.error ?? (gradesRes.truncated ? "truncated" : condErr?.message),
      );
      setMsg("Không tải được dữ liệu nguồn - vui lòng thử lại.");
      setBusy(false);
      return;
    }
    const grades = gradesRes.rows;
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
        sanitizeSpreadsheetCell(className),
        sanitizeSpreadsheetCell(s.national_id ?? s.code),
        sanitizeSpreadsheetCell(s.full_name),
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
