# IX. Sổ chủ nhiệm (`/register/*`)

**Vai trò**: GVCN (lớp mình), BGH (toàn trường).
**Routes**: `/register/roster` `/seating` `/seating-history` `/year-events` `/suggestions` `/plans` `/kpi` `/signoff` `/lock-records` `/export` `/audit`

## Patterns

- **Roster** (`roster`): danh sách HS + Tổ — bảng, kéo thả xếp tổ.
- **Sơ đồ lớp** (`seating`): grid lưới ghế kéo-thả; `seating-history` timeline phiên bản theo tháng.
- **Ký duyệt sổ CN** (`signoff`): bảng đợt ký theo `(lớp, kỳ)`; nút `Ký duyệt` per-row → status `signed`; `Tạo đợt ký` tạo cho lớp chưa có.
- **Duyệt & khóa sổ học bạ** (`lock-records`): tương tự — `Tạo đợt duyệt` + `Duyệt & khóa`. Sau khi `locked`, sổ read-only.
- **Xuất sổ** (`export`): chọn loại sổ + kỳ → xlsx/pdf.
- **Audit** (`audit`): bảng log read-only — actor, action, timestamp.
- **KPI** (`kpi`): bảng đăng ký chỉ tiêu theo tuần/tháng + tiến độ %.
- **Plans** (`plans`): kế hoạch tháng + sơ kết tuần — textarea lớn, autosave hint.

## Nguyên tắc
Mọi đợt ký/khóa đều 2 bước có xác nhận. Sau khi khóa, UI khóa không cho sửa (RLS `locked` check).
