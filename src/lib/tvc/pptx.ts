import PptxGenJS from "pptxgenjs";
import type { DocContent, DocBlock } from "@/types/tvc";

// Chuyen DocContent -> .pptx: moi section = 1 slide.
// Font Arial de dam bao Unicode tieng Viet trong PowerPoint.
const FONT = "Arial";

function blockToLines(b: DocBlock): { text: string; bullet: boolean }[] {
  switch (b.kind) {
    case "heading":
      return [{ text: b.text, bullet: false }];
    case "para":
      return [{ text: b.text, bullet: false }];
    case "list":
      return b.items.map((t) => ({ text: t, bullet: true }));
    case "kv":
      return b.pairs.map(([k, v]) => ({ text: `${k}: ${v}`, bullet: true }));
    case "table":
      return [
        { text: b.header.join(" | "), bullet: false },
        ...b.rows.map((r) => ({ text: r.join(" | "), bullet: true })),
      ];
    case "formula":
      return [{ text: b.tex, bullet: false }];
    case "note":
      return [{ text: b.text, bullet: false }];
    case "divider":
      return [];
  }
}

export async function docToPptx(doc: DocContent, author: string): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 10, height: 5.625 });
  pptx.layout = "WIDE";
  pptx.title = doc.title;
  pptx.author = author;

  // Slide bia
  const cover = pptx.addSlide();
  cover.background = { color: "1F3B73" };
  cover.addText(doc.title, {
    x: 0.6, y: 1.6, w: 8.8, h: 1.4,
    fontFace: FONT, fontSize: 30, bold: true, color: "FFFFFF", align: "center",
  });
  const metaLine = (doc.meta ?? [])
    .map(([k, v]) => `${k}: ${v}`)
    .join("   ·   ");
  if (metaLine) {
    cover.addText(metaLine, {
      x: 0.6, y: 3.2, w: 8.8, h: 0.5,
      fontFace: FONT, fontSize: 14, color: "D6E4FF", align: "center",
    });
  }
  cover.addText(author, {
    x: 0.6, y: 4.7, w: 8.8, h: 0.4,
    fontFace: FONT, fontSize: 12, color: "B8C9E8", align: "center",
  });

  for (const sec of doc.sections ?? []) {
    const s = pptx.addSlide();
    s.addText(sec.title, {
      x: 0.5, y: 0.25, w: 9, h: 0.7,
      fontFace: FONT, fontSize: 22, bold: true, color: "1F3B73",
    });
    const lines = (sec.blocks ?? [])
      .flatMap(blockToLines)
      .filter((l) => l.text.trim())
      .slice(0, 9);
    s.addText(
      lines.map((l) => ({
        text: l.text,
        options: { bullet: l.bullet ? { code: "2022" } : undefined },
      })),
      {
        x: 0.7, y: 1.1, w: 8.6, h: 4.1,
        fontFace: FONT, fontSize: 16, color: "222222",
        valign: "top", lineSpacingMultiple: 1.25,
      },
    );
  }

  for (const ap of doc.appendix ?? []) {
    const s = pptx.addSlide();
    s.addText(ap.title, {
      x: 0.5, y: 0.25, w: 9, h: 0.7,
      fontFace: FONT, fontSize: 20, bold: true, color: "5B6577",
    });
    const lines = (ap.blocks ?? [])
      .flatMap(blockToLines)
      .filter((l) => l.text.trim())
      .slice(0, 9);
    s.addText(
      lines.map((l) => ({
        text: l.text,
        options: { bullet: l.bullet ? { code: "2022" } : undefined },
      })),
      {
        x: 0.7, y: 1.1, w: 8.6, h: 4.1,
        fontFace: FONT, fontSize: 15, color: "333333",
        valign: "top", lineSpacingMultiple: 1.2,
      },
    );
  }

  const buf = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
}
