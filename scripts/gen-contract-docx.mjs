/**
 * Render hop dong hop tac dau tu ca nhan - 2 phuong an in san (final):
 *   docs/handover/HOP-DONG-HOP-TAC-DAU-TU-PA1.{md,docx}
 *   docs/handover/HOP-DONG-HOP-TAC-DAU-TU-PA2.{md,docx}
 * tu template docs/handover/HOP-DONG-HOP-TAC-DAU-TU-TEMPLATE.md.
 * So lieu phu luc tinh tu code - khong go tay.
 * node scripts/gen-contract-docx.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, Packer,
  PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";

const TPL = "docs/handover/HOP-DONG-HOP-TAC-DAU-TU-TEMPLATE.md";
const FONT = "Times New Roman";
const fmt = (n) => n.toLocaleString("vi-VN").replace(/\./g, " ").replace(/,/g, " ");

/* ---------- So lieu ngan sach (theo PROPOSAL-tong-dau-tu-2ty8 ngay 02/11/2026) ---------- */
const BUDGET_B = [
  ["Khoản chi Phần B", "Allocation", "Rate (VND/th)", "5.5 tháng (VND)"],
  ["Nhân sự - Bình (Fullstack lead)", "100%", "55 000 000", "302 500 000"],
  ["Nhân sự - Phiên (Backend)", "100%", "40 000 000", "220 000 000"],
  ["Nhân sự - Lan (QA/Tester)", "100%", "25 000 000", "137 500 000"],
  ["Nhân sự - PM/BA", "30%", "30 000 000", "49 500 000"],
  ["Cộng nhân sự", "", "", "709 500 000"],
  ["Supabase Pro + compute Small", "", "~2 500 000", "13 750 000"],
  ["Vercel Pro", "", "~600 000", "3 300 000"],
  ["AI API (gen bank, KHBĐ)", "", "~4 000 000", "22 000 000"],
  ["Domain + Resend + monitoring", "", "~1 000 000", "5 500 000"],
  ["Dự phòng ~10% (phát sinh pilot)", "", "", "75 400 000"],
  ["TỔNG PHẦN B", "", "", "829 450 000"],
];
const BUDGET_C = [
  ["Khoản chi Phần C", "Allocation", "Rate (VND/th)", "21 tháng (VND)"],
  ["Nhân sự - Bình (oncall/hotfix/CR nhỏ)", "70%", "55 000 000", "808 500 000"],
  ["Nhân sự - Lan (QA regression mỗi release)", "20%", "25 000 000", "105 000 000"],
  ["Nhân sự - PM/BA (triage + báo cáo)", "10%", "30 000 000", "63 000 000"],
  ["Cộng nhân sự", "", "", "976 500 000"],
  ["Hạ tầng (Supabase/Vercel/domain/email)", "", "~6 000 000", "126 000 000"],
  ["AI API vận hành", "", "~3 000 000", "63 000 000"],
  ["TỔNG PHẦN C", "", "", "1 165 500 000"],
];

const MILESTONES = [
  ["Milestone", "Deliverable", "Tiêu chí nghiệm thu"],
  ["M2 - Pilot (dự kiến T12/2026)", "3-5 trường thật đăng nhập + nhập liệu thật; đào tạo GV", "Trường pilot vận hành thật trên production; SLA hotfix trong ngày"],
  ["M3 - Vận hành (dự kiến T02/2027)", "Báo cáo DPIA/bảo mật + runbook vận hành + cổng thanh toán test", "External review pass; handover docs hoàn chỉnh; payment path test xong"],
  ["M4 - Launch (dự kiến 18/04/2027)", "Onboarding self-serve + sản phẩm sẵn sàng bán commercial", "Đăng ký + nạp dữ liệu tự phục vụ chạy E2E; billing path verified"],
];

function pa1Tranches() {
  const T = 414_725_000;
  return [
    ["Đợt", "Thời điểm / Điều kiện giải ngân", "Tỷ lệ", "Số tiền (VND)"],
    ["1", "Ký hợp đồng (dự kiến T11/2026)", "30%", fmt(Math.round(T * 0.30))],
    ["2", "Nghiệm thu M2 - pilot 3-5 trường (dự kiến T12/2026)", "25%", fmt(Math.round(T * 0.25))],
    ["3", "Nghiệm thu M3 - DPIA + runbook + payment path (dự kiến T02/2027)", "25%", fmt(Math.round(T * 0.25))],
    ["4", "Nghiệm thu tổng Phần B - commercial launch (dự kiến 18/04/2027)", "20%", fmt(T - Math.round(T * 0.30) - 2 * Math.round(T * 0.25))],
    ["TỔNG", "", "100%", fmt(T)],
  ];
}
const C_QUARTERS = ["T05-T07/2027", "T08-T10/2027", "T11/2027-T01/2028", "T02-T04/2028", "T05-T07/2028", "T08-T10/2028", "T11/2028-T01/2029"];
function pa2Tranches() {
  const b = pa1Tranches().slice(0, -1);
  const cPart = 582_750_000;
  const rows = C_QUARTERS.map((q, i) => [
    String(5 + i), `Hết quý Phần C (${q}) + báo cáo burn-rate quý`, "-", fmt(Math.round(cPart / 7)),
  ]);
  rows[rows.length - 1][3] = fmt(cPart - Math.round(cPart / 7) * 6);
  return [...b, ...rows, ["TỔNG", "", "", fmt(997_475_000)]];
}

function acceptMinutes() {
  return [
    "",
    "**MẪU BIÊN BẢN NGHIỆM THU MILESTONE**",
    "",
    "Biên bản nghiệm thu milestone số: ...... - Ngày ... tháng ... năm 20...",
    "",
    "Hai bên: Bên A (bên phát triển) và Bên B (nhà đầu tư) theo hợp đồng số .../HĐHT-2026/...",
    "",
    "Nội dung milestone: ............................................................................",
    "",
    "Kết quả kiểm tra: đạt / đạt có điều kiện / chưa đạt - ghi chú: ....................................",
    "",
    "Kết luận: milestone được nghiệm thu / yêu cầu hoàn thiện trước ngày ...............................",
    "",
    "Đợt giải ngân liên quan được/không được kích hoạt theo Phụ lục 2.",
    "",
    "«SIG»",
  ].join("\n");
}

const tableMd = (t) =>
  t.map((r, i) => `| ${r.join(" | ")} |${i === 0 ? `\n| ${r.map(() => "---").join(" | ")} |` : ""}`).join("\n");

function annexes(v) {
  const budgetRows = v.key === "PA1" ? [BUDGET_B] : [BUDGET_B, BUDGET_C];
  const budgetMd = budgetRows.map(tableMd).join("\n\n");
  const trancheMd = tableMd(v.key === "PA1" ? pa1Tranches() : pa2Tranches());
  const milestoneMd = tableMd(MILESTONES);
  return `
## PHỤ LỤC 1 - NGÂN SÁCH CHI TIẾT ${v.BUDGET_SCOPE.toUpperCase()}
(Kèm theo hợp đồng số .../HĐHT-2026/${v.PA_CODE})

${budgetMd}

Ghi chú: số liệu căn cứ tài liệu đề xuất kinh phí ngày 02/11/2026; ngân sách là khung trần, điều chỉnh nội bộ giữa các dòng không vượt 15% theo Điều 4.4.

## PHỤ LỤC 2 - TIẾN ĐỘ GIẢI NGÂN VÀ NGHIỆM THU
(Kèm theo hợp đồng số .../HĐHT-2026/${v.PA_CODE})

**Bảng 1 - Đợt giải ngân:**

${trancheMd}

**Bảng 2 - Milestone và tiêu chí nghiệm thu:**

${milestoneMd}
${v.key === "PA2" ? "\nCác đợt giải ngân Phần C (đợt 5-11) chỉ yêu cầu báo cáo burn-rate quý theo Điều 4.2, không gắn milestone sản phẩm.\n" : ""}
${acceptMinutes()}

## PHỤ LỤC 3 - XÁC NHẬN PHƯƠNG ÁN HỢP TÁC ${v.PA_CODE}
(Kèm theo hợp đồng số .../HĐHT-2026/${v.PA_CODE})

Hai bên xác nhận chọn và áp dụng các thông số sau của phương án ${v.PA_CODE}:

| Nội dung | Giá trị |
| --- | --- |
| Khoản góp của Bên B | ${v.CONTRIBUTION} VND (${v.CONTRIBUTION_WORDS}) |
| Tỷ trọng trong ngân sách | 50% ${v.BUDGET_SCOPE_SHORT} |
| Tỷ lệ chia doanh thu thuần | Bên B ${v.REVSHARE_B}% - Bên A ${v.REVSHARE_A}% |
| Thời kỳ chia doanh thu | 24 tháng liên tiếp từ khách hàng trả phí đầu tiên |
| Cổ phần/vốn góp tương lai | ${v.EQUITY_PCT}% khi thành lập pháp nhân, vesting từ ngày ký hợp đồng |
| Sweat equity Bên A (Phần A) | ~859 500 000 VND - không hoàn, không khấu trừ |

Xác nhận ngày ... tháng ... năm 20...

«SIG»

## PHỤ LỤC 4 - DANH MỤC TÀI SẢN DỰ ÁN TẠI NGÀY KÝ
(Kèm theo hợp đồng số .../HĐHT-2026/${v.PA_CODE})

| Tài sản | Định danh / Mô tả |
| --- | --- |
| Mã nguồn | Kho git private github.com/saintzzz/so-chu-nhiem-so |
| Tên miền | vieschool.com; sochunhiem.vieschool.com |
| Hosting | Vercel project saintzzz/so-chu-nhiem-so - auto-deploy từ nhánh master |
| Cơ sở dữ liệu | Supabase Postgres production - multi-tenant, RLS theo trường |
| Email giao dịch | Resend - thông báo phụ huynh |
| Hạ tầng AI | Providers cấu hình qua biến môi trường (Gemini/OpenAI/Anthropic/OpenRouter) + fallback |
| Tenant đang vận hành | 3 trường demo + 1 tenant trial TRIAL01 |
| Tài liệu kỹ thuật | Thư mục docs/ trong repo: PRD, ARCHITECTURE, ROLE-MATRIX, QA-REPORT, 77+ CR, backlog tích hợp |
| Tài khoản dịch vụ khác | Liệt kê và bàn giao khi ký theo biên bản bảo mật riêng |
`;
}

const VARIANTS = {
  PA1: {
    key: "PA1",
    PA_CODE: "PA-1",
    CONTRIBUTION: "414 725 000",
    CONTRIBUTION_WORDS: "bốn trăm mười bốn triệu bảy trăm hai mươi lăm nghìn đồng",
    PA_SCOPE: "chi phí Phần B - giai đoạn phát triển 03/11/2026 - 18/04/2027",
    REVSHARE_B: "40",
    REVSHARE_A: "60",
    EQUITY_PCT: "12.5",
    MAINT_SCOPE: "Phần B và Phần C (Phần C do Bên A tự tài trợ)",
    BUDGET_SCOPE: "Phần B",
    BUDGET_SCOPE_SHORT: "Phần B",
  },
  PA2: {
    key: "PA2",
    PA_CODE: "PA-2",
    CONTRIBUTION: "997 475 000",
    CONTRIBUTION_WORDS: "chín trăm chín mươi bảy triệu bốn trăm bảy mươi lăm nghìn đồng",
    PA_SCOPE: "tổng chi phí Phần B và Phần C - giai đoạn phát triển và bảo trì đến T01/2029",
    REVSHARE_B: "45",
    REVSHARE_A: "55",
    EQUITY_PCT: "17.5",
    MAINT_SCOPE: "Phần B và Phần C (T05/2027 - T01/2029)",
    BUDGET_SCOPE: "Phần B và Phần C",
    BUDGET_SCOPE_SHORT: "(Phần B + Phần C)",
  },
};

/* ---------- md -> docx ---------- */
function runs(text, { bold = false, italics = false } = {}) {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((p) => {
      const strong = p.startsWith("**") && p.endsWith("**");
      const em = !strong && p.startsWith("*") && p.endsWith("*");
      return new TextRun({
        text: strong || em ? p.slice(strong ? 2 : 1, strong ? -2 : -1) : p,
        bold: bold || strong,
        italics: italics || em,
        font: FONT,
      });
    });
}

const P = (children, opts = {}) =>
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 }, ...opts, children });

function sigTable() {
  const cell = (title) =>
    new TableCell({
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, bold: true, font: FONT })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(Ký, ghi rõ họ tên)", italics: true, font: FONT })] }),
        ...Array.from({ length: 4 }, () => new Paragraph({ children: [] })),
      ],
    });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [cell("BÊN A"), cell("BÊN B")] })] });
}

function makeTable(rows) {
  const noBorder = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows
      .filter((_, i) => i !== 1) // skip |---| separator
      .map((r, i) => {
        const isHeader = i === 0;
        const isTotal = /TỔNG/.test(r[0]);
        return new TableRow({
          children: r.map(
            (c) =>
              new TableCell({
                shading: isHeader ? { type: ShadingType.SOLID, color: "e8e8e8" } : isTotal ? { type: ShadingType.SOLID, color: "f3f3f3" } : undefined,
                borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
                children: [P(runs(c.trim(), { bold: isHeader || isTotal }), { alignment: AlignmentType.LEFT, spacing: { after: 20 } })],
              }),
          ),
        });
      }),
  });
}

function toDocx(md) {
  const children = [];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (!line.trim()) continue;
    if (line === "«NATIONAL_HEADER»") {
      children.push(
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, font: FONT, size: 26 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: "Độc lập - Tự do - Hạnh phúc", font: FONT, size: 24, underline: {} })] }),
      );
    } else if (line === "«SIG»") {
      children.push(sigTable());
    } else if (line.startsWith("|")) {
      const block = [];
      while (i < lines.length && lines[i].trimEnd().startsWith("|")) block.push(lines[i++].trimEnd());
      i--;
      children.push(makeTable(block.map((l) => l.slice(1, -1).split("|"))));
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    } else if (line.startsWith("## ")) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER, spacing: { before: 300, after: 160 }, children: runs(line.slice(3), { bold: true }) }));
    } else if (line.startsWith("# ")) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: runs(line.slice(2), { bold: true }) }));
    } else if (line.startsWith("- ")) {
      children.push(P(runs(line.slice(2)), { bullet: { level: 0 }, spacing: { after: 80 } }));
    } else {
      children.push(P(runs(line)));
    }
  }
  return new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 26 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", run: { font: FONT, size: 30, bold: true } },
        { id: "Heading2", name: "Heading 2", run: { font: FONT, size: 26, bold: true } },
      ],
    },
    sections: [{
      children,
      footers: {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })],
        }),
      },
    }],
  });
}

/* ---------- render ---------- */
const template = readFileSync(TPL, "utf8");
mkdirSync("docs/handover", { recursive: true });
for (const v of Object.values(VARIANTS)) {
  let md = template
    .replace("{{NATIONAL_HEADER}}", "«NATIONAL_HEADER»")
    .replace("{{SIGNATURE_BLOCK}}", "«SIG»")
    .replace("{{ANNEXES}}", annexes(v));
  md = md.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in v ? String(v[k]) : m));
  const leftover = md.match(/\{\{\w+\}\}/g);
  if (leftover) throw new Error(`${v.key}: unresolved ${leftover}`);
  const base = `docs/handover/HOP-DONG-HOP-TAC-DAU-TU-${v.key}`;
  writeFileSync(
    `${base}.md`,
    md
      .replace("«NATIONAL_HEADER»", "**CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**\n**Độc lập - Tự do - Hạnh phúc**")
      .replace(/«SIG»/g, "**BÊN A** (Ký, ghi rõ họ tên)                    **BÊN B** (Ký, ghi rõ họ tên)"),
  );
  writeFileSync(`${base}.docx`, await Packer.toBuffer(toDocx(md)));
  console.log(`Written ${base}.{md,docx}`);
}
