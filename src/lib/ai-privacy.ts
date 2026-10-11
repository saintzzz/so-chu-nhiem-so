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
// r9 H12: ma dinh danh HS 10 so (records/students validation = 10
// digits) - redact truoc khi CMND 9 so an vao trong.
const RE_MAHS = /(?<!\d)\d(?:[\s.\-]?\d){9}(?!\d)/g;
const RE_CMND = /(?<!\d)\d(?:[\s.\-]?\d){8}(?!\d)/g;

/** Cat PII co cau truc ro rang. KHONG cat dd/mm/yyyy - ngay thang la
 *  noi dung chuong trinh hop le (lich su, ngay le); ngay sinh HS nen
 *  an danh hoa qua pseudonymizeNames theo truong hop. */
export function redactPiiText(text: string): string {
  return text
    .replace(RE_EMAIL, "[email]")
    .replace(RE_PHONE, "[sdt]")
    .replace(RE_CCCD, "[so_dinh_danh]")
    .replace(RE_MAHS, "[so_dinh_danh]")
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
  if (!sorted.length) return text;
  const byName = new Map(
    sorted.map((n) => [n.name.replace(/\s+/g, " ").toLowerCase(), n.alias]),
  );
  const alt = sorted
    .map((n) =>
      n.name
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        // whitespace linh hoat: "Nguyen  Van  An" (2 spaces) van khop
        .split(/\s+/)
        .join("\\s+"),
    )
    .join("|");
  // CR-049 r16: MOT luot thay the duy nhat - alias vua sinh khong bi
  // quet lai nhu ten that (nguoi ten "RHS001" + alias RHS001 khong con
  // lech tang). Lookbehind loai ⟦⟧: ten "HS001" khong duoc an vao trong
  // alias ⟦HS001⟧ da sinh (cross-call minimize facts -> minimizePrompt).
  return text.normalize("NFC").replace(
    new RegExp(`(?<![\\p{L}\\p{N}⟦])(?:${alt})(?![\\p{L}\\p{N}⟧])`, "giu"),
    (m) =>
      byName.get(m.normalize("NFC").replace(/\s+/g, " ").toLowerCase()) ?? m,
  );
}

/** Dao nguoc: alias -> ten that tren output LLM.
 *  CR-049 r16: MOT luot (finding 3: ten vua restore khong bi quet lai
 *  boi alias cua nguoi khac - "THCS TR02" -> TR01 -> "THCS THCS Nguyen
 *  Du"). Alias ⟦X###⟧ chi match DANG CO NGOAC - bare core khong match
 *  (finding 5: "ma HS001" trong source la code that, khong duoc bi
 *  restore thanh ten). Model bo ngoac khi echo thi alias con sot trong
 *  output - residual benign, tot hon restore sai. Alias legacy khong
 *  ngoac (pii_map job cu) van match bare voi boundary Unicode nhu cu. */
export function deanonymizeNames(text: string, names: PiiName[]): string {
  const sorted = [...names]
    .filter((n) => n.name && n.alias)
    .sort((a, b) => b.alias.length - a.alias.length);
  if (!sorted.length) return text;
  const byAlias = new Map(sorted.map((n) => [n.alias, n.name]));
  const parts: string[] = [];
  for (const n of sorted) {
    const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (n.alias.startsWith("⟦") && n.alias.endsWith("⟧")) {
      parts.push(escRe(n.alias));
    } else {
      parts.push(`(?<![\\p{L}\\p{N}])${escRe(n.alias)}(?![\\p{L}\\p{N}])`);
    }
  }
  return text.replace(
    new RegExp(`(?:${parts.join("|")})`, "gu"),
    (m) => byAlias.get(m) ?? m,
  );
}

/** Goi gon: pseudonymizeNames + redactPiiText cho moi external call. */
export function minimizePrompt(text: string, names: PiiName[] = []): string {
  return redactPiiText(pseudonymizeNames(text, names));
}

/** CR-049 r12 H3: chi deanon/luu pii_map cho cac ten THUC SU xuat hien
 *  trong noi dung caller gui (prompt/payload tho truoc khi minimize).
 *  Neu deanon tren toan roster, caller co the inject "HS001 HS002..."
 *  vao free-text de LLM echo lai -> lo ten HS/GV/PH ngoai pham vi
 *  campus cua ho (roster admin la full-school). Ten khong co trong
 *  input cua caller thi alias cua no khong duoc khoi phuc.
 *  source: string hoac cay object/array bat ky (minimizeDeep payload). */
export function collectUsedNames(
  source: unknown,
  names: PiiName[],
): PiiName[] {
  const texts: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") texts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      // r14: JSON key cung co the chua ten/PII - gom key vao haystack.
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        walk(k);
        walk(val);
      }
    }
  };
  walk(source);
  if (!texts.length) return [];
  const hay = texts.join("\n").normalize("NFC");
  return names.filter((n) => {
    if (!n.name || !n.alias) return false;
    const esc = n.name
      .normalize("NFC")
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .split(/\s+/)
      .join("\\s+");
    return new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "iu").test(
      hay,
    );
  });
}

/** CR-049 r9 H10: minimize DU LIEU CAU TRUC truoc JSON.stringify.
 *  Ten co whitespace ("Nguyen\nVan An") bi JSON-escape thanh \\n -
 *  regex \s+ khong con khop sau serialize. Pseudonymize/redact tung
 *  string trong facts truoc khi stringify de alias luon khop. */
export function minimizeDeep<T>(
  value: T,
  names: PiiName[] = [],
  preserveKeys?: ReadonlySet<string>,
  depth = 0,
): T {
  if (typeof value === "string") {
    return redactPiiText(pseudonymizeNames(value, names)) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => minimizeDeep(v, names, undefined, depth + 1)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // r14: key cung la free-text co the mang ten/PII (payload tuy y cua
      // client) - minimize key truoc khi serialize.
      // r15 L: key thuoc schema tool (lesson, note...) duoc giu nguyen o
      // depth 0 - builder doc input.<key>; doi key do se mat du lieu.
      const mk =
        depth === 0 && preserveKeys?.has(k)
          ? k
          : redactPiiText(pseudonymizeNames(k, names));
      out[mk] = minimizeDeep(v, names, undefined, depth + 1);
    }
    return out as T;
  }
  return value;
}

/** CR-049 r15 M: gop map alias NGHIEP VU (HS/GV alias local trong facts)
 *  voi roster full-school cho minimization.
 *  - Dedupe theo ten: alias nghiep vu thang (facts da embed san).
 *  - Alias roster doi prefix "R" (HS001 -> RHS001): roster tu dem so
 *    nen de trung alias nghiep vu - trung alias khien deanon restore
 *    sai ten khi ca hai deu ton tai trong output. */
export function mergePiiNames(biz: PiiName[], roster: PiiName[]): PiiName[] {
  const seen = new Set(biz.map((n) => n.name.normalize("NFC")));
  const extra = roster
    .filter((r) => r.name && !seen.has(r.name.normalize("NFC")))
    .map((r) => ({
      name: r.name,
      // r16: alias hien tai dang ⟦X###⟧ - nhung vao ⟦RX###⟧, KHONG noi
      // chuoi tho (R⟦HS001⟧ khong match deanon va bi leak).
      alias: `⟦R${r.alias.startsWith("⟦") ? r.alias.slice(1, -1) : r.alias}⟧`,
    }));
  return [...biz, ...extra];
}

/** CR-049 r10 M: deanon tren JSON da parse, KHONG tren chuoi JSON tho.
 *  deanonymizeNames(stringifiedJson) co the pha cau truc neu ten that
 *  chua ky tu JSON dac biet; deanonDeep di vao tung string value/key
 *  sau khi parse nen output provider luon hop le. */
export function deanonymizeDeep<T>(value: T, names: PiiName[]): T {
  if (typeof value === "string") {
    return deanonymizeNames(value, names) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => deanonymizeDeep(v, names)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[deanonymizeNames(k, names)] = deanonymizeDeep(v, names);
    }
    return out as T;
  }
  return value;
}
