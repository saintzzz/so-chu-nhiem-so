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

/**
 * Điểm trung bình môn cả năm theo TT22: (ĐTBmhk1 + 2 x ĐTBmhk2) / 3,
 * làm tròn 0.1. Ket qua ca nam chi xac dinh khi co DU 2 hoc ky - tra
 * null cho den khi co HK2. Caller can "diem moi nhat" thi dung hk2 ?? hk1.
 */
export function yearAverage(hk1: number | null, hk2: number | null): number | null {
  if (hk1 == null || hk2 == null) return null;
  return Math.round(((hk1 + hk2 * 2) / 3) * 10) / 10;
}

// Ky moi nhat gianh quyen quyet dinh (hk2 > hk1 > khac) - bat bien thu tu hang.
const TERM_RANK: Record<string, number> = { hk1: 1, hk2: 2 };

/**
 * Danh sach HS co DTBm mon <5 tai hoc ky MOI NHAT (hk2 neu co, nguoc lai
 * hk1). Nhom diem theo (HS, mon, ky), tinh semesterAverage tung o, roi lay
 * ky moi nhat cho moi cap (HS, mon). Ham thuan, ket qua bat bien voi thu tu
 * hang dau vao - dung cho radar canh bao som.
 */
export function lowGradeStudentIds<
  T extends GradeComponent & {
    student_id: string;
    subject_id: string;
    term: string;
  },
>(rows: T[]): Set<string> {
  const cells = new Map<string, T[]>();
  for (const r of rows) {
    const key = `${r.student_id}|${r.subject_id}|${r.term}`;
    const arr = cells.get(key) ?? [];
    arr.push(r);
    cells.set(key, arr);
  }
  const latestByPair = new Map<string, { rank: number; term: string; avg: number }>();
  for (const [key, cell] of cells) {
    const avg = semesterAverage(cell);
    if (avg == null) continue;
    const sep = key.indexOf("|");
    const sep2 = key.indexOf("|", sep + 1);
    const pairKey = key.slice(0, sep2);
    const term = key.slice(sep2 + 1);
    const rank = TERM_RANK[term] ?? 0;
    const cur = latestByPair.get(pairKey);
    // Rank bang nhau (term khong biet) -> chon term lon nhat theo chuoi,
    // bao dam ket qua khong phu thuoc thu tu hang dau vao.
    if (!cur || rank > cur.rank || (rank === cur.rank && term > cur.term)) {
      latestByPair.set(pairKey, { rank, term, avg });
    }
  }
  const out = new Set<string>();
  for (const [pairKey, cell] of latestByPair) {
    if (cell.avg < 5) out.add(pairKey.slice(0, pairKey.indexOf("|")));
  }
  return out;
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

/** Nhóm điểm trung bình số học, không phải xếp loại kết quả học tập theo TT22. */
export function averageScoreBand(avg: number | null): {
  label: string;
  tone: "success" | "primary" | "warning" | "error" | "default";
} {
  if (avg == null) return { label: "-", tone: "default" };
  if (avg >= 8) return { label: "≥ 8,0", tone: "success" };
  if (avg >= 6.5) return { label: "6,5 - 7,9", tone: "primary" };
  if (avg >= 5) return { label: "5,0 - 6,4", tone: "warning" };
  return { label: "< 5,0", tone: "error" };
}
