// CR-040: quy uoc username tu ten that.
// "Lê Duy Linh" -> "linhld"; neu da ton tai -> "linhld1", "linhld2"...
// Dung chung cho form tao can bo + bootstrap-school.mjs.

const VI_STRIP = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");

/** Phan local cua email (truoc @), lowercase. */
export function emailLocal(email: string | null | undefined): string {
  return (email ?? "").split("@")[0].toLowerCase();
}

/** username base tu ho ten: <ten><viet tat ho dem>. */
export function usernameBase(fullName: string): string {
  const words = VI_STRIP(fullName)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "user";
  const given = words[words.length - 1];
  const initials = words
    .slice(0, -1)
    .map((w) => w[0])
    .join("");
  return given + initials;
}

/** username duy nhat: base hoac base+so khi trung (`taken` nhan email hoac username). */
export function suggestUsername(fullName: string, taken: Iterable<string>): string {
  const base = usernameBase(fullName);
  const used = new Set(
    [...taken].map((v) => (v.includes("@") ? emailLocal(v) : v.toLowerCase())),
  );
  if (!used.has(base)) return base;
  for (let i = 1; ; i++) {
    const cand = `${base}${i}`;
    if (!used.has(cand)) return cand;
  }
}
