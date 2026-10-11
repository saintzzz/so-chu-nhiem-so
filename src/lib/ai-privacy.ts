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
// VN mobile: 0x/84x 10 so bat dau 03x/05x/07x/08x/09x
const RE_PHONE = /(?<!\d)(?:\+?84|0)(?:3|5|7|8|9)\d{8}(?!\d)/g;
// CCCD 12 so, CMND 9 so (tranh cham diem 8-9.x / ma so ngan hon)
const RE_CCCD = /(?<!\d)\d{12}(?!\d)/g;
const RE_CMND = /(?<!\d)\d{9}(?!\d)/g;

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
 *  ten long nhau). */
export function pseudonymizeNames(text: string, names: PiiName[]): string {
  const sorted = [...names].sort((a, b) => b.name.length - a.name.length);
  let out = text;
  for (const n of sorted) {
    if (!n.name || !n.alias) continue;
    out = out.split(n.name).join(n.alias);
  }
  return out;
}

/** Dao nguoc: alias -> ten that tren output LLM. */
export function deanonymizeNames(text: string, names: PiiName[]): string {
  let out = text;
  for (const n of names) {
    if (!n.name || !n.alias) continue;
    out = out.split(n.alias).join(n.name);
  }
  return out;
}
