import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle, ImageRun,
} from "docx";
import JSZip from "jszip";
import temml from "temml";
import { mml2omml } from "mathml2omml";
import type { DocContent, DocBlock, DocSection } from "@/types/tvc";

const border = { style: BorderStyle.SINGLE, size: 4, color: "64748B" };
const borders = { top: border, bottom: border, left: border, right: border };

/** Gom OMML trong 1 lần export - patch vao document.xml sau khi pack. */
interface MathItem {
  omml: string;
  display: boolean;
}

/** LaTeX -> MathML (temml) -> OMML. Loi thi tra null de fallback text. */
function latexToOmml(tex: string): string | null {
  try {
    const clean = tex.replace(/\\\\(?=[a-zA-Z{(\[,;:])/g, "\\").trim();
    const mml = temml.renderToString(clean, { displayMode: false });
    return String(mml2omml(mml));
  } catch {
    return null;
  }
}

/** Token an toan de regex tim trong document.xml (khong ky tu dac biet XML/regex). */
function mathToken(tex: string, display: boolean, store: MathItem[]): string {
  const omml = latexToOmml(tex);
  if (!omml) return tex; // fallback giu nguyen LaTeX text
  store.push({ omml, display });
  return `TVCXMATH${String(store.length - 1).padStart(4, "0")}END`;
}

/** Tach text co $...$ / $$...$$ thanh runs: text + token toan. */
function runsWithMath(
  text: string,
  store: MathItem[],
  runOpts: { bold?: boolean; italics?: boolean } = {},
): TextRun[] {
  const out: TextRun[] = [];
  // Xuong dong trong text thanh line break that trong Word
  const lines = text.split("\n");
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (li > 0) out.push(new TextRun({ break: 1 }));
    const re = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      if (m.index > last)
        out.push(new TextRun({ text: line.slice(last, m.index), ...runOpts }));
      const display = Boolean(m[1]);
      out.push(
        new TextRun({ text: mathToken(m[1] ?? m[2], display, store), ...runOpts }),
      );
      last = m.index + m[0].length;
    }
    if (last < line.length)
      out.push(new TextRun({ text: line.slice(last), ...runOpts }));
  }
  if (!out.length) out.push(new TextRun({ text, ...runOpts }));
  return out;
}

/** Sau khi pack: thay run chua token bang m:oMath (inline) hoac m:oMathPara (display). */
async function patchMathXml(buf: Buffer, store: MathItem[]): Promise<Buffer> {
  if (!store.length) return buf;
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file("word/document.xml");
  if (!file) return buf;
  let xml = await file.async("string");
  xml = xml.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, (run) => {
    const m = run.match(/TVCXMATH(\d+)END/);
    if (!m) return run;
    const it = store[Number(m[1])];
    if (!it) return run;
    return it.display
      ? `<m:oMathPara><m:oMathParaPr><m:jc m:val="centerGroup"/></m:oMathParaPr>${it.omml}</m:oMathPara>`
      : it.omml;
  });
  zip.file("word/document.xml", xml);
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

// CR-031: media -> PNG. svg raster bang sharp; path fetch tu public bucket.
async function imageToPng(
  b: { svg?: string; path?: string },
): Promise<{ data: Buffer; w: number; h: number } | null> {
  try {
    const sharp = (await import("sharp")).default;
    if (b.svg) {
      const data = await sharp(Buffer.from(b.svg), { density: 150 })
        .resize({ width: 420, withoutEnlargement: true })
        .png()
        .toBuffer();
      const meta = await sharp(data).metadata();
      return { data, w: meta.width ?? 320, h: meta.height ?? 240 };
    }
    if (b.path) {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tvc-media/${b.path}`;
      const r = await fetch(url);
      if (!r.ok) return null;
      const data = await sharp(Buffer.from(await r.arrayBuffer()))
        .resize({ width: 480, withoutEnlargement: true })
        .png()
        .toBuffer();
      const meta = await sharp(data).metadata();
      return { data, w: meta.width ?? 480, h: meta.height ?? 320 };
    }
  } catch {
    return null;
  }
  return null;
}

async function resolveImages(doc: DocContent) {
  const map = new Map<DocBlock, { data: Buffer; w: number; h: number }>();
  const jobs: Promise<void>[] = [];
  for (const sec of [...(doc.sections ?? []), ...(doc.appendix ?? [])]) {
    for (const b of sec.blocks ?? []) {
      if (b.kind === "image")
        jobs.push(
          imageToPng(b).then((r) => {
            if (r) map.set(b, r);
          }),
        );
    }
  }
  await Promise.all(jobs);
  return map;
}

function blockToElements(
  b: DocBlock,
  store: MathItem[],
  images?: Map<DocBlock, { data: Buffer; w: number; h: number }>,
): (Paragraph | Table)[] {
  switch (b.kind) {
    case "heading": {
      const lvl =
        b.level === 1 ? HeadingLevel.HEADING_2
        : b.level === 2 ? HeadingLevel.HEADING_3
        : HeadingLevel.HEADING_4;
      return [
        new Paragraph({
          children: runsWithMath(b.text, store, { bold: true }),
          heading: lvl,
          spacing: { before: 200, after: 80 },
        }),
      ];
    }
    case "para":
      return [
        new Paragraph({ children: runsWithMath(b.text, store), spacing: { after: 80 } }),
      ];
    case "note":
      return [
        new Paragraph({
          children: runsWithMath(b.text, store, { italics: true }),
          spacing: { after: 80 },
          shading: { fill: "FFF7E6" },
        }),
      ];
    case "list":
      return b.items.map(
        (it, i) =>
          new Paragraph({
            children: [
              new TextRun({ text: b.ordered ? `${i + 1}. ` : "• " }),
              ...runsWithMath(it, store),
            ],
            indent: { left: 360 },
            spacing: { after: 40 },
          }),
      );
    case "table":
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: b.header.map(
                (h) =>
                  new TableCell({
                    borders,
                    shading: { fill: "F1F5F9" },
                    children: [
                      new Paragraph({ children: runsWithMath(h, store, { bold: true }) }),
                    ],
                  }),
              ),
            }),
            ...b.rows.map(
              (r) =>
                new TableRow({
                  children: r.map(
                    (c) =>
                      new TableCell({
                        borders,
                        children: [new Paragraph({ children: runsWithMath(c, store) })],
                      }),
                  ),
                }),
            ),
          ],
        }),
      ];
    case "formula":
      return [
        new Paragraph({
          children: [
            new TextRun({ text: mathToken(b.tex, true, store), font: "Cambria Math" }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 100 },
        }),
      ];
    case "kv":
      return b.pairs.map(
        ([k, v]) =>
          new Paragraph({
            children: [
              new TextRun({ text: `${k}: `, bold: true }),
              ...runsWithMath(v, store),
            ],
            spacing: { after: 40 },
          }),
      );
    case "divider":
      return [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "94A3B8" } },
          spacing: { before: 120, after: 120 },
        }),
      ];
    case "image": {
      const img = images?.get(b);
      if (!img) return [];
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: img.data,
              transformation: { width: img.w, height: img.h },
              type: "png",
            }),
          ],
          spacing: { before: 100, after: 60 },
        }),
        ...(b.caption
          ? [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: b.caption, italics: true, size: 18 })],
                spacing: { after: 120 },
              }),
            ]
          : []),
      ];
    }
  }
}

function sectionToElements(
  s: DocSection,
  store: MathItem[],
  isAppendix = false,
  images?: Map<DocBlock, { data: Buffer; w: number; h: number }>,
): (Paragraph | Table)[] {
  return [
    ...(isAppendix
      ? [
          new Paragraph({
            border: { top: { style: BorderStyle.DASHED, size: 6, color: "94A3B8" } },
            spacing: { before: 240 },
          }),
        ]
      : []),
    new Paragraph({
      children: runsWithMath(s.title, store, { bold: true }),
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 100 },
    }),
    ...s.blocks.flatMap((b) => blockToElements(b, store, images)),
  ];
}

export async function docToDocx(doc: DocContent, authorName: string): Promise<Buffer> {
  const store: MathItem[] = [];
  const images = await resolveImages(doc);
  const d = new Document({
    styles: {
      default: {
        document: { run: { font: "Be Vietnam Pro", size: 24 } },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1134, bottom: 1134, left: 1020, right: 1020 } },
        },
        children: [
          new Paragraph({
            children: runsWithMath(doc.title, store, { bold: true }),
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
          }),
          ...(doc.meta ?? []).map(
            ([k, v]) =>
              new Paragraph({
                children: [
                  new TextRun({ text: `${k}: `, bold: true }),
                  ...runsWithMath(v, store),
                ],
                spacing: { after: 40 },
              }),
          ),
          ...doc.sections.map((s) => sectionToElements(s, store, false, images)).flat(),
          ...(doc.appendix ?? []).map((s) => sectionToElements(s, store, true, images)).flat(),
          new Paragraph({
            children: [
              new TextRun({
                text: `Biên soạn bởi ${authorName} trên nền tảng TVC360`,
                italics: true,
                size: 18,
                color: "64748B",
              }),
            ],
            spacing: { before: 400 },
          }),
        ],
      },
    ],
  });
  const buf = Buffer.from(await Packer.toBuffer(d));
  return patchMathXml(buf, store);
}
