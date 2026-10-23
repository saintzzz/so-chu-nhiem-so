import "server-only";
import type { HocBaModel } from "@/lib/hocba-docx";

/**
 * PDF qua pdfmake server-side - font Roboto bundle trong vfs_fonts
 * (du dau tieng Viet + 4 style). Cung HocBaModel voi DOCX de khop noi dung.
 */
export async function hocBaPdf(models: HocBaModel[]): Promise<Buffer> {
  const pdfMakeModule = await import("pdfmake/build/pdfmake");
  const vfsModule = await import("pdfmake/build/vfs_fonts");
  const pdfMake = (pdfMakeModule.default ?? pdfMakeModule) as unknown as {
    vfs: Record<string, string>;
    createPdf: (doc: unknown) => { getBuffer: (cb: (b: Buffer) => void) => void };
  };
  const vfs = (vfsModule.default ?? vfsModule) as unknown as {
    pdfMake?: { vfs: Record<string, string> };
  } & Record<string, string>;
  pdfMake.vfs = vfs.pdfMake?.vfs ?? vfs;

  const content: unknown[] = [];
  models.forEach((m, i) => {
    const pageBreak = i > 0 ? { pageBreak: "before" as const } : {};
    content.push(
      ...(m.result.approved
        ? []
        : [{ text: "BẢN NHÁP - CHƯA DUYỆT", bold: true, alignment: "center", color: "#B45309", fontSize: 13, margin: [0, 0, 0, 8] }]),
      { text: m.schoolName.toUpperCase(), bold: true, alignment: "center", ...pageBreak },
      { text: "HỌC BẠ SỐ - TỔNG HỢP CUỐI NĂM HỌC", bold: true, alignment: "center", fontSize: 14 },
      { text: `Lớp: ${m.className}    Năm học: ${m.yearName}`, alignment: "center", margin: [0, 0, 0, 12] },
      { text: `Họ và tên: ${m.student.name}`, bold: true },
      { text: `Mã học sinh: ${m.student.code}    Ngày sinh: ${m.student.dob}    Giới tính: ${m.student.gender}`, margin: [0, 0, 0, 10] },
      { text: "I. KẾT QUẢ HỌC TẬP", bold: true, margin: [0, 6, 0, 4] },
      {
        table: {
          headerRows: 1,
          widths: ["*", "auto", "auto", "auto"],
          body: [
            ["Môn học", "Học kỳ 1", "Học kỳ 2", "Cả năm"].map((h) => ({ text: h, bold: true, alignment: "center" })),
            ...m.grades.map((g) => [g.subject, { text: g.hk1, alignment: "center" }, { text: g.hk2, alignment: "center" }, { text: g.cn, bold: true, alignment: "center" }]),
          ],
        },
        margin: [0, 0, 0, 10],
      },
      { text: "II. KẾT QUẢ RÈN LUYỆN", bold: true, margin: [0, 6, 0, 4] },
      { text: `Học kỳ 1: ${m.conduct.hk1}    Học kỳ 2: ${m.conduct.hk2}    Cả năm: ${m.conduct.cn}` },
      { text: `Nhận xét của giáo viên chủ nhiệm: ${m.conduct.comment}`, margin: [0, 0, 0, 10] },
      { text: "III. NĂNG LỰC PHẨM CHẤT", bold: true, margin: [0, 6, 0, 4] },
      ...(m.nlpc.length ? m.nlpc.map((t) => ({ text: t })) : [{ text: "Chưa đánh giá." }]),
      { text: "IV. CHUYÊN CẦN", bold: true, margin: [0, 12, 0, 4] },
      { text: `Vắng có phép: ${m.attendance.excused} buổi    Không phép: ${m.attendance.unexcused} buổi    Tổng: ${m.attendance.total} buổi` },
      { text: "V. XẾP LOẠI VÀ QUYẾT ĐỊNH CUỐI NĂM", bold: true, margin: [0, 12, 0, 4] },
      { text: `Kết quả học tập: ${m.result.kqht}` },
      { text: `Kết quả rèn luyện: ${m.result.kqrl}` },
      { text: `Danh hiệu: ${m.result.danhHieu}` },
      { text: `Quyết định: ${m.result.promotion}`, bold: true },
      ...(m.result.giayKhen ? [{ text: `Giấy khen: ${m.result.giayKhen}` }] : []),
      {
        columns: [
          { text: "Giáo viên chủ nhiệm\n(Ký, ghi rõ họ tên)", bold: true, alignment: "center" },
          { text: "Hiệu trưởng\n(Ký, đóng dấu)", bold: true, alignment: "center" },
        ],
        margin: [0, 28, 0, 0],
      },
    );
  });

  const doc = {
    content,
    defaultStyle: { font: "Roboto", fontSize: 11 },
    pageMargins: [48, 48, 48, 48],
  };
  return new Promise((resolve, reject) => {
    pdfMake.createPdf(doc).getBuffer((b) => resolve(b));
    setTimeout(() => reject(new Error("pdf timeout")), 30_000);
  });
}
