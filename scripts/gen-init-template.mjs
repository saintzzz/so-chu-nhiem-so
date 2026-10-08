/**
 * CR-039: sinh file Excel mau khoi tao truong moi.
 * node scripts/gen-init-template.mjs -> docs/templates/khoi-tao-truong.xlsx
 * Workbook nay la input cua scripts/bootstrap-school.mjs.
 */
import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";

const wb = new ExcelJS.Workbook();
wb.creator = "VieSchool";
wb.created = new Date();

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" } };

function sheet(name, headers, widths, rows, notes) {
  const ws = wb.addWorksheet(name);
  ws.columns = headers.map((h, i) => ({ header: h, key: h, width: widths[i] ?? 18 }));
  ws.getRow(1).eachCell((c) => {
    c.fill = HEADER_FILL;
    c.font = HEADER_FONT;
    c.alignment = { vertical: "middle", wrapText: true };
  });
  ws.getRow(1).height = 22;
  for (const r of rows) ws.addRow(r);
  if (notes) {
    ws.addRow([]);
    const nr = ws.addRow(notes);
    nr.font = { italic: true, color: { argb: "FF475569" }, size: 10 };
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return ws;
}

/* ---------- Sheet huong dan ---------- */
{
  const ws = wb.addWorksheet("huong_dan");
  ws.columns = [{ width: 110 }];
  const lines = [
    "FILE MAU KHOI TAO TRUONG MOI - SO CHU NHIEM SO",
    "",
    "CAC BUOC (chi tiet: docs/user-guide/KHOI-TAO-TRUONG-MOI.md):",
    "1. So GD&DT/admin tao truong tai /dept/schools -> nhan id hoac ma truong.",
    "2. Dien cac sheet ben duoi. Cot co dau (*) la bat buoc. De trong = bo qua.",
    "3. Chay khoi tao:",
    "   node scripts/bootstrap-school.mjs --file khoi-tao-truong.xlsx --school <ma-truong> --apply",
    "   Bo --apply de chay thu (chi kiem tra loi, khong ghi).",
    "",
    "THU TU CAC SHEET (khong can doi - script tu xu ly theo thu tu dung):",
    "  co_so         - cac co so cua truong (truong 1 co so van nen khai Cơ so chinh)",
    "  to_chuyen_mon - cac to bo mon + mon phu trach + email truong to",
    "  can_bo        - toan bo can bo co tai khoan (BGH, PHT, ke toan, to truong, GVCN, GVBM)",
    "  lop           - danh sach lop + email GVCN",
    "  hoc_sinh      - danh sach hoc sinh theo lop",
    "  phu_huynh     - phu huynh + ma HS cua con (nhieu con: ngan cach bang dau ,)",
    "  tkb           - thoi khoa bieu toan truong (hoac nhap trong app: TKB -> Nhap Excel)",
    "",
    "QUY UOC GIA TRI:",
    "  vai_tro:      bgh | pht | to_truong | gvcn | gvbm | ke_toan",
    "  vai_tro_kiem: danh sach ngan cach boi dau , trong cung bo: gvcn, gvbm, to_truong, bgh, pht",
    "                (vd: GVCN kiem day + lam to truong -> gvcn o vai_tro, 'gvbm,to_truong' o kiem)",
    "  loai co_so:   main | phan_hieu | diem_truong",
    "  gioi_tinh:    nam | nu",
    "  thu (TKB):    so 2-7 (Thu 2 - Thu 7)",
    "  ngay_sinh:    YYYY-MM-DD",
    "  hop_dong:     bien_che | hop_dong | thinh_giang",
    "",
    "LUU Y:",
    "  - mon_phu_trach / mon_day phai TRUNG TEN voi bo mon da tao san cho truong",
    "    (bo mon tu dong theo cap hoc khi tao truong: xem trang /school/staff hoac phu luc guide).",
    "  - Email la khoa dinh danh: can_bo/gvcn/phu_huynh/giao_vien TKB deu tham chieu bang email.",
    "  - mat_khau toi thieu 8 ky tu; de trong o phu_huynh = chi tao ho so, khong cap tai khoan.",
    "  - Chay lai file 2 lan an toan: ban ghi da co se duoc cap nhat/bo qua, khong nhan doi.",
    "  - XOA DONG VI DU (cac dong mau mau xam) truoc khi chay that.",
  ];
  for (const l of lines) {
    const r = ws.addRow([l]);
    if (l === lines[0]) r.font = { bold: true, size: 14, color: { argb: "FF0F766E" } };
    if (l.startsWith("CAC BUOC") || l.startsWith("QUY UOC") || l.startsWith("LUU Y") || l.startsWith("THU TU"))
      r.font = { bold: true };
  }
}

/* ---------- co_so ---------- */
sheet(
  "co_so",
  ["ten (*)", "loai (*)", "dia_chi"],
  [30, 14, 40],
  [
    ["Cơ sở chính", "main", "Số 1, đường ABC, phường XYZ"],
    ["Cơ sở 2", "phan_hieu", "Số 25, đường DEF (xóa nếu trường 1 cơ sở)"],
  ],
);

/* ---------- to_chuyen_mon ---------- */
sheet(
  "to_chuyen_mon",
  ["ten (*)", "mon_phu_trach", "truong_to_email"],
  [26, 50, 26],
  [
    ["Tổ Toán - Tự nhiên", "Toán, Vật lý, Hóa học, Sinh học, Tin học, Công nghệ", "lananh.pt@truong.vn"],
    ["Tổ Văn - Xã hội", "Ngữ văn, Tiếng Anh, Lịch sử, Địa lý, GDCD", "hung.nv@truong.vn"],
    ["Tổ Thể chất - Nghệ thuật", "Thể dục, Âm nhạc, Mỹ thuật", "binh.vt@truong.vn"],
  ],
  "mon_phu_trach: ten mon ngan cach boi dau phay, phai trung ten bo mon cua truong (tao san theo cap hoc).",
);

/* ---------- can_bo ---------- */
sheet(
  "can_bo",
  [
    "ho_ten (*)", "email (*)", "mat_khau (*)", "vai_tro (*)", "vai_tro_kiem",
    "ma_nv", "hop_dong", "trinh_do", "co_so", "to_chuyen_mon", "mon_day",
  ],
  [24, 26, 14, 10, 14, 10, 12, 22, 14, 20, 30],
  [
    ["Nguyễn Văn Hải", "hai.nv@truong.vn", "MatKhau@2026", "bgh", "gvbm", "HT001", "bien_che", "Thạc sĩ QLGD", "Cơ sở chính", "", "Toán"],
    ["Phạm Thị Lan Anh", "lananh.pt@truong.vn", "MatKhau@2026", "gvcn", "gvbm,to_truong", "GV012", "bien_che", "Cử nhân Sư phạm Toán", "Cơ sở chính", "Tổ Toán - Tự nhiên", "Toán"],
    ["Trần Văn Minh", "minh.tv@truong.vn", "MatKhau@2026", "gvbm", "", "GV023", "hop_dong", "Cử nhân Vật lý", "Cơ sở chính", "Tổ Toán - Tự nhiên", "Vật lý"],
    ["Lê Minh Đức", "duc.lm@truong.vn", "MatKhau@2026", "pht", "gvbm", "PHT01", "bien_che", "Cử nhân Sư phạm", "Cơ sở 2", "", "GDCD"],
    ["Phạm Thu Trang", "trang.pt@truong.vn", "MatKhau@2026", "ke_toan", "", "KT001", "bien_che", "Cử nhân Kế toán", "Cơ sở chính", "", ""],
    ["Nguyễn Văn Hùng", "hung.nv@truong.vn", "MatKhau@2026", "to_truong", "gvbm", "GV031", "bien_che", "Cử nhân Sư phạm Văn", "Cơ sở chính", "Tổ Văn - Xã hội", "Ngữ văn"],
    ["Vũ Thị Bình", "binh.vt@truong.vn", "MatKhau@2026", "gvcn", "gvbm", "GV045", "bien_che", "Cử nhân Thể dục", "Cơ sở 2", "Tổ Thể chất - Nghệ thuật", "Thể dục"],
  ],
  "vai_tro_kiem: gvcn day kem -> gvbm; lam them to truong -> them to_truong. admin khong duoc kiem.",
);

/* ---------- lop ---------- */
sheet(
  "lop",
  ["ten (*)", "khoi (*)", "co_so", "gvcn_email"],
  [12, 10, 16, 26],
  [
    ["6A1", 6, "Cơ sở chính", "lananh.pt@truong.vn"],
    ["6A2", 6, "Cơ sở chính", ""],
    ["7A1", 7, "Cơ sở 2", "binh.vt@truong.vn"],
  ],
  "khoi: so khoi (6-9 cho THCS, 1-5 cho TH, 10-12 THPT). gvcn_email: email can bo chu nhiem.",
);

/* ---------- hoc_sinh ---------- */
sheet(
  "hoc_sinh",
  ["ma_hs (*)", "ho_ten (*)", "ngay_sinh", "gioi_tinh", "lop (*)", "ma_dinh_danh"],
  [12, 26, 14, 10, 10, 16],
  [
    ["HS0001", "Nguyễn Gia Bảo", "2014-03-15", "nam", "6A1", "00114000001"],
    ["HS0002", "Trần Thu Hà", "2014-06-20", "nu", "6A1", "00114000002"],
    ["HS0003", "Lê Quốc Bảo", "2014-01-08", "nam", "6A2", ""],
    ["HS0004", "Phạm Ngọc Linh", "2013-11-02", "nu", "7A1", ""],
  ],
  "ma_hs duy nhat toan he thong (vd: ma truong + so thu tu). ma_dinh_danh: CCCD/dinh danh ca nhan neu co.",
);

/* ---------- phu_huynh ---------- */
sheet(
  "phu_huynh",
  ["ho_ten (*)", "quan_he", "dien_thoai", "email", "ma_hs_con (*)", "mat_khau"],
  [24, 12, 14, 26, 18, 14],
  [
    ["Nguyễn Văn An", "bố", "0901234567", "an.nv@mail.vn", "HS0001", "PhuHuynh@2026"],
    ["Trần Thị Hương", "mẹ", "0907654321", "huong.tt@mail.vn", "HS0002", "PhuHuynh@2026"],
    ["Lê Văn Nam", "bố", "0913456789", "", "HS0003, HS0004", ""],
  ],
  "ma_hs_con: nhieu con ngan cach boi dau phay. email + mat_khau -> cap tai khoan cong phu huynh; de trong = chi luu lien lac.",
);

/* ---------- tkb ---------- */
sheet(
  "tkb",
  ["lop (*)", "thu (*)", "tiet (*)", "mon (*)", "giao_vien_email", "phong"],
  [10, 8, 8, 16, 26, 12],
  [
    ["6A1", 2, 1, "Toán", "lananh.pt@truong.vn", "P201"],
    ["6A1", 2, 2, "Ngữ văn", "hung.nv@truong.vn", "P201"],
    ["6A1", 2, 3, "Tiếng Anh", "", "P201"],
    ["7A1", 2, 1, "Thể dục", "binh.vt@truong.vn", "Sân vận động"],
  ],
  "thu: 2-7. tiet: 1-10. mon trung ten bo mon cua truong. giao_vien_email de trong = tiet trong.",
);

mkdirSync("docs/templates", { recursive: true });
await wb.xlsx.writeFile("docs/templates/khoi-tao-truong.xlsx");
console.log("Wrote docs/templates/khoi-tao-truong.xlsx");
