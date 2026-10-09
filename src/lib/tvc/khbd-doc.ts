import type { DocContent, DocSection } from "@/types/tvc";

/**
 * CR-037: chuan hoa doc KHBD (DC-01) ve dung khung bieu mau.
 * AI hay them phu luc lac de (phieu bai tap, dap an, bai tap ve nha) vao
 * giáo an - sanitize loc cac section khong thuoc khung CV 5512 / bieu mau
 * truong, va kiem tra doc co du section bat buoc.
 */

// Strip diacritics + lower de match duoc ca tieu de AI tra ve khong dau.
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .trim();

// Tieu de section hop le theo khung CV 5512 (match tren chuoi da norm).
const SECTION_ALLOW = [
  /^(i{1,3}v?|iv|v)\s*[.)\-:]/, // I. II. III. IV. V.
  /muc tieu/,
  /thiet bi|hoc lieu|do dung|phuong tien/,
  /tien trinh|to chuc|hoat dong/,
  /khoi dong|kham pha|luyen tap|van dung|mo dau|ket thuc|cung co/,
  /dieu chinh|nhan xet|rut kinh nghiem/,
  /ky duyet|chu ky|ban giam hieu|to truong/,
  /du kien|san pham|danh gia/,
];

// Tieu de cam tuyet doi trong giao an - noi dung thuoc tai lieu khac.
const SECTION_BLOCK =
  /dap an|huong dan cham|phieu (bai tap|hoc tap)|bai tap ve nha|de (kiem tra|thi|cuong)|loi giai|ma tran/;

function keepSection(s: DocSection): boolean {
  const t = norm(s.title ?? "");
  if (SECTION_BLOCK.test(t)) return false;
  if (!t) return true; // section khong tieu de giu lai (an toan)
  return SECTION_ALLOW.some((re) => re.test(t));
}

/** Doc co du khung toi thieu cua mot KHBD khong? */
export function khbdHasCoreStructure(doc: DocContent): boolean {
  const titles = doc.sections.map((s) => norm(s.title ?? ""));
  const hasGoal = titles.some(
    (t) => /muc tieu/.test(t) || /^i\s*[.)\-:]/.test(t),
  );
  const hasProcess = titles.some((t) =>
    /tien trinh|hoat dong|khoi dong|kham pha|luyen tap|van dung/.test(t),
  );
  const bodyBlocks = doc.sections.reduce((n, s) => n + s.blocks.length, 0);
  return hasGoal && hasProcess && bodyBlocks >= 6;
}

/**
 * Loc doc AI ve dung khung: bo section lac de khoi sections + appendix.
 * Tra ve null neu doc khong con du cau truc toi thieu (caller -> fallback).
 */
export function sanitizeKhbdDoc(doc: DocContent | null | undefined): DocContent | null {
  if (!doc || !Array.isArray(doc.sections)) return null;
  const sections = doc.sections.filter(keepSection);
  const appendix = (doc.appendix ?? []).filter(keepSection);
  const out: DocContent = {
    ...doc,
    sections,
    appendix: appendix.length ? appendix : undefined,
  };
  return khbdHasCoreStructure(out) ? out : null;
}

/**
 * CR-042: DocContent -> plain text de dua vao prompt AI.
 * Dung cho DC-06: bien giao an (KHBD) da luu thanh nguon sinh slide.
 */
export function docToPlainText(doc: DocContent, maxChars = 12000): string {
  const blockText = (b: DocContent["sections"][0]["blocks"][0]): string => {
    switch (b.kind) {
      case "heading":
      case "para":
      case "note":
        return b.text;
      case "list":
        return b.items.map((i) => `- ${i}`).join("\n");
      case "kv":
        return b.pairs.map(([k, v]) => `${k}: ${v}`).join("\n");
      case "table":
        return [b.header.join(" | "), ...b.rows.map((r) => r.join(" | "))].join("\n");
      case "formula":
        return b.tex;
      case "image":
        return b.caption ? `[Hình: ${b.caption}]` : "";
      case "audio":
        return b.caption ? `[Audio: ${b.caption}]` : "[Audio]";
      case "divider":
        return "";
    }
  };
  const parts: string[] = [];
  if (doc.title) parts.push(`# ${doc.title}`);
  for (const s of [...(doc.sections ?? []), ...(doc.appendix ?? [])]) {
    parts.push(`\n## ${s.title}`);
    for (const b of s.blocks ?? []) {
      const t = blockText(b).trim();
      if (t) parts.push(t);
    }
  }
  return parts.join("\n").slice(0, maxChars);
}
