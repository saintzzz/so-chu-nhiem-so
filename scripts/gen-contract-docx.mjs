/**
 * Parse docs/handover/HOP-DONG-HOP-TAC-DAU-TU-CA-NHAN.md -> .docx
 * Minimal md parser: # H1, ## H2, - bullet, **bold** inline, --- hr, *italic* note.
 * node scripts/gen-contract-docx.mjs
 */
import { readFileSync, mkdirSync } from "node:fs";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, BorderStyle,
} from "docx";
import { writeFileSync } from "node:fs";

const SRC = "docs/handover/HOP-DONG-HOP-TAC-DAU-TU-CA-NHAN.md";
const OUT = "docs/handover/HOP-DONG-HOP-TAC-DAU-TU-CA-NHAN.docx";
const FONT = "Times New Roman";

function runs(text, { bold = false, italics = false } = {}) {
  // split **bold** segments
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p) =>
    new TextRun({
      text: p.replace(/^\*\*|\*\*$/g, ""),
      bold: bold || (p.startsWith("**") && p.endsWith("**")),
      italics,
      font: FONT,
    }),
  );
}

const lines = readFileSync(SRC, "utf8").split("\n");
const paras = [];
for (const raw of lines) {
  const line = raw.trimEnd();
  if (!line.trim()) continue;
  if (line === "---") {
    paras.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" } }, spacing: { after: 160 } }));
    continue;
  }
  if (line.startsWith("## ")) {
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

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 26 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", run: { font: FONT, size: 30, bold: true } },
      { id: "Heading2", name: "Heading 2", run: { font: FONT, size: 26, bold: true } },
    ],
  },
  sections: [{ children: paras }],
});
mkdirSync("docs/handover", { recursive: true });
writeFileSync(OUT, await Packer.toBuffer(doc));
console.log("Written", OUT);
