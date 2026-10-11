/**
 * CR-049 P3b: PII minimization cho moi text gui ra AI provider
 * (DPIA / ND13/2023 du lieu ca nhan hoc sinh).
 *
 * Hai lop:
 * 1. redactPiiText - cat PII cau truc (email, so dien thoai, so
 *    dinh danh/CCCD) khoi prompt truoc khi gui. Ap dung tap trung tai
 *    respondWithAi -> moi route /api/ai/* (ke ca Devin fallback vi no
 *    dung lai cung prompt) duoc bao ve tu dong.
 * 2. pseudonymizeNames / deanonymizeNames - an danh hoa ten rieng theo
 *    bang alias (ma HS/GV), goi ten that sau khi LLM tra ket qua.
 */

const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// VN mobile: 0x/84x 10 so bat dau 03x/05x/07x/08x/09x - cho phep
// separator . - space giua cac cum so (090 123 4567, +84 90 123 4567)
const RE_PHONE =
  /(?<!\d)(?:\+?84[\s.\-]?|0)(?:3|5|7|8|9)(?:[\s.\-]?\d){8}(?!\d)/g;
// CCCD 12 so, CMND 9 so (tranh cham diem 8-9.x / ma so ngan hon) -
// cho phep separator giua cac cum (0123 456 789)
const RE_CCCD = /(?<!\d)\d(?:[\s.\-]?\d){11}(?!\d)/g;
const RE_CMND = /(?<!\d)\d(?:[\s.\-]?\d){8}(?!\d)/g;

/** Cat PII co cau truc ro rang. KHONG cat dd/mm/yyyy - ngay thang la
 *  noi dung chuong trinh hop le (lich su, ngay le); ngay sinh HS nen
 *  an danh hoa qua pseudonymizeNames theo truong hop. */
export function redactPiiText(text: string): string {
  return text
    .replace(RE_EMAIL, "[email]")
    .replace(RE_PHONE, "[sdt]")
    .replace(RE_CCCD, "[so_dinh_danh]")
    .replace(RE_CMND, "[so_dinh_danh]");
}

export interface PiiName {
  name: string;
  alias: string;
}

/** Thay moi ten that trong text bang alias (longest-first de tranh
 *  ten long nhau). CR-049 r7: case-insensitive + boundary theo ky tu
 *  Unicode - "nguyen van an" (thuong) van bi alias, con "An" trong
 *  "Anh" khong bi an nham. */
export function pseudonymizeNames(text: string, names: PiiName[]): string {
  // CR-049 r8 H5: canonical-equivalence bypass - input NFD ("Nguyễn")
  // khong match ten NFC trong roster; chuan hoa ca hai ve NFC.
  const sorted = [...names]
    .filter((n) => n.name && n.alias)
    .map((n) => ({ name: n.name.normalize("NFC"), alias: n.alias }))
    .sort((a, b) => b.name.length - a.name.length);
  let out = text.normalize("NFC");
  for (const n of sorted) {
    const esc = n.name
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      // whitespace linh hoat: "Nguyen  Van  An" (2 spaces) van khop
      .split(/\s+/)
      .join("\\s+");
    out = out.replace(
      new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "giu"),
      n.alias,
    );
  }
  return out;
}

/** Dao nguoc: alias -> ten that tren output LLM. Alias dai truoc
 *  (GV100 truoc GV10) + boundary regex: "GV10" khong duoc an vao token
 *  "GV100" hay "XGV100" khi chi co GV10 trong map. */
export function deanonymizeNames(text: string, names: PiiName[]): string {
  const sorted = [...names].sort((a, b) => b.alias.length - a.alias.length);
  let out = text;
  for (const n of sorted) {
    if (!n.name || !n.alias) continue;
    const esc = n.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(
      new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, "g"),
      () => n.name,
    );
  }
  return out;
}

/** Goi gon: pseudonymizeNames + redactPiiText cho moi external call. */
export function minimizePrompt(text: string, names: PiiName[] = []): string {
  return redactPiiText(pseudonymizeNames(text, names));
}
