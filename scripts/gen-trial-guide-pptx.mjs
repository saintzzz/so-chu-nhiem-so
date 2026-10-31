/**
 * CR-077: Huong dan dung thu cho khach trial - truong THCS Trial (TRIAL01).
 * node scripts/gen-trial-guide-pptx.mjs -> docs/user-guide/HUONG-DAN-DUNG-THU.pptx
 */
import PptxGenJS from "pptxgenjs";
import { mkdirSync } from "node:fs";

const p = new PptxGenJS();
p.defineLayout({ name: "W", width: 13.33, height: 7.5 });
p.layout = "W";

const C = {
  ink: "0f172a", muted: "475569", accent: "0f766e", accentL: "ccfbf1",
  amber: "b45309", white: "ffffff", bg: "f8fafc", line: "e2e8f0",
  code: "1e293b", red: "b91c1c",
};
const FONT = "Segoe UI";

function slideTitle(s, section, title, desc) {
  s.addText(section, { x: 0.55, y: 0.28, w: 12, h: 0.3, fontFace: FONT, fontSize: 11, color: C.accent, bold: true });
  s.addText(title, { x: 0.55, y: 0.55, w: 12.2, h: 0.7, fontFace: FONT, fontSize: 26, bold: true, color: C.ink });
  if (desc) s.addText(desc, { x: 0.55, y: 1.28, w: 12.2, h: 0.45, fontFace: FONT, fontSize: 12.5, color: C.muted });
  s.addShape(p.shapes.LINE, { x: 0.55, y: 1.72, w: 12.2, h: 0, line: { color: C.line, width: 1 } });
}

function bullets(s, items, { x = 0.7, y = 1.95, w = 12, h = 5, fontSize = 13.5, gap = 8 } = {}) {
  s.addText(
    items.flatMap((it) =>
      it.sub
        ? [
            { text: String(it.t), options: { bullet: { code: "2022", indent: 14 }, breakLine: true, bold: !!it.b, color: it.c ?? C.ink } },
            ...it.sub.map((t) => ({ text: t, options: { bullet: { code: "2013", indent: 30 }, breakLine: true, color: C.muted, fontSize: fontSize - 1.5 } })),
          ]
        : [{ text: String(it.t ?? it), options: { bullet: { code: "2022", indent: 14 }, breakLine: true, bold: !!it.b, color: it.c ?? C.ink } }],
    ),
    { x, y, w, h, fontFace: FONT, fontSize, color: C.ink, paraSpaceAfter: gap, valign: "top" },
  );
}

// ---------- Slide 1: cover ----------
{
  const s = p.addSlide();
  s.background = { color: C.accent };
  s.addText("VieSchool - So Chu Nhiem So", { x: 0.8, y: 2.0, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 16, color: C.accentL, bold: true });
  s.addText("Huong dan trai nghiem ban dung thu", { x: 0.8, y: 2.5, w: 11.7, h: 1.0, fontFace: FONT, fontSize: 36, bold: true, color: C.white });
  s.addText("Tai khoan demo truong THCS Trial - VieSchool (ma TRIAL01)", { x: 0.8, y: 3.6, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 15, color: C.accentL });
  s.addText("Phien ban: thang 10/2026 - chi mo cac tac vu co ban", { x: 0.8, y: 6.6, w: 11.7, h: 0.4, fontFace: FONT, fontSize: 11, color: C.accentL });
}

// ---------- Slide 2: dang nhap ----------
{
  const s = p.addSlide();
  slideTitle(s, "BAT DAU", "Dang nhap he thong", "Truy cap link ben duoi, chon 1 trong 4 tai khoan theo vai tro muon trai nghiem");
  s.addShape(p.shapes.RECTANGLE, { x: 0.7, y: 1.95, w: 11.9, h: 0.62, fill: { color: C.accentL }, line: { color: C.accent, width: 1 } });
  s.addText("https://vieschool.com/login", { x: 0.9, y: 2.05, w: 11.5, h: 0.42, fontFace: "Consolas", fontSize: 20, bold: true, color: C.accent });
  const rows = [
    ["Vai tro", "Tai khoan email", "Mat khau", "Dung de trai nghiem"],
    ["Hieu truong / BGH", "hieutruong@trial.scn", "Trial@2026", "Dashboard cap truong, xep TKB, so dau bai"],
    ["GV chu nhiem", "chunhiem@trial.scn", "Trial@2026", "Diem danh, bao cao ngay, so chu nhiem"],
    ["GV bo mon", "giaovien@trial.scn", "Trial@2026", "TKB ca nhan, so dau bai theo tiet"],
    ["GV bo mon 2", "giaovien2@trial.scn", "Trial@2026", "Tai khoan phu de xem phan cong"],
  ];
  s.addTable(rows.map((r, i) => r.map((t) => ({
    text: t,
    options: {
      fontFace: FONT, fontSize: i === 0 ? 12.5 : 12,
      bold: i === 0, color: i === 0 ? C.white : C.ink,
      fill: { color: i === 0 ? C.accent : i % 2 ? C.bg : C.white },
      valign: "middle", margin: 6,
    },
  }))), { x: 0.7, y: 2.85, w: 11.9, colW: [2.6, 3.6, 1.9, 3.8], rowH: 0.52 });
  s.addText("Luu y: day la tai khoan demo - moi truong tach biet hoan toan voi du lieu that.", { x: 0.7, y: 6.9, w: 11.9, h: 0.4, fontFace: FONT, fontSize: 11.5, italic: true, color: C.muted });
}

// ---------- Slide 3: du lieu co san ----------
{
  const s = p.addSlide();
  slideTitle(s, "DU LIEU DEMO", "Du lieu mau da nap san", "Truong trial duoc khoi tao voi du lieu thuc te de trai nghiem ngay, khong can nhap them");
  bullets(s, [
    { t: "4 lop hoc: 6A1, 7A1, 8A1, 9A1 - moi lop 8 hoc sinh (tong 32 HS)", b: true },
    { t: "Thoi khoa bieu day du: 120 tiet/tuan, 14 mon hoc, 4 giao vien phan cong" },
    { t: "Du lieu diem danh hom nay: co hoc sinh vang co phep va di muon de xem bao cao" },
    { t: "1 nam hoc dang hoat dong - dung cau truc nam hoc Viet Nam" },
    { t: "Ho so hoc sinh day du truong co ban (ten, lop) - mot so truong de trong de khach tu dien" },
  ]);
}

// ---------- Slide 4: chuc nang duoc mo ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHAM VI DUNG THU", "Cac chuc nang dang mo", "Ban trial chi mo cac tac vu co ban nhat - gon nhe, de lam quen");
  bullets(s, [
    { t: "Dashboard theo vai tro (hieu truong / GVCN / GVBM)", b: true },
    { t: "Diem danh hang ngay theo lop", b: true },
    { sub: ["Cham co mat / vang co phep / vang khong phep / di muon", "Bao cao ngay gui Ban Giam Hieu", "Theo doi ti le chuyen can, lich su"] },
    { t: "Quan ly hoc sinh co ban", b: true },
    { sub: ["Danh sach hoc sinh va to, so do cho ngoi", "Nhan xet, vi pham, khen thuong, danh gia ren luyen"] },
    { t: "Thoi khoa bieu va so dau bai", b: true },
    { sub: ["Xem TKB theo lop va theo giao vien", "So dau bai theo tiet cho GVBM"] },
    { t: "Ho so ca nhan, doi mat khau, thong bao trong he thong" },
  ]);
}

// ---------- Slide 5: chuc nang bi khoa ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHAM VI DUNG THU", "Cac chuc nang tam khoa", "Cac phan he nang cao bi an trong ban dung thu - menu khong hien, truy cap truc tiep se quay ve dashboard");
  bullets(s, [
    { t: "Tuyen sinh, khoan thu hoc phi, bien dong hoc sinh", c: C.red },
    { t: "Hoc ba dien tu, xuat XML, ky so, xet tot nghiep" },
    { t: "Ky thi va danh gia, ngan hang cau hoi, LMS, AI Studio" },
    { t: "Thu vien, y te - BHYT, van thu, dieu dong giao vien" },
    { t: "Tich hop he thong (CSDL Bo, VNeID, cong thanh toan)" },
    { t: "Dashboard cap So GD, phan quyen quan tri he thong" },
  ]);
  s.addText("Muon mo them chuc nang trong thoi gian dung thu? Lien he doi VieSchool - bat module la dung duoc ngay, khong can cai lai.", { x: 0.7, y: 6.5, w: 11.9, h: 0.6, fontFace: FONT, fontSize: 12.5, italic: true, color: C.amber });
}

// ---------- Slide 6: kich ban trai nghiem ----------
{
  const s = p.addSlide();
  slideTitle(s, "KICH BAN GOI Y", "15 phut trai nghiem", "Quy trinh mau de cam nhan gia tri cua he thong");
  const steps = [
    ["Buoc", "Vai tro", "Thao tac", "Ket qua mong doi"],
    ["1", "GVCN", "Dang nhap chunhiem@trial.scn - vao Diem danh hang ngay, cham diem lop 6A1", "Luu diem danh, so lieu cap nhat ngay"],
    ["2", "GVCN", "Vao Bao cao ngay cho BGH - gui bao cao", "Bao cao chuyen sang trang thai da gui"],
    ["3", "BGH", "Dang nhap hieutruong@trial.scn - xem Dashboard cap truong", "Thay ty le chuyen can, so lop chua nop KPI"],
    ["4", "BGH", "Vao Xep thoi khoa bieu - xem TKB 4 lop", "Luo TKB day du 5 tiet x 6 ngay"],
    ["5", "GVBM", "Dang nhap giaovien@trial.scn - xem TKB ca nhan", "Lich day cua rieng minh theo tuan"],
    ["6", "GVCN", "Thu vao 1 chuc nang bi khoa (vd dan link cua BGH)", "He thong tu dong quay ve dashboard"],
  ];
  s.addTable(steps.map((r, i) => r.map((t) => ({
    text: t,
    options: {
      fontFace: FONT, fontSize: i === 0 ? 12 : 11,
      bold: i === 0, color: i === 0 ? C.white : C.ink,
      fill: { color: i === 0 ? C.accent : i % 2 ? C.bg : C.white },
      valign: "middle", margin: 5,
    },
  }))), { x: 0.7, y: 1.95, w: 11.9, colW: [0.9, 1.4, 5.4, 4.2], rowH: 0.62 });
}

// ---------- Slide 7: bao mat & FAQ ----------
{
  const s = p.addSlide();
  slideTitle(s, "BO SUNG", "Bao mat du lieu va cau hoi thuong gap");
  bullets(s, [
    { t: "Du lieu moi truong tach biet theo truong - truong khac khong thay du lieu cua ban", b: true },
    { t: "Truong trial dung chung he thong voi du lieu demo khac - khong dung de nhap du lieu that" },
    { t: "Mat khau doi duoc ngay trong Ho so ca nhan - Doi mat khau" },
    { t: "Het han dung thu: tai khoan co the bi khoa hoac reset du lieu - bao truoc voi doi ban hang" },
    { t: "Ho tro: lien he doi VieSchool khi can mo them module, nhap du lieu that, hoac dao tao them" },
  ]);
}

mkdirSync("docs/user-guide", { recursive: true });
await p.writeFile({ fileName: "docs/user-guide/HUONG-DAN-DUNG-THU.pptx" });
console.log("OK -> docs/user-guide/HUONG-DAN-DUNG-THU.pptx");
