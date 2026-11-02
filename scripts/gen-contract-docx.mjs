/**
 * Render hop dong hop tac dau tu ca nhan - 2 phuong an in san:
 *   docs/handover/HOP-DONG-HOP-TAC-DAU-TU-PA1.{md,docx}
 *   docs/handover/HOP-DONG-HOP-TAC-DAU-TU-PA2.{md,docx}
 * tu template docs/handover/HOP-DONG-HOP-TAC-DAU-TU-TEMPLATE.md ({{TOKEN}}).
 * node scripts/gen-contract-docx.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, BorderStyle,
} from "docx";

const TPL = "docs/handover/HOP-DONG-HOP-TAC-DAU-TU-TEMPLATE.md";
const FONT = "Times New Roman";

const VARIANTS = {
  PA1: {
    PA_CODE: "PA-1",
    CONTRIBUTION: "414 725 000",
    CONTRIBUTION_WORDS:
      "bốn trăm mười bốn triệu bảy trăm hai mươi lăm nghìn đồng",
    PA_SCOPE: "chi phí Phần B - giai đoạn phát triển 03/11/2026 - 18/04/2027",
    REVSHARE_B: "40",
    REVSHARE_A: "60",
    EQUITY_PCT: "12.5",
    EQUITY_RANGE: "10-15%",
    MAINT_SCOPE: "Phần B và Phần C (Phần C do Bên A tự tài trợ)",
    BUDGET_SCOPE: "Phần B",
  },
  PA2: {
    PA_CODE: "PA-2",
    CONTRIBUTION: "997 475 000",
    CONTRIBUTION_WORDS:
      "chín trăm chín mươi bảy triệu bốn trăm bảy mươi lăm nghìn đồng",
    PA_SCOPE:
      "tổng chi phí Phần B và Phần C - giai đoạn phát triển và bảo trì đến T01/2029",
    REVSHARE_B: "45",
    REVSHARE_A: "55",
    EQUITY_PCT: "17.5",
    EQUITY_RANGE: "15-20%",
    MAINT_SCOPE: "Phần B và Phần C (T05/2027 - T01/2029)",
    BUDGET_SCOPE: "Phần B và Phần C",
  },
};

function renderMd(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) =>
    k in vars ? vars[k] : m,
  );
}

function runs(text, { bold = false, italics = false } = {}) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map(
      (p) =>
        new TextRun({
          text: p.replace(/^\*\*|\*\*$/g, ""),
          bold: bold || (p.startsWith("**") && p.endsWith("**")),
          italics,
          font: FONT,
        }),
    );
}

function toDocx(md) {
  const paras = [];
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (line === "---") {
      paras.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" } }, spacing: { after: 160 } }));
    } else if (line.startsWith("## ")) {
      paras.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: runs(line.slice(3), { bold: true }) }));
    } else if (line.startsWith("# ")) {
      paras.push(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: runs(line.slice(2), { bold: true }) }));
    } else if (line.startsWith("- ")) {
      paras.push(new Paragraph({ bullet: { level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, children: runs(line.slice(2)) }));
    } else if (line.startsWith("*") && line.endsWith("*")) {
      paras.push(new Paragraph({ spacing: { before: 200 }, children: runs(line.slice(1, -1), { italics: true }) }));
    } else {
      paras.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 }, children: runs(line) }));
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
    sections: [{ children: paras }],
  });
}

const template = readFileSync(TPL, "utf8");
mkdirSync("docs/handover", { recursive: true });
for (const [key, vars] of Object.entries(VARIANTS)) {
  const md = renderMd(template, vars);
  const leftover = md.match(/\{\{\w+\}\}/g);
  if (leftover) throw new Error(`${key}: unresolved tokens ${leftover}`);
  const base = `docs/handover/HOP-DONG-HOP-TAC-DAU-TU-${key}`;
  writeFileSync(`${base}.md`, md);
  writeFileSync(`${base}.docx`, await Packer.toBuffer(toDocx(md)));
  console.log(`Written ${base}.{md,docx}`);
}
