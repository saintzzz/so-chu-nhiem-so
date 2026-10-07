// CR-035: KHBD co cau truc theo CV 5512/CTGDPT 2018. content_json jsonb la
// nguon du lieu chinh; `content` (text) la ban render phang giu tuong thich
// voi view cu, AI review va search. Moi ham o day la pure - test truc tiep.

export interface KhbdActivity {
  muc_tieu: string;
  to_chuc: string; // Hoat dong GV - HS / cach to chuc thuc hien
  san_pham: string;
  danh_gia: string;
}

export interface KhbdContent {
  muc_tieu_kien_thuc: string;
  muc_tieu_nang_luc: string;
  muc_tieu_pham_chat: string;
  thiet_bi_gv: string;
  thiet_bi_hs: string;
  khoi_dong: KhbdActivity;
  kham_pha: KhbdActivity;
  luyen_tap: KhbdActivity;
  van_dung: KhbdActivity;
  dieu_chinh: string;
}

export const KHBD_ACTIVITIES = [
  { key: "khoi_dong", label: "Hoạt động 1: Khởi động" },
  { key: "kham_pha", label: "Hoạt động 2: Khám phá - Hình thành kiến thức" },
  { key: "luyen_tap", label: "Hoạt động 3: Luyện tập" },
  { key: "van_dung", label: "Hoạt động 4: Vận dụng - Trải nghiệm" },
] as const;

export const KHBD_ACTIVITY_FIELDS = [
  { key: "muc_tieu", label: "Mục tiêu" },
  { key: "to_chuc", label: "Tổ chức thực hiện (Hoạt động của GV - HS)" },
  { key: "san_pham", label: "Sản phẩm" },
  { key: "danh_gia", label: "Đánh giá" },
] as const;

export function emptyKhbd(): KhbdContent {
  const act = (): KhbdActivity => ({
    muc_tieu: "",
    to_chuc: "",
    san_pham: "",
    danh_gia: "",
  });
  return {
    muc_tieu_kien_thuc: "",
    muc_tieu_nang_luc: "",
    muc_tieu_pham_chat: "",
    thiet_bi_gv: "",
    thiet_bi_hs: "",
    khoi_dong: act(),
    kham_pha: act(),
    luyen_tap: act(),
    van_dung: act(),
    dieu_chinh: "",
  };
}

/** Parse content_json tu DB ve KhbdContent; null/invalid -> null. */
export function parseKhbd(raw: unknown): KhbdContent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.muc_tieu_kien_thuc !== "string") return null;
  const act = (v: unknown): KhbdActivity => {
    const a = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    return {
      muc_tieu: typeof a.muc_tieu === "string" ? a.muc_tieu : "",
      to_chuc: typeof a.to_chuc === "string" ? a.to_chuc : "",
      san_pham: typeof a.san_pham === "string" ? a.san_pham : "",
      danh_gia: typeof a.danh_gia === "string" ? a.danh_gia : "",
    };
  };
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  return {
    muc_tieu_kien_thuc: str("muc_tieu_kien_thuc"),
    muc_tieu_nang_luc: str("muc_tieu_nang_luc"),
    muc_tieu_pham_chat: str("muc_tieu_pham_chat"),
    thiet_bi_gv: str("thiet_bi_gv"),
    thiet_bi_hs: str("thiet_bi_hs"),
    khoi_dong: act(o.khoi_dong),
    kham_pha: act(o.kham_pha),
    luyen_tap: act(o.luyen_tap),
    van_dung: act(o.van_dung),
    dieu_chinh: str("dieu_chinh"),
  };
}

/** KHBD co noi dung that (it nhat 1 field khong rong)? */
export function khbdHasContent(k: KhbdContent): boolean {
  const texts = [
    k.muc_tieu_kien_thuc,
    k.muc_tieu_nang_luc,
    k.muc_tieu_pham_chat,
    k.thiet_bi_gv,
    k.thiet_bi_hs,
    k.dieu_chinh,
  ];
  if (texts.some((t) => t.trim())) return true;
  return KHBD_ACTIVITIES.some(({ key }) =>
    Object.values(k[key]).some((t) => t.trim()),
  );
}

/** Render KHBD co cau truc ra text phang - mirror cho cot `content`. */
export function renderKhbdText(k: KhbdContent): string {
  const lines: string[] = [];
  const sec = (t: string) => {
    if (lines.length) lines.push("");
    lines.push(t);
  };
  const field = (label: string, v: string) => {
    if (v.trim()) lines.push(`${label}: ${v.trim()}`);
  };

  sec("I. MỤC TIÊU");
  field("1. Kiến thức", k.muc_tieu_kien_thuc);
  field("2. Năng lực", k.muc_tieu_nang_luc);
  field("3. Phẩm chất", k.muc_tieu_pham_chat);
  sec("II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU");
  field("1. Giáo viên", k.thiet_bi_gv);
  field("2. Học sinh", k.thiet_bi_hs);
  sec("III. TIẾN TRÌNH DẠY HỌC");
  for (const { key, label } of KHBD_ACTIVITIES) {
    const a = k[key];
    if (!Object.values(a).some((v) => v.trim())) continue;
    sec(`Hoạt động: ${label.replace(/^Hoạt động \d: /, "")}`);
    field("a) Mục tiêu", a.muc_tieu);
    field("b) Tổ chức thực hiện", a.to_chuc);
    field("c) Sản phẩm", a.san_pham);
    field("d) Đánh giá", a.danh_gia);
  }
  if (k.dieu_chinh.trim()) {
    sec("IV. ĐIỀU CHỈNH SAU BÀI DẠY");
    lines.push(k.dieu_chinh.trim());
  }
  return lines.join("\n");
}
