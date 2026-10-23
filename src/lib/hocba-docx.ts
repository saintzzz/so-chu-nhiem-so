import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, PageBreak,
} from "docx";
import type { YearEndBundle, YearEndDecision } from "@/lib/hocba";

const RATING_VN: Record<string, string> = {
  tot: "Tốt", kha: "Khá", dat: "Đạt", chua_dat: "Chưa đạt",
};
const PROMO_VN: Record<string, string> = {
  len_lop: "Được lên lớp",
  kiem_tra_danh_gia_lai: "Kiểm tra / đánh giá lại",
  ren_luyen_he: "Rèn luyện hè",
  o_lai: "Ở lại lớp",
};
const TITLE_VN: Record<string, string> = {
  xuat_sac: "Học sinh Xuất sắc", gioi: "Học sinh Giỏi",
};

/** Model trung gian - dung chung cho DOCX va PDF. */
export interface HocBaModel {
  schoolName: string;
  className: string;
  yearName: string;
  student: { name: string; code: string; dob: string; gender: string };
  grades: { subject: string; hk1: string; hk2: string; cn: string }[];
  conduct: { hk1: string; hk2: string; cn: string; comment: string };
  nlpc: string[];
  attendance: { excused: number; unexcused: number; total: number };
  result: {
    kqht: string; kqrl: string; danhHieu: string; promotion: string;
    giayKhen: string | null; approved: boolean;
  };
}

export function buildHocBaModel(
  bundle: YearEndBundle,
  ctx: { schoolName: string; className: string; yearName: string },
): HocBaModel {
  const dec: YearEndDecision | undefined =
    bundle.decisions[bundle.decisions.length - 1];
  const s = bundle.student;
  const rat = (v: string | null | undefined, fb: string | null | undefined) =>
    v ? (RATING_VN[v] ?? v) : (fb ?? "Chưa đủ dữ liệu");
  return {
    ...ctx,
    student: {
      name: s.full_name,
      code: s.code ?? "-",
      dob: s.dob ?? "-",
      gender: s.gender === "nam" ? "Nam" : s.gender === "nu" ? "Nữ" : "-",
    },
    grades: bundle.subjectRows.map((r) => ({
      subject: r.name + (r.isExempt ? " (miễn)" : ""),
      hk1: r.isComment
        ? r.resultHk1 === "dat" ? "Đạt" : r.resultHk1 === "chua_dat" ? "Chưa đạt" : "-"
        : r.hk1 != null ? r.hk1.toFixed(1) : "-",
      hk2: r.isComment
        ? r.resultHk2 === "dat" ? "Đạt" : r.resultHk2 === "chua_dat" ? "Chưa đạt" : "-"
        : r.hk2 != null ? r.hk2.toFixed(1) : "-",
      cn: r.isComment
        ? r.resultYear === "dat" ? "Đạt" : r.resultYear === "chua_dat" ? "Chưa đạt" : "-"
        : r.cn != null ? r.cn.toFixed(1) : "-",
    })),
    conduct: {
      hk1: rat(bundle.conductHk1, "-"),
      hk2: rat(bundle.conductHk2, "-"),
      cn: rat(dec?.kqrl ?? bundle.computed.kqrl.value, "Chưa đủ dữ liệu"),
      comment: bundle.conductComment ?? "-",
    },
    nlpc: [
      ...bundle.nlpcEvals.map((e) => `${e.attribute_code}: ${e.level}`),
      ...bundle.nlpcComments.map((c) => `${c.grp}: ${c.comment}`),
    ],
    attendance: {
      excused: bundle.absentExcused,
      unexcused: bundle.absentUnexcused,
      total: bundle.absentTotal,
    },
    result: {
      kqht: rat(dec?.kqht ?? bundle.computed.kqht.value, "Chưa đủ dữ liệu"),
      kqrl: rat(dec?.kqrl ?? bundle.computed.kqrl.value, "Chưa đủ dữ liệu"),
      danhHieu: dec?.danh_hieu
        ? TITLE_VN[dec.danh_hieu]
        : bundle.computed.danhHieu ? `${TITLE_VN[bundle.computed.danhHieu]} (gợi ý)` : "-",
      promotion: dec?.promotion
        ? PROMO_VN[dec.promotion]
        : bundle.computed.promotion.value
          ? `${PROMO_VN[bundle.computed.promotion.value]} (gợi ý)`
          : "Chưa đủ dữ liệu",
      giayKhen: dec?.giay_khen_note ?? null,
      approved: dec?.status === "approved" || dec?.status === "locked",
    },
  };
}

// ---------------- DOCX ----------------

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function p(text: string, opts: { bold?: boolean; italics?: boolean; center?: boolean } = {}) {
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : undefined,
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics })],
  });
}

function gradeTable(m: HocBaModel): Table {
  const hdr = ["Môn học", "Học kỳ 1", "Học kỳ 2", "Cả năm"];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: hdr.map((h) =>
          new TableCell({
            borders: cellBorders,
            children: [p(h, { bold: true, center: true })],
          }),
        ),
      }),
      ...m.grades.map(
        (g) =>
          new TableRow({
            children: [
              new TableCell({ borders: cellBorders, children: [p(g.subject)] }),
              new TableCell({ borders: cellBorders, children: [p(g.hk1, { center: true })] }),
              new TableCell({ borders: cellBorders, children: [p(g.hk2, { center: true })] }),
              new TableCell({ borders: cellBorders, children: [p(g.cn, { bold: true, center: true })] }),
            ],
          }),
      ),
    ],
  });
}

function signBlock(): Paragraph[] {
  return [
    new Paragraph({ children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "Giáo viên chủ nhiệm", bold: true }),
        new TextRun({ text: "                              " }),
        new TextRun({ text: "Hiệu trưởng", bold: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "(Ký, ghi rõ họ tên)                    (Ký, đóng dấu)", italics: true })],
    }),
  ];
}

/** 1 hoc ba = Paragraph/Table[]. multi -> page-break giua cac em. */
function hocBaBlocks(m: HocBaModel): (Paragraph | Table)[] {
  const blocks: (Paragraph | Table)[] = [
    p(m.schoolName.toUpperCase(), { bold: true, center: true }),
    p("HỌC BẠ SỐ - TỔNG HỢP CUỐI NĂM HỌC", { bold: true, center: true }),
    p(`Lớp: ${m.className}    Năm học: ${m.yearName}`, { center: true }),
    new Paragraph({ children: [] }),
    p(`Họ và tên: ${m.student.name}`, { bold: true }),
    p(`Mã học sinh: ${m.student.code}    Ngày sinh: ${m.student.dob}    Giới tính: ${m.student.gender}`),
    new Paragraph({ children: [] }),
    p("I. KẾT QUẢ HỌC TẬP", { bold: true }),
    gradeTable(m),
    new Paragraph({ children: [] }),
    p("II. KẾT QUẢ RÈN LUYỆN", { bold: true }),
    p(`Học kỳ 1: ${m.conduct.hk1}    Học kỳ 2: ${m.conduct.hk2}    Cả năm: ${m.conduct.cn}`),
    p(`Nhận xét của giáo viên chủ nhiệm: ${m.conduct.comment}`),
    new Paragraph({ children: [] }),
    p("III. NĂNG LỰC PHẨM CHẤT", { bold: true }),
    ...(m.nlpc.length ? m.nlpc.map((t) => p(t)) : [p("Chưa đánh giá.")]),
    new Paragraph({ children: [] }),
    p("IV. CHUYÊN CẦN", { bold: true }),
    p(`Vắng có phép: ${m.attendance.excused} buổi    Không phép: ${m.attendance.unexcused} buổi    Tổng: ${m.attendance.total} buổi`),
    new Paragraph({ children: [] }),
    p("V. XẾP LOẠI VÀ QUYẾT ĐỊNH CUỐI NĂM", { bold: true }),
    p(`Kết quả học tập: ${m.result.kqht}`),
    p(`Kết quả rèn luyện: ${m.result.kqrl}`),
    p(`Danh hiệu: ${m.result.danhHieu}`),
    p(`Quyết định: ${m.result.promotion}`, { bold: true }),
    ...(m.result.giayKhen ? [p(`Giấy khen: ${m.result.giayKhen}`)] : []),
    ...signBlock(),
  ];
  if (!m.result.approved) {
    blocks.unshift(
      p("BẢN NHÁP - CHƯA DUYỆT", { bold: true, center: true }),
      new Paragraph({ children: [] }),
    );
  }
  return blocks;
}

/** 1 hoac nhieu hoc ba trong 1 file DOCX (page-break per em). */
export async function hocBaDocx(models: HocBaModel[]): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];
  models.forEach((m, i) => {
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...hocBaBlocks(m));
  });
  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}
