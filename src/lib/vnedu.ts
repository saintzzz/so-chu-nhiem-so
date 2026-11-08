// CR-116-W3: mapping 2 chieu voi he thong cu (vnEdu "mau 1" / SMAS).
// Cau truc 26 cot lay tu file export thuc te cua vnEdu (xem docs/research/
// CSDL-NGANH-CONNECTOR.md). Khi truong xuat file nay, vnEdu/SMAS import lai
// duoc vi header + thu tu khop mau chuan cua ho.
// File nay chua ca parse layer (alias header, normalize) de import/export
// dung chung 1 source of truth - round-trip test assert tren chinh ham nay.

export const VNEDU_MAU1_HEADERS = [
  "STT",
  "Mã học sinh",
  "Mã VEMIS",
  "Họ và tên",
  "Ngày sinh",
  "Giới tính",
  "Chỗ ở hiện nay",
  "Hộ khẩu thường trú",
  "Nơi sinh",
  "Quê quán",
  "Dân tộc",
  "Tôn giáo",
  "Diện chính sách",
  "Hộ nghèo",
  "Cận nghèo",
  "Đoàn viên",
  "Đội viên",
  "Con giáo viên",
  "Tên cha",
  "Nghề nghiệp cha",
  "Tên mẹ",
  "Nghề nghiệp mẹ",
  "Điện thoại",
  "Di động",
  "Email",
  "Ghi chú",
] as const;

export interface VneduParent {
  full_name: string | null;
  phone: string | null;
  email: string | null;
  relationship: string | null;
}

export interface VneduStudent {
  code: string | null;
  national_id: string | null;
  full_name: string;
  dob: string | null;
  gender: string | null;
  address: string | null;
  status?: string | null;
  parents?: VneduParent[];
}

function dobVN(d: string | null): string {
  if (!d) return "";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

function genderVN(g: string | null): string {
  if (g === "nam") return "Nam";
  if (g === "nu") return "Nữ";
  return "";
}

const STATUS_VN: Record<string, string> = {
  active: "Đang học",
  transferred: "Chuyển đi",
  graduated: "Tốt nghiệp",
  suspended: "Bảo lưu",
};

/**
 * Map 1 hoc sinh -> dong 26 cot mau 1 vnEdu.
 * - "Ma hoc sinh": ma noi bo cua truong (vnEdu se gan ma rieng cua ho khi nhap
 *   danh sach moi; cot nay la khoa doi chieu thu cong giong flow SMAS->vnEdu).
 * - "Ma VEMIS": ma dinh danh nganh 20 ky tu (TT 26/2019) - khoa ben vung
 *   xuyen he thong, day la truong CSDL nganh Bo nhan dien hoc sinh.
 * - Truong chua luu tru trong schema (dan toc, ho ngheo...) de trong dung
 *   cau truc - vnEdu bo qua o trong khi import.
 */
export function toVneduRow(s: VneduStudent, stt: number): string[] {
  const cha = s.parents?.find((p) => p.relationship === "cha");
  const me = s.parents?.find((p) => p.relationship === "me");
  const contact = cha ?? me ?? s.parents?.[0];
  return [
    String(stt),
    s.code ?? "",
    s.national_id ?? "",
    s.full_name,
    dobVN(s.dob),
    genderVN(s.gender),
    s.address ?? "",
    "", // Ho khau thuong tru - schema gom chung vao address
    "", // Noi sinh
    "", // Que quan
    "", // Dan toc
    "", // Ton giao
    "", // Dien chinh sach
    "", // Ho ngheo
    "", // Can ngheo
    "", // Doan vien
    "", // Doi vien
    "", // Con giao vien
    cha?.full_name ?? "",
    "", // Nghe nghiep cha
    me?.full_name ?? "",
    "", // Nghe nghiep me
    "", // Dien thoai (ban) - schema chi co 1 so lien he -> dat o Di dong
    contact?.phone ?? "",
    contact?.email ?? "",
    s.status && s.status !== "active" ? (STATUS_VN[s.status] ?? s.status) : "",
  ];
}

// ---------------------------------------------------------------------------
// IMPORT: parse file he thong cu (vnEdu/SMAS/CSV bat ky) -> ParsedStudentRow.
// ---------------------------------------------------------------------------

export interface ParsedStudentRow {
  line: number;
  code: string;
  nationalId: string;
  fullName: string;
  dob: string;
  gender: string;
  address: string;
  tenCha: string;
  tenMe: string;
  sdtPH: string;
  emailPH: string;
  errors: string[];
}

export function normalizeHeaderKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, "_");
}

type RowKey = keyof ParsedStudentRow | "hoDem" | "ten" | "hktt";

// Alias nhan dien header - bao phu file noi bo, file export SMAS va mau-1
// vnEdu. "Ma hoc sinh" la ma noi bo truong -> code; "Ma VEMIS" moi la ma
// dinh danh nganh -> nationalId (goc TT 26/2019).
const HEADER_ALIASES: Record<string, RowKey | null> = {
  code: "code",
  ma_hs: "code",
  mahs: "code",
  mssv: "code",
  stt: null, // bo qua cot so thu tu
  ma_hoc_sinh: "code",
  mahocsinh: "code",
  national_id: "nationalId",
  ma_dinh_danh: "nationalId",
  ma_dinh_danh_bo_gddt: "nationalId",
  ma_vemis: "nationalId",
  mavemis: "nationalId",
  ma_dinh_danh_quoc_gia: "nationalId",
  dinh_danh: "nationalId",
  full_name: "fullName",
  ho_ten: "fullName",
  hoten: "fullName",
  name: "fullName",
  ho_va_ten: "fullName",
  hovaten: "fullName",
  ho_ten_hoc_sinh: "fullName",
  ho_ten_hs: "fullName",
  ho_dem: "hoDem",
  hodem: "hoDem",
  ho_chu_dem: "hoDem",
  ten: "ten",
  ten_hs: "ten",
  dob: "dob",
  ngay_sinh: "dob",
  ngaysinh: "dob",
  ngay_thang_nam_sinh: "dob",
  ntns: "dob",
  gender: "gender",
  gioi_tinh: "gender",
  gioitinh: "gender",
  nam_nu: "gender",
  dia_chi: "address",
  diachi: "address",
  address: "address",
  cho_o_hien_nay: "address",
  noi_o_hien_nay: "address",
  ho_khau_thuong_tru: "hktt",
  hktt: "hktt",
  dia_chi_thuong_tru: "hktt",
  ten_cha: "tenCha",
  ho_ten_cha: "tenCha",
  ho_va_ten_cha: "tenCha",
  ten_me: "tenMe",
  ho_ten_me: "tenMe",
  ho_va_ten_me: "tenMe",
  // mau-1 co 2 cot Dien thoai (ban) + Di dong - uu tien Di dong (sau se de
  // len nho chi gan o co gia tri, xem parseStudentTable).
  dien_thoai_dd: "sdtPH",
  dien_thoai: "sdtPH",
  dien_thoai_di_dong: "sdtPH",
  di_dong: "sdtPH",
  didong: "sdtPH",
  sdt: "sdtPH",
  so_dien_thoai: "sdtPH",
  email: "emailPH",
  email_phu_huynh: "emailPH",
};

export function normalizeGender(g: string): "nam" | "nu" | "khac" | null {
  const n = normalizeHeaderKey(g);
  if (n === "nam") return "nam";
  if (n === "nu") return "nu";
  if (!g) return null;
  return "khac";
}

export function normalizeDob(d: string): string | null {
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

/**
 * Parse bang du lieu (rows x cells) tu file xlsx/csv thanh ParsedStudentRow[].
 * File export that cua vnEdu/SMAS co khoi tieu de (PHONG GD, TRUONG, LOP,
 * GVCN) o tren -> quet 10 dong dau tim dong header co >=2 cot nhan dien duoc.
 * Dong khong co header (4 cot vi tri) van ho tro nhu truoc.
 */
export function parseStudentTable(table: string[][]): ParsedStudentRow[] {
  if (table.length === 0) return [];
  let headerIdx = -1;
  let headerMap: (RowKey | null)[] = [];
  for (let i = 0; i < Math.min(10, table.length); i++) {
    const map = table[i].map((c) => HEADER_ALIASES[normalizeHeaderKey(c)] ?? null);
    const hits = map.filter((m) => m !== null && m !== undefined).length;
    // Chi tinh cot co alias khac null; header can >=2 cot nhan dien duoc
    if (hits >= 2) {
      headerIdx = i;
      headerMap = map;
      break;
    }
  }
  const hasHeader = headerIdx >= 0;
  const dataLines = hasHeader ? table.slice(headerIdx + 1) : table;
  return dataLines
    .filter((cells) => cells.some((c) => c && c.trim()))
    .map((cells, i) => {
      const row: ParsedStudentRow = {
        line: i + (hasHeader ? headerIdx + 2 : 1),
        code: "",
        nationalId: "",
        fullName: "",
        dob: "",
        gender: "",
        address: "",
        tenCha: "",
        tenMe: "",
        sdtPH: "",
        emailPH: "",
        errors: [],
      };
      const extra: Record<string, string> = {};
      if (hasHeader) {
        headerMap.forEach((key, idx) => {
          if (key && key !== "line" && key !== "errors") {
            // Chi gan o co gia tri - tranh cot trong (vd "Dien thoai" ban)
            // de mat gia tri cot sau (vd "Di dong").
            const v = cells[idx] ?? "";
            if (!v) return;
            if (key === "hoDem" || key === "ten" || key === "hktt") {
              extra[key] = v;
            } else {
              row[key] = v;
            }
          }
        });
        if (!row.address && extra.hktt) row.address = extra.hktt;
      } else {
        row.code = cells[0] ?? "";
        row.fullName = cells[1] ?? "";
        row.dob = cells[2] ?? "";
        row.gender = cells[3] ?? "";
      }
      // vnEdu mau 1: Ho dem + Ten tach cot -> gop thanh ho ten
      if (!row.fullName && (extra.hoDem || extra.ten)) {
        row.fullName = `${extra.hoDem ?? ""} ${extra.ten ?? ""}`.trim();
      }
      if (!row.fullName) row.errors.push("Thiếu họ tên");
      if (row.nationalId && !/^[0-9A-Za-z]{6,20}$/.test(row.nationalId.trim()))
        row.errors.push("Mã định danh gồm 6-20 ký tự số/chữ (TT 26/2019)");
      if (row.gender && !normalizeGender(row.gender))
        row.errors.push("Giới tính không hợp lệ");
      if (row.dob && !normalizeDob(row.dob))
        row.errors.push("Ngày sinh sai định dạng");
      return row;
    });
}
