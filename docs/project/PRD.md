# PRD — Sổ Chủ Nhiệm Số

**Phase 2 output — BA** | Date: 2026-09-19 | Sources: clone recon + sitemap + stakeholder Q&A
**Knowledge check:** NotebookLM queried (BA notebook unrelated domain — no grounding available). DeepWiki used in Phase 4 for stack standards.

## 1. Problem

GVCN tại trường THCS VN phải quản lý thủ công nhiều loại sổ sách: sổ chủ nhiệm, chuyên cần, hạnh kiểm, liên lạc phụ huynh, thi đua, sự cố an toàn. App số hóa toàn bộ workflow này, đa vai trò (giáo viên → BGH → Sở GD&ĐT → phụ huynh/học sinh).

## 2. Personas

| Persona | Role | Core needs |
|---|---|---|
| Cô Lan Anh — GVCN | `gvcn` | Điểm danh nhanh, xem cảnh báo lớp, nhận xét HS, liên lạc PH, xuất sổ |
| Thầy Minh — GVBM | `gvbm` | Nhập/đồng bộ điểm, trao đổi GVCN, ghi sổ đầu bài |
| Cô Hoa — Tổ trưởng | `to_truong` | Duyệt đánh giá năng lực GV, sinh hoạt chuyên môn |
| Thầy Hiệu trưởng | `bgh` | Dashboard trường, radar cảnh báo sớm, duyệt sổ |
| Admin Sở | `so_gd` | Quản trị users, dashboard cấp Sở, quản trị dữ liệu |
| Phụ huynh | `phu_huynh` | Xem tình trạng con, nhận thông báo, đặt lịch hẹn |
| Học sinh | `hoc_sinh` | Xem điểm, chuyên cần, nhận xét của mình |

## 3. Functional requirements by module

### M0 — Auth & platform (P0)
- Login email/password (Supabase Auth) → route to role surface
- Role switcher (demo mode cho users có nhiều role? — target allows demo switch; với backend thật, role lấy từ DB)
- Shell: sidebar accordion (13 sections), header (breadcrumb, Ctrl+K search, notifications, role badge, logout), mobile hamburger

### M1 — Dashboard GVCN (P0)
- Greeting + lớp chủ nhiệm + quick actions (Điểm danh, Ghi nhận tuyên dương)
- 10 KPI cards: vắng hôm nay, đi muộn, tỷ lệ chuyên cần, nguy cơ học lực, nguy cơ vi phạm, cần tư vấn, TB chưa đọc, việc sắp hạn, hạng thi đua, hồ sơ chưa xong — mỗi card link tới module tương ứng
- "Việc cần làm hôm nay" list
- Chart: điểm TB lớp theo tháng (SVG + toggle bảng dữ liệu)
- Activity feed

### M2 — Hồ sơ lớp học (P0)
- DS lớp chủ nhiệm theo năm học; tiếp nhận lớp; upload DS HS (CSV/Excel parse); chi tiết hồ sơ HS; lịch sử cập nhật; báo cáo tổng hợp

### M3 — Chuyên cần (P0)
- Điểm danh hàng ngày: roster HS, radio 4 trạng thái (có mặt/vắng CP/vắng KP/đi muộn), auto-merge từ Sổ đầu bài
- Quản lý nghỉ học/đi muộn; thông báo PH; theo dõi tình trạng; lịch sử

### M4 — Học tập (P0)
- Nhập/đồng bộ điểm; phân tích kết quả (phân bố, top/bottom); HS cần hỗ trợ; trao đổi GVBM; trao đổi PH; kế hoạch hỗ trợ

### M5 — Rèn luyện (P0)
- Nhận xét, vi phạm/khen thưởng; đánh giá & xếp loại hạnh kiểm; trao đổi HS

### M6 — Tư vấn HS (P1)
- Tiếp nhận & phát hiện; đánh giá mức độ; chuyển tuyến chuyên gia

### M7 — Phụ huynh (P0)
- Soạn & gửi thông báo (cả lớp/cá nhân); hộp thư phản hồi; lịch hẹn; cổng thông tin PH

### M8 — Hoạt động GD (P1)
- Lập KH & phê duyệt; thông báo & đăng ký; điểm danh & đánh giá hoạt động

### M9 — An toàn HS (P0)
- Ghi nhận sự cố (mức độ, loại); báo cáo BGH; theo dõi & nhắc; lưu trữ & tra cứu

### M10 — Sổ chủ nhiệm (P0 — core)
- DS HS & Tổ; gán chức danh BCS (lớp trưởng/phó/tổ trưởng); điểm tích cực
- **Sơ đồ lớp kéo-thả** (grid ≤12×12, drag HS, chế độ tuyên dương, copy tháng trước, export PDF/PNG, version history)
- Upload lịch năm học; gợi ý công việc (rule-based, không AI thật); KH tháng/sơ kết tuần; đăng ký KPI; ký duyệt sổ; duyệt & khóa sổ học bạ; xuất sổ; nhật ký thao tác

### M11 — TKB & Sổ đầu bài (P0)
- Thời khóa biểu lớp (grid tuần); sổ đầu bài theo tiết (GVBM ghi sĩ số vắng → feed M3)

### M12 — Thi đua (P1)
- Thu thập & tính điểm theo tiêu chí; xếp hạng & khen thưởng

### M13 — Năng lực GVCN (P2)
- Tự đánh giá & KH; minh chứng & đánh giá cuối năm

### M14 — School/dept level (P1)
- BGH: dashboard trường, radar cảnh báo sớm, duyệt sổ/KPI, school views của VII/VIII/IX/XIII/X
- Sở GD&ĐT: quản trị users, dashboard cấp Sở, quản trị dữ liệu
- Tổ trưởng: trang chủ tổ, DS GV, duyệt đánh giá, sinh hoạt chuyên môn

### M15 — Portals (P0)
- Phụ huynh: trạng thái con hôm nay, tỷ lệ CC tháng, điểm TB, thông báo, lịch hẹn
- Học sinh: tương tự self-view

## 4. Non-functional

- Vietnamese UI, vi-VN locale, Figtree font
- Design tokens parity (extracted set)
- Responsive 1440/768/390
- RLS: users chỉ thấy data theo role + phạm vi (GVCN → lớp mình; BGH → trường; Sở → cụm; PH → con mình; HS → bản thân)
- a11y: semantic nav, keyboard (Ctrl+K), contrast AA
- Perf: seeded demo scale (1 trường, ~8 lớp, ~300 HS)

## 5. Seed data spec (agent-generated)

- 1 trường THCS (tên mới, ví dụ "THCS Nguyễn Du"), năm học 2026-2027
- ~8 lớp (6A1-9A2), 35-40 HS/lớp (~300 HS, tên VN đa dạng)
- ~20 GV (GVCN + GVBM các môn), BGH, admin Sở, ~40 PH, HS accounts
- Điểm 2 học kỳ các môn, chuyên cần ~3 tháng, hạnh kiểm, 5-8 sự cố an toàn, thông báo, lịch hẹn, thi đua, sơ đồ lớp, TKB, sổ đầu bài

## 6. Acceptance criteria

- [ ] Login từng role → đúng surface, RLS scope đúng
- [ ] Mọi screen trong sitemap có mặt & tương tác được
- [ ] Điểm danh 38 HS lưu DB, feed dashboard counters
- [ ] Sơ đồ lớp drag-drop persist, export được
- [ ] Sổ đầu bài → merge điểm danh
- [ ] Visual parity vs target screenshots
- [ ] `npm run check` green; preview deploy live

## 7. Out of scope (confirmed)

Real AI, Realtime, server PDF, multi-school production, billing, SMS/email thật (thông báo in-app only).

## 8. BA Lead review notes

- Scope lớn (~70 screens + backend) — chấp nhận được cho mockup-quality demo với backend thật; rủi ro chính là thời gian build → chia module theo P0/P1/P2, P0 = parity bắt buộc.
- Role switcher "(demo)" của target → thay bằng auth thật; giữ switcher cho superadmin demo accounts (mỗi role 1 account seed).
- Numbering sections của target bị lộn (XIII giữa IX và X, XII sau X) — giữ nguyên thứ tự hiển thị của target để parity, vì đó là đặc trưng hệ thống phân hệ.
