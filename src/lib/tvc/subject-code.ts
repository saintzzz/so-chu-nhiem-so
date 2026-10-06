// CR-032: map ten mon (public.subjects, per-school, khong dau-code)
// sang code mon TVC (tvc.subjects.code: toan, tieng_viet, tieng_anh...).
// Khong dau -> lowercase -> gach duoi.
const NAME_TO_CODE: Record<string, string> = {
  "toan": "toan",
  "toan hoc": "toan",
  "tieng viet": "tieng_viet",
  "ngu van": "ngu_van",
  "tieng anh": "tieng_anh",
  "anh van": "tieng_anh",
  "khoa hoc tu nhien": "khtn",
  "lich su va dia ly": "lsdl",
  "lich su": "lich_su",
  "dia ly": "dia_ly",
  "gdcd": "gdcd",
  "dao duc": "gdcd",
  "giao duc cong dan": "gdcd",
  "vat ly": "vat_ly",
  "hoa hoc": "hoa_hoc",
  "sinh hoc": "sinh_hoc",
  "tin hoc": "tin_hoc",
  "cong nghe": "cong_nghe",
  "the duc": "the_duc",
  "giao duc the chat": "the_duc",
  "am nhac": "am_nhac",
  "my thuat": "my_thuat",
  "hoat dong trai nghiem": "hdtn",
};

export function normalizeVN(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function subjectNameToCode(name: string): string | null {
  return NAME_TO_CODE[normalizeVN(name)] ?? null;
}
