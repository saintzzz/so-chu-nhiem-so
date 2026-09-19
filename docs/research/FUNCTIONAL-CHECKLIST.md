# Checklist nghiệp vụ - Sổ Chủ Nhiệm Số

Đối chiếu: đối thủ (vnEdu/VNPT, SMAS/Viettel, eNetViet) + quy định hiện hành
(TT 32/2020 Điều lệ trường, TT 22/2021 đánh giá HS, TT 28/2009 chế độ GV,
TT 12/2020 Sở/Phòng GD&ĐT). Cập nhật: 2026-09-19.

## A. Quy định đánh giá (TT 22/2021) - COMPLIANCE

| # | Quy định | Căn cứ | App hiện tại | Verdict |
|---|---|---|---|---|
| A1 | HK xếp 4 mức: Tốt/Khá/Đạt/Chưa đạt | Điều 8 TT22 | `tot/kha/dat/chua_dat` - đã migrate DB + code | ✅ |
| A2 | HL xếp 4 mức: Tốt/Khá/Đạt/Chưa đạt | Điều 9 TT22 | `scoreBand()` trong tt22.ts | ✅ |
| A3 | ĐTBmhk = (ΣĐĐGtx + 2×gk + 3×ck)/(n_tx+5) | Điều 9 TT22 | `semesterAverage()` + editor nhập nhiều ĐĐGtx | ✅ |
| A4 | Môn nhận xét-only: Đạt/Chưa đạt, không cho điểm số | Điều 5 TT22 | `subjects.assessment_method=comment` + editor select Đ/CĐ | ✅ |
| A5 | Điểm lấy 1 chữ số thập phân sau làm tròn | Điều 5 TT22 | toàn bộ hiển thị toFixed(1) | ✅ |
| A6 | Thang điểm 10, ĐĐG gồm: tx + 1 gk + 1 ck/hk | Điều 5,9 TT22 | term gk1/ck1/gk2/ck2 OK | ✅ |

## B. Sổ chủ nhiệm & hồ sơ bắt buộc (Điều 27.3 TT32)

| # | Hồ sơ | App | Verdict |
|---|---|---|---|
| B1 | Sổ chủ nhiệm: KH năm, theo dõi tuần/tháng, ký duyệt HT | register/* + signoff | ✅ |
| B2 | Sổ đầu bài: GVCN xem lớp CN, GVBM ghi tiết mình | period-log (đã fix GVBM) | ✅ |
| B3 | Sổ điểm/sổ theo dõi đánh giá HS theo lớp | grades + analysis | ✅ |
| B4 | Học bạ: GVCN ghi, HT ký xác nhận, khóa cuối năm | lock-records | ✅ |
| B5 | Nhật ký thao tác (audit trail) | register/audit | ✅ |

## C. RBAC theo đối tượng (SMAS: quản trị/phòng-sở/cấp trường)

| # | Đối tượng | Phạm vi đúng | Verdict |
|---|---|---|---|
| C1 | GVCN | Toàn bộ nghiệp vụ lớp CN | ✅ |
| C2 | GVBM | Điểm môn mình, sổ đầu bài tiết mình, chat GVCN | ✅ (đã fix) |
| C3 | Tổ trưởng | Team CM + kiêm nhiệm GVBM | ✅ (đã thêm) |
| C4 | BGH | Duyệt/giám sát, KHÔNG thao tác nghiệp vụ lớp | ✅ |
| C5 | Sở/Phòng GD | dept/* - số liệu, không vào nghiệp vụ trường | ✅ |
| C6 | Phụ huynh | Chỉ con mình | ✅ |
| C7 | Học sinh | Chỉ bản thân | ✅ |
| C8 | Mọi route có guard + action check role | 60/60 pages + 14 actions | ✅ |

## D. Luồng nghiệp vụ đối thủ (vnEdu/SMAS/eNetViet)

| # | Nghiệp vụ | App | Verdict |
|---|---|---|---|
| D1 | Import HS từ Excel + template | records/upload | ✅ |
| D2 | Sổ liên lạc điện tử (thông báo → PH, phản hồi) | parents/* + portal | ✅ |
| D3 | Điểm danh: có mặt/vắng CP/vắng KP/đi muộn + báo PH | attendance/* | ✅ |
| D4 | Nhập điểm theo lớp×môn×kỳ | grades | ✅ |
| D5 | Khen thưởng/vi phạm: GVCN ghi nhận | conduct/records | ✅ |
| D6 | Phân công chủ nhiệm (BGH gán GVCN→lớp) | school/assignments + trigger guard_gvcn | ✅ |
| D7 | Phân công giảng dạy (BGH gán GVBM→môn/lớp) | school/assignments (môn phụ trách + lớp×môn) | ✅ |
| D8 | TKB theo lớp + theo GV | timetable | ✅ |
| D9 | Dashboard cảnh báo sớm (HS rủi ro) | school/radar + academics/support | ✅ |
| D10 | Báo cáo tổng hợp lớp cho GVCN | records/report (AI) | ✅ |
| D11 | Hoạt động GD: lập KH → duyệt → điểm danh | activities/* | ✅ |
| D12 | Sự cố an toàn: ghi nhận → báo BGH → theo dõi → lưu trữ | safety/* | ✅ |
| D13 | Tư vấn HS: tiếp nhận → đánh giá → chuyển tuyến | counseling/* | ✅ |
| D14 | Thi đua: chấm điểm → xếp hạng → khen thưởng | emulation/* | ✅ |
| D15 | Đánh giá năng lực GVCN: tự đánh giá → minh chứng → tổ trưởng duyệt | competency + team/review | ✅ |
| D16 | Ban đại diện CMHS (Điều 44 TT32) | parents/cmhs + portal PH | ✅ |
| D17 | Kỳ thi/quản lý thi (SMAS có) | academics/exams + portal HS/PH | ✅ |
| D18 | Mobile responsive | đã test 390px | ✅ |

## E. Kỹ thuật

| # | Hạng mục | Verdict |
|---|---|---|
| E1 | Mọi mutation ghi DB thật qua RLS | ✅ |
| E2 | API routes check role (401/403 JSON) | ✅ |
| E3 | Security headers | ✅ |
| E4 | Auth lookup dedupe per request | ✅ |
| E5 | Independent queries parallelized | ✅ |
| E6 | Không em-dash trong copy | ✅ |
| E7 | Secrets không commit | ✅ |

## Tổng kết gaps

- **Đã fix (compliance TT22):** A1 thang HK (DB constraint + data migrated), A2 nhãn HL, A3 công thức ĐTBmhk đầy đủ ĐĐGtx/gk/ck, A4 môn nhận xét Đ/CĐ, A5 làm tròn 1 chữ số
- **Đã fix (vòng 2):** D6/D7 trang `/school/assignments` (BGH: phân công GVCN→lớp, môn phụ trách GV, GV→lớp×môn qua TKB), D16 `/parents/cmhs` (Trưởng/Phó ban/Ủy viên, portal PH hiển thị), D17 `/academics/exams` (kỳ thi + buổi thi theo lớp/môn/phòng/giám thị, portal HS/PH chỉ thấy kỳ đã công bố)
- **RLS siết theo matrix:** write `cmhs_members`/`exams`/`exam_sessions` → gvcn+bgh; write `timetable_entries`/`teacher_subjects` → bgh; `classes.gvcn_id` → trigger chặn non-BGH. Verified: GVBM insert/update bị RLS chặn, GVCN đổi gvcn_id bị trigger chặn.
- **Không còn gap mở** trong checklist này.
