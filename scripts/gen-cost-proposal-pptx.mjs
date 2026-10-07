/**
 * PROPOSAL: chi phi phat trien T10/2026 - T01/2027 (4 thang) - 2 phuong an cho TVC.
 * Giai doan build tu 04/09 (TVC360) + 11/09 (SCN) den 30/09: ben dev tu ganh, khong tinh.
 * node scripts/gen-cost-proposal-pptx.mjs -> docs/handover/PROPOSAL-chi-phi-dev-4thang.pptx
 */
import PptxGenJS from "pptxgenjs";
import { mkdirSync } from "node:fs";

const p = new PptxGenJS();
p.defineLayout({ name: "W", width: 13.33, height: 7.5 });
p.layout = "W";

const C = {
  ink: "0f172a", muted: "475569", accent: "0f766e", accentL: "ccfbf1",
  amber: "b45309", white: "ffffff", bg: "f8fafc", line: "e2e8f0", code: "1e293b",
  red: "b91c1c",
};
const FONT = "Segoe UI";

function slideTitle(s, section, title, desc) {
  s.addText(section, { x: 0.55, y: 0.28, w: 12, h: 0.3, fontFace: FONT, fontSize: 11, color: C.accent, bold: true });
  s.addText(title, { x: 0.55, y: 0.55, w: 12.2, h: 0.7, fontFace: FONT, fontSize: 25, bold: true, color: C.ink });
  if (desc) s.addText(desc, { x: 0.55, y: 1.24, w: 12.2, h: 0.45, fontFace: FONT, fontSize: 12.5, color: C.muted });
  s.addShape(p.shapes.LINE, { x: 0.55, y: 1.68, w: 12.2, h: 0, line: { color: C.line, width: 1 } });
}
function bullets(s, items, { x = 0.7, y = 1.9, w = 12, h = 5, fontSize = 13.5, gap = 8 } = {}) {
  s.addText(
    items.flatMap((it) => [
      ...((typeof it === "object" && it.t === undefined) ? [] : [{ text: String(it.t ?? it), options: { bullet: { code: "2022", indent: 14 }, breakLine: true, bold: !!it.b, color: it.c ?? C.ink } }]),
      ...(it.sub ?? []).map((t) => ({ text: String(t), options: { bullet: { code: "2013", indent: 30 }, breakLine: true, color: C.muted, fontSize: fontSize - 1.5 } })),
    ]),
    { x, y, w, h, fontFace: FONT, fontSize, color: C.ink, paraSpaceAfter: gap, valign: "top" },
  );
}
function table(s, rows, opts = {}) {
  s.addTable(
    rows.map((r, i) =>
      r.map((c) => ({
        text: String(c),
        options: {
          fontFace: FONT, fontSize: i === 0 ? 11.5 : 11.5, bold: i === 0 || opts.boldLast && i === rows.length - 1,
          color: i === 0 ? C.white : C.ink,
          fill: { color: i === 0 ? C.accent : i === rows.length - 1 && opts.boldLast ? C.accentL : i % 2 ? C.white : C.bg },
          valign: "middle", margin: 0.08,
        },
      })),
    ),
    { x: opts.x ?? 0.7, y: opts.y ?? 1.9, w: opts.w ?? 12, border: { pt: 0.75, color: C.line }, rowH: opts.rowH ?? 0.45 },
  );
}
function note(s, txt, y = 6.9) {
  s.addText(txt, { x: 0.7, y, w: 12, h: 0.45, fontFace: FONT, fontSize: 10.5, italic: true, color: C.accent });
}

// ---------- S1 Cover ----------
{
  const s = p.addSlide();
  s.background = { color: C.code };
  s.addText("ĐỀ XUẤT CHI PHÍ PHÁT TRIỂN - 4 THÁNG", {
    x: 0.8, y: 2.1, w: 11.7, h: 1, fontFace: FONT, fontSize: 32, bold: true, color: C.white,
  });
  s.addText("Giai đoạn T10/2026 - T01/2027 - VieSchool / Sổ Chủ Nhiệm Số + TVC360 - đội phát triển 3.3 FTE", {
    x: 0.8, y: 3.15, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 15, color: "5eead4",
  });
  s.addText("2 phương án phân chia chi phí cho giai đoạn build & pilot - gate demo trường 15/10/2026 - trình TVC",
    { x: 0.8, y: 3.8, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 13, color: "94a3b8" });
  s.addText("Đã triển khai từ 04/09/2026 - chi phí giai đoạn trước T10 do bên phát triển tự gánh, không tính trong đề xuất này",
    { x: 0.8, y: 4.35, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 11.5, italic: true, color: "64748b" });
}

// ---------- S2 Team & scope ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHẠM VI", "Team vận hành 4 tháng (T10/2026 - T01/2027) - build, test, pilot");
  table(s, [
    ["Vai trò", "Nhân sự", "Allocation", "Lương FTE (VND/tháng)", "Chi phí/tháng"],
    ["Backend / Fullstack", "Bình", "100%", "55 000 000", "55 000 000"],
    ["Backend", "Phiên", "100%", "40 000 000", "40 000 000"],
    ["QA / Tester", "Lan", "100%", "25 000 000", "25 000 000"],
    ["PM / PO / BA", "(PM)", "30%", "30 000 000", "9 000 000"],
    ["TỔNG NHÂN SỰ", "", "3.3 FTE", "", "129 000 000"],
  ], { boldLast: true });
  bullets(s, [
    { t: "Deliverables T10-T01: gate 15/10 bản demo core functions đẩy về trường → hoàn thiện ecosystem (SCN + Studio + Portal), pilot 3-5 trường thật, bank nội dung theo YCCĐ, quy trình duyệt 2 lớp, báo cáo DPIA/bảo mật.", y: 5.1 },
  ], { y: 5.1, fontSize: 12.5 });
}

// ---------- S2b Resource planning ----------
{
  const s = p.addSlide();
  slideTitle(s, "KẾ HOẠCH NHÂN LỰC", "Resource planning theo milestone - ai làm gì, tháng nào");
  table(s, [
    ["Nhân sự", "T10 - M1 (gate demo 15/10)", "T11 - M2", "T12 - M3", "T01 - M4"],
    ["Bình - Fullstack 100%", "Hardening core → demo 15/10, sau đó fix feedback + admin/phân quyền", "Bank câu hỏi + export DOCX + duyệt 2 lớp", "Pilot prep: data thật, HDSD, checklist", "Pilot trường thật + hardening"],
    ["Phiên - Backend 100%", "Môi trường demo ổn định + tài khoản trường + Schema/RLS", "ACL chi tiết + API duyệt + audit log", "Migration dữ liệu trường + backup", "Monitoring + hotfix pilot"],
    ["Lan - QA 100%", "Test core demo flows trước 15/10 + regression sau feedback", "E2E bank/duyệt + data coverage", "UAT cùng trường pilot + checklist", "Regression + báo cáo chất lượng"],
    ["PM / BA - 30%", "Đóng băng scope demo + checklist vận hành trường", "Review gate CR + rủi ro", "Đào tạo GV + tài liệu", "Báo cáo chuyên gia + handover"],
  ], { rowH: 0.78 });
  bullets(s, [
    { t: "Gate 15/10/2026 (yêu cầu TVC): bản demo core functions đẩy về trường - scope demo đóng băng trước đó, feedback sau demo triage vào backlog từ T11", c: C.red },
    { t: "Phía TVC: hội đồng chuyên môn duyệt 80 YCCĐ còn lại + pipeline 3-5 trường pilot - deliverable 2 chiều gắn cùng milestone", c: C.accent },
    { t: "AI API ramp cao nhất T11 (gen bank câu hỏi) - đã tính trong buffer ~4M/tháng" },
    { t: "Không tuyển thêm trong giai đoạn này - đánh giá scale-out sau pilot nếu >5 trường cùng lúc" },
  ], { y: 5.55, fontSize: 12 });
}

// ---------- S3 Chi phi tong ----------
{
  const s = p.addSlide();
  slideTitle(s, "CHI PHÍ 4 THÁNG", "Tổng burn rate T10/2026 - T01/2027 - minh bạch từng khoản");
  table(s, [
    ["Khoản", "Tháng (VND)", "4 tháng (VND)", "Ghi chú"],
    ["Nhân sự (3.3 FTE)", "129 000 000", "516 000 000", "Theo bảng trên"],
    ["Supabase Pro + compute", "~1 500 000", "6 000 000", "DB + Auth + Storage + Realtime"],
    ["Vercel Pro", "~600 000", "2 400 000", "Hosting + auto-deploy"],
    ["AI API (Gemini/OpenAI)", "~4 000 000", "16 000 000", "Sinh câu hỏi/KHBĐ; co gate kiểm soát"],
    ["Domain + Email (Resend) + tools", "~1 000 000", "4 000 000", "Domain, email PH, monitoring"],
    ["TỔNG / THÁNG", "136 100 000", "", ""],
    ["TỔNG 4 THÁNG", "", "544 400 000", "~545 triệu VND"],
  ], { boldLast: true });
  note(s, "Chưa gồm contingency 10% (~54M) cho phát sinh pilot - đề xuất ghi trong điều khoản, chỉ dùng khi có xác nhận 2 bên.", 6.45);
  note(s, "Không tính giai đoạn 04/09 - 30/09 (requirement TVC360 04/09, khởi động SCN 11/09) - ~1 tháng build nền tảng bên phát triển đã tự gánh.", 6.95);
}

// ---------- S4 Vi sao can ho tro ----------
{
  const s = p.addSlide();
  slideTitle(s, "BỐI CẢNH DEAL", "Tại sao giai đoạn đầu cần cơ chế chi phí riêng");
  bullets(s, [
    { t: "Deal hiện tại: TVC 70% - sản phẩm 30% doanh thu trong 2 năm đầu; sau đó 10% cổ phần + chức danh" },
    { t: "Timeline thực tế: nhận requirement TVC360 04/09, khởi động Sổ Chủ Nhiệm 11/09 - bên phát triển đã tự gánh ~1 tháng build đầu (sunk contribution thể hiện thiện chí, không tính trong đề xuất)", c: C.accent },
    { t: "Giai đoạn T10/2026 - T01/2027: doanh thu ≈ 0 (pilot free) nhưng burn rate ~136M/tháng", c: C.red },
    { t: "Nếu 30% doanh thu là nguồn thu duy nhất của bên phát triển → bên phát triển tài trợ 100% rủi ro build, trong khi upside lớn (70%) thuộc bên bán hàng", c: C.red },
    { t: "Best practice trong co-development/JV: bên thương mại hóa (giữ % doanh thu cao hơn) co-fund phần lớn chi phí build - đây là cách cân bằng rủi ro chuẩn, không phải ưu ái", c: C.accent },
    { sub: ["Tham chiếu: cost-sharing/co-funding trong product partnerships thường 40-60% chi phí build cho bên sales-led khi họ giữ majority revenue share", "Cơ chế recoupable advance (ứng trước khấu trừ vào royalty) là chuẩn trong publishing/licensing tech"] },
  ]);
}

// ---------- S5 Phuong an 1 ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHƯƠNG ÁN 1", "Đồng đầu tư (co-funding 50%) - tăng commitment 2 chiều");
  bullets(s, [
    { t: "TVC hỗ trợ 50% chi phí vận hành team trong 4 tháng (T10/2026 - T01/2027): ~68M/tháng, tổng ~272M VND", b: 1 },
    { t: "Bên phát triển gánh 50% còn lại (~272M) - đóng góp dạng sweat equity, không hoàn lại cho TVC", b: 1 },
    { t: "Best practice: cost-sharing 50% trong build phase khi đối tác sales giữ 70% doanh thu - mỗi bên cùng có 'skin in the game'", c: C.accent },
    { t: "Giải ngân theo milestone hàng tháng (M1-M4) gắn deliverables rõ ràng - TVC có quyền kiểm soát tiến độ:", },
    { sub: ["Gate 15/10: bản demo core functions đẩy về trường | M1 (T10): hoàn thiện + fix feedback demo", "M2 (T11): bank câu hỏi + export + duyệt 2 lớp | M3 (T12): pilot prep (data, hướng dẫn, checklist)", "M4 (T01/27): pilot trường thật + báo cáo chuyên gia"] },
    { t: "Rev share 70-30 giữ nguyên - phần 50% của TVC là co-investment, KHÔNG khấu trừ vào doanh thu sau này", c: C.accent },
  ]);
  note(s, "Ưu điểm: TVC chỉ bỏ ~272M cho 4 tháng - thấp hơn nhiều so với thuê dev shop; đổi lại commitment + kiểm soát milestone.");
}

// ---------- S6 Phuong an 2 ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHƯƠNG ÁN 2", "TVC nuôi quân ngay - khấu trừ khi 30% đủ cover (recoupable advance)");
  bullets(s, [
    { t: "TVC chi trả toàn bộ ~136M/tháng x 4 tháng (T10/2026 - T01/2027, tổng ~545M) dạng ỨNG TRƯỚC (advance), không lãi", b: 1 },
    { t: "Cơ chế hoàn: khi doanh thu đủ lớn để 30% của bên phát triển ≥ chi phí team hàng tháng, phần DƯ khấu trừ dần khoản advance", b: 1 },
    { sub: ["VD: tháng doanh thu 500M → 30% = 150M > 136M payroll → 14M dư trừ vào advance", "Không bao giờ clawback tiền mặt từ bên phát triển - chỉ trừ từ phần share tương lai"] },
    { t: "Best practice: đây là 'recoupable advance against royalty' - chuẩn trong licensing/publishing tech", c: C.accent },
    { t: "Nếu dự án dừng trước khi có doanh thu: advance không hoàn (rủi ro TVC chịu như nhà đầu tư commercialization), sản phẩm/IP về bên phát triển", b: 1 },
  ]);
  note(s, "Ưu điểm: team an toàn 100%; TVC thu hồi toàn bộ khi sản phẩm có doanh thu - rủi ro nằm ở timing, không mất vốn nếu thành công.");
}

// ---------- S7 So sanh ----------
{
  const s = p.addSlide();
  slideTitle(s, "SO SÁNH & ĐỀ XUẤT", "2 phương án đặt cạnh nhau");
  table(s, [
    ["Tiêu chí", "PA 1 - Co-funding 50%", "PA 2 - Recoupable advance 100%"],
    ["TVC bỏ ra 4 tháng", "~272M (không hoàn)", "~545M (hoàn dần từ doanh thu)"],
    ["Rủi ro TVC", "Thấp - số tiền nhỏ, mất tối đa 272M", "Trung bình - mất tối đa 545M nếu dự án dừng"],
    ["Rủi ro bên dev", "Vẫn gánh ~272M burn + cơ hội", "Gần như 0 trong giai đoạn build"],
    ["Commitment thể hiện", "Cao - 2 bên cùng bỏ tiền thật", "Cao - TVC all-in vận hành"],
    ["Khi thành công", "TVC tiết kiệm được (không phải hoàn)", "TVC thu hồi toàn bộ advance"],
    ["Phù hợp khi", "TVC muốn rủi ro thấp + test độ tin cậy", "TVC tin sản phẩm + muốn giữ chân team chất"],
  ]);
  note(s, "Đề xuất thương lượng: mở PA2 làm anchor (chuẩn licensing), nhận PA1 làm điểm chốt win-win tối thiểu.");
}

// ---------- S8 Dieu khoan kem theo ----------
{
  const s = p.addSlide();
  slideTitle(s, "ĐIỀU KHOẢN BẮT BUỘC KÈM THEO", "Bất kể chọn phương án nào");
  bullets(s, [
    { t: "Clock 24 tháng 70-30 chỉ đếm từ khách trả phí đầu tiên - thời gian pilot free KHÔNG tính" },
    { t: "Pilot free giới hạn ~6 tháng hoặc N trường → sau đó bắt buộc roadmap thu phí" },
    { t: "Cổ phần 10% vesting ngay từ khi ký (vest theo 2-3 năm), ghi rõ entity + anti-dilution - không phải hứa sau 2 năm" },
    { t: "IP codebase thuộc bên phát triển; TVC nhận license sử dụng trong phạm vi dự án; terminate → IP giữ nguyên, hợp đồng khách đang chạy vẫn chia % đến hết kỳ" },
    { t: "Báo cáo doanh thu hàng tháng + audit rights; chi phí infra trừ khỏi gross trước khi chia" },
    { t: "Milestone/deliverables 2 chiều: dev giao sản phẩm ↔ TVC giao pipeline trường (commitment sale đi đôi 70%)" },
    { t: "Phần build 04/09 - 30/09 đã hoàn thành là contribution của bên phát triển - không đưa vào cost-share, không khấu trừ" },
    { t: "Phạm vi 'core functions' cho bản demo 15/10 chốt bằng văn bản trước gate - feedback trường sau demo đi vào backlog chung, không tính thay đổi scope cam kết" },
  ]);
}

// ---------- S9 Tom tat ----------
{
  const s = p.addSlide();
  slideTitle(s, "TÓM TẮT CHO TVC", "Con số mang đi negotiate");
  table(s, [
    ["Mục", "Nội dung đề xuất"],
    ["Giai đoạn", "T10/2026 - T01/2027 (4 tháng); phần build 04-30/09 bên dev đã tự gánh, không tính"],
    ["Chi phí 4 tháng", "~545M VND (129M nhân sự + ~7M infra, mỗi tháng)"],
    ["PA1 - Co-funding", "TVC ứng 50% (~272M/4th), không hoàn; dev gánh 50% sweat equity"],
    ["PA2 - Nuôi quân", "TVC ứng 100% (~545M/4th), khấu trừ từ 30% khi doanh thu đủ"],
    ["Rev share", "Giữ nguyên 70-30 từ khách paid đầu tiên, 24 tháng"],
    ["Equity", "10% vesting từ ngày ký, ghi văn bản"],
    ["Milestone", "Gate demo trường 15/10; giải ngân M1-M4 = T10 / T11 / T12 / T01 gắn deliverables"],
  ]);
  note(s, "Bản chất: TVC mua năng lực team 3.3 FTE với giá ~136M/tháng - rẻ hơn 40-60% so với thuê ngoài cùng scope, và được giữ 70% upside.");
}

mkdirSync("docs/handover", { recursive: true });
await p.writeFile({ fileName: "docs/handover/PROPOSAL-chi-phi-dev-4thang.pptx" });
console.log("Written docs/handover/PROPOSAL-chi-phi-dev-4thang.pptx");
