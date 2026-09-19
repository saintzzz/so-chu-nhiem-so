export interface GradeComponent {
  assessment_type: "ddg_tx" | "ddg_gk" | "ddg_ck" | string;
  score: number | null;
  result?: string | null;
}

/**
 * Điểm trung bình môn học kỳ theo Thông tư 22/2021/TT-BGDĐT:
 * ĐTBmhk = (Tổng ĐĐGtx + 2 x ĐĐGgk + 3 x ĐĐGck) / (số ĐĐGtx + 5)
 * Khi thiếu thành phần, mẫu số chỉ tính các thành phần đã có.
 * Kết quả làm tròn 1 chữ số thập phân.
 */
export function semesterAverage(rows: GradeComponent[]): number | null {
  let txSum = 0;
  let txCount = 0;
  let gk: number | null = null;
  let ck: number | null = null;
  for (const r of rows) {
    if (r.score == null) continue;
    if (r.assessment_type === "ddg_tx") {
      txSum += r.score;
      txCount++;
    } else if (r.assessment_type === "ddg_gk") {
      gk = r.score;
    } else if (r.assessment_type === "ddg_ck") {
      ck = r.score;
    }
  }
  const denom = txCount + (gk != null ? 2 : 0) + (ck != null ? 3 : 0);
  if (denom === 0) return null;
  const avg = (txSum + (gk ?? 0) * 2 + (ck ?? 0) * 3) / denom;
  return Math.round(avg * 10) / 10;
}

/** Điểm trung bình môn cả năm: (ĐTBmhk1 + 2 x ĐTBmhk2) / 3, làm tròn 0.1. */
export function yearAverage(hk1: number | null, hk2: number | null): number | null {
  if (hk1 == null && hk2 == null) return null;
  if (hk1 == null) return hk2;
  if (hk2 == null) return hk1;
  return Math.round(((hk1 + hk2 * 2) / 3) * 10) / 10;
}

/** ĐTB mỗi ô (học sinh x môn x kỳ) rồi trung bình các ô theo học sinh. */
export function averageByStudent<
  T extends GradeComponent & {
    student_id: string;
    subject_id: string;
    term: string;
  },
>(rows: T[]): Map<string, number> {
  const cells = new Map<string, T[]>();
  for (const r of rows) {
    const key = `${r.student_id}|${r.subject_id}|${r.term}`;
    const arr = cells.get(key) ?? [];
    arr.push(r);
    cells.set(key, arr);
  }
  const perStudent = new Map<string, number[]>();
  for (const [key, cell] of cells) {
    const a = semesterAverage(cell);
    if (a == null) continue;
    const sid = key.split("|")[0];
    const arr = perStudent.get(sid) ?? [];
    arr.push(a);
    perStudent.set(sid, arr);
  }
  const out = new Map<string, number>();
  for (const [sid, avgs] of perStudent) {
    out.set(
      sid,
      Math.round((avgs.reduce((x, y) => x + y, 0) / avgs.length) * 10) / 10,
    );
  }
  return out;
}

/** Xếp loại học lực theo ĐTB: Tốt/Khá/Đạt/Chưa đạt (TT22). */
export function scoreBand(avg: number | null): {
  label: string;
  tone: "success" | "primary" | "warning" | "error" | "default";
} {
  if (avg == null) return { label: "-", tone: "default" };
  if (avg >= 8) return { label: "Tốt", tone: "success" };
  if (avg >= 6.5) return { label: "Khá", tone: "primary" };
  if (avg >= 5) return { label: "Đạt", tone: "warning" };
  return { label: "Chưa đạt", tone: "error" };
}
