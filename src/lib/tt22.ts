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
  return semesterAssessment(rows).avg;
}

export interface SemesterAssessment {
  avg: number | null;
  /**
   * CR-049 TT22: DTBm hoc ky chi "chot" khi du cot diem bat buoc theo quy
   * dinh danh gia dinh ky - du so DDGtx toi thieu theo tiet/tuan + DDGgk
   * + DDGck. Thieu thanh phan -> diem con la "tam tinh".
   */
  isFinal: boolean;
}

/**
 * So diem DDGtx toi thieu theo TT22/2021 Dieu 9 khoan 2 - tinh theo
 * TIET/NAM HOC: <=35 tiet -> 2 DDGtx; >35-70 tiet -> 3; >70 tiet -> 4.
 * subjects.weekly_periods la tiet/tuan; nam hoc 35 tuan -> quy doi:
 * <=1 tiet/tuan (<=35/nam) -> 2; 2 tiet/tuan (70/nam) -> 3; >=3 -> 4.
 * Khong biet so tiet -> san phap ly 2 (moi mon it nhat 2 DDGtx).
 */
export function requiredTxCount(weeklyPeriods: number | null | undefined): number {
  if (weeklyPeriods == null || weeklyPeriods <= 1) return 2;
  if (weeklyPeriods <= 2) return 3;
  return 4;
}

export function semesterAssessment(
  rows: GradeComponent[],
  opts?: { requiredTx?: number },
): SemesterAssessment {
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
  const avg =
    denom === 0
      ? null
      : Math.round(((txSum + (gk ?? 0) * 2 + (ck ?? 0) * 3) / denom) * 10) / 10;
  const requiredTx = opts?.requiredTx ?? 2;
  return { avg, isFinal: txCount >= requiredTx && gk != null && ck != null };
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

// ============================================================
// CR-053: Xếp loại cả năm theo TT22/2021 (Đ.8, Đ.9, Đ.10-14, Đ.15)
// ============================================================

export type YearRating = "tot" | "kha" | "dat" | "chua_dat";
export type YearStage = "initial" | "after_retest" | "after_summer";
export type Promotion =
  | "len_lop"
  | "kiem_tra_danh_gia_lai"
  | "ren_luyen_he"
  | "o_lai";
export type Missing = "thieu_mon" | "thieu_diem" | "thieu_hanh_kiem" | null;

export interface ScoredSubjectYear {
  subjectId: string;
  /** ĐTBm cả năm - null khi chưa đủ cột bắt buộc. */
  dtmCn: number | null;
  /** true khi CẢ 2 học kỳ đủ cột điểm bắt buộc (semesterAssessment.isFinal). */
  yearFinal: boolean;
}
export type CommentYearResult = "dat" | "chua_dat" | "missing";

const RATING_RANK: Record<YearRating, number> = {
  chua_dat: 0,
  dat: 1,
  kha: 2,
  tot: 3,
};

/**
 * Đ.9 - Kết quả học tập cả năm.
 *   Tốt: mọi môn nhận xét Đạt; mọi ĐTBmcn >=6.5; >=6 môn >=8.0
 *   Khá: mọi môn nhận xét Đạt; mọi ĐTBmcn >=5.0; >=6 môn >=6.5
 *   Đạt: tối đa 1 môn nhận xét Chưa đạt; >=6 môn >=5.0; không môn <3.5
 *   Chưa đạt: còn lại.
 * Đ.9.3 bump: nếu kết quả bị kéo xuống >=2 mức chỉ do ĐÚNG 1 môn (tính
 * điểm hoặc nhận xét), các môn còn lại thỏa ngưỡng mức trên -> nâng 1 bậc.
 * Check thiếu dữ liệu TRƯỚC xếp loại: <6 môn tính điểm -> 'thieu_mon';
 * môn chưa chốt / nhận xét thiếu -> 'thieu_diem'.
 */
export function hocLucYear(
  scored: ScoredSubjectYear[],
  comments: CommentYearResult[],
): { value: YearRating | null; missing: Missing } {
  if (scored.length < 6) return { value: null, missing: "thieu_mon" };
  if (
    scored.some((s) => !s.yearFinal || s.dtmCn == null) ||
    comments.some((c) => c === "missing")
  ) {
    return { value: null, missing: "thieu_diem" };
  }
  const scores = scored.map((s) => s.dtmCn as number);
  const cdComments = comments.filter((c) => c === "chua_dat").length;

  const base: YearRating =
    cdComments === 0 &&
    scores.every((x) => x >= 6.5) &&
    scores.filter((x) => x >= 8).length >= 6
      ? "tot"
      : cdComments === 0 &&
          scores.every((x) => x >= 5) &&
          scores.filter((x) => x >= 6.5).length >= 6
        ? "kha"
        : cdComments <= 1 &&
            scores.filter((x) => x >= 5).length >= 6 &&
            scores.every((x) => x >= 3.5)
          ? "dat"
          : "chua_dat";

  if (base === "tot") return { value: base, missing: null };

  // Đ.9.3: base bi keo xuong >=2 muc so voi Tốt/Khá do ĐÚNG 1 môn (tính điểm
  // hoặc nhận xét) - loại môn đó thì phần còn lại đạt mức cao -> nâng base
  // lên đúng 1 bậc.
  const satisfies = (
    target: "tot" | "kha",
    ss: number[],
    cd: number,
  ): boolean =>
    target === "tot"
      ? cd === 0 &&
        ss.every((x) => x >= 6.5) &&
        ss.filter((x) => x >= 8).length >= 6
      : cd === 0 &&
        ss.every((x) => x >= 5) &&
        ss.filter((x) => x >= 6.5).length >= 6;

  // base 'tot' da return som; 'kha' khong bao gio vao loop (diff < 2)
  // -> thuc te chi con 'dat' | 'chua_dat'.
  const levelUp = (r: YearRating): YearRating =>
    r === "chua_dat" ? "dat" : "kha";

  let v: YearRating = base;
  for (const target of ["tot", "kha"] as const) {
    if (RATING_RANK[target] - RATING_RANK[base] < 2) continue;
    const viaScore = scores.some((_, i) =>
      satisfies(target, scores.filter((_, j) => j !== i), cdComments),
    );
    const viaComment =
      cdComments === 1 && satisfies(target, scores, cdComments - 1);
    if (viaScore || viaComment) {
      v = levelUp(base);
      break;
    }
  }
  return { value: v, missing: null };
}

/** Đ.8 - Kết quả rèn luyện cả năm từ HK1/HK2 (bảng 16 cặp). */
export function renLuyenYear(
  hk1: YearRating | null,
  hk2: YearRating | null,
): { value: YearRating | null; missing: Missing } {
  if (!hk1 || !hk2) return { value: null, missing: "thieu_hanh_kiem" };
  const T: Record<YearRating, Record<YearRating, YearRating>> = {
    // hk2 -> hk1
    tot: { tot: "tot", kha: "tot", dat: "kha", chua_dat: "kha" },
    kha: { tot: "kha", kha: "kha", dat: "kha", chua_dat: "dat" },
    dat: { tot: "kha", kha: "dat", dat: "dat", chua_dat: "dat" },
    chua_dat: { tot: "chua_dat", kha: "chua_dat", dat: "chua_dat", chua_dat: "chua_dat" },
  };
  return { value: T[hk2][hk1], missing: null };
}

/**
 * Đ.15 - Danh hiệu: Xuất sắc = KQRL Tốt + KQHT Tốt + >=6 môn ĐTBmcn >=9.0;
 * Giỏi = KQRL Tốt + KQHT Tốt. Giấy khen thủ công - không tính ở đây.
 */
export function danhHieu(
  kqht: YearRating | null,
  kqrl: YearRating | null,
  scored: ScoredSubjectYear[],
): "xuat_sac" | "gioi" | null {
  if (kqht !== "tot" || kqrl !== "tot") return null;
  const n9 = scored.filter((s) => s.dtmCn != null && s.dtmCn >= 9).length;
  return n9 >= 6 ? "xuat_sac" : "gioi";
}

/**
 * Đ.10-14 - Gợi ý xét lên lớp. Thứ tự cố định, không chồng nhánh:
 * >45 buổi vắng -> o_lai (mọi stage, không đánh giá lại/rèn hè nữa).
 * Mỗi phương án rèn luyện tối đa 1 lần.
 */
export function xetLenLop(i: {
  stage: YearStage;
  kqht: YearRating | null;
  kqrl: YearRating | null;
  absentSessions: number;
  hasPriorRetest: boolean;
}): { value: Promotion | null; missing: Missing } {
  if (i.kqht == null) return { value: null, missing: "thieu_diem" };
  if (i.kqrl == null) return { value: null, missing: "thieu_hanh_kiem" };
  if (i.absentSessions > 45) return { value: "o_lai", missing: null };

  if (i.stage === "initial") {
    if (i.kqrl === "chua_dat") return { value: "ren_luyen_he", missing: null };
    if (i.kqht === "chua_dat")
      return { value: "kiem_tra_danh_gia_lai", missing: null };
  } else if (i.stage === "after_summer") {
    if (i.kqrl === "chua_dat") return { value: "o_lai", missing: null };
    if (i.kqht === "chua_dat") {
      return {
        value: i.hasPriorRetest ? "o_lai" : "kiem_tra_danh_gia_lai",
        missing: null,
      };
    }
  } else {
    // after_retest
    if (i.kqrl === "chua_dat" || i.kqht === "chua_dat")
      return { value: "o_lai", missing: null };
  }
  return { value: "len_lop", missing: null };
}
