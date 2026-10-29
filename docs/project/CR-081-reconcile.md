# CR-081: Reconcile local wave với remote CR-068..076

## Bối cảnh

Hai nhánh phát triển song song cùng đánh số CR-068..073/076 cho các chủ đề
khác nhau. Remote/master đã ship wave CR-068..076 qua nhiều vòng external
review (hb XML ký 2 cấp, y tế BHYT `yt_*`, integration framework
`int_*`, VNeID prep, văn thư). Nhánh local có wave CR-068..073 song song
(thanh toán, kênh PH, học bạ XML, y tế, bữa ăn/CSVC, TKB nâng cao).

## Quyết định merge

| Hạng mục | Quyết định | Lý do |
|---|---|---|
| Thanh toán VietQR/SePay/e-invoice | Giữ local -> CR-077 | Remote chưa có; `int_*` của remote là framework connector tổng quát, khác layer |
| Kênh PH (Zalo/SMS outbox) | Giữ local -> CR-078 | Remote chưa có; lưu ý convention email-only production - Zalo/SMS chỉ chạy khi có credentials |
| Học bạ XML + ký số | Remote thắng | `hbxml.ts` + `hb_exports` ký 2 cấp đã review; drop `hocba-xml.ts`/`signing.ts`/route `format=xml` local |
| Y tế/BHYT | Remote thắng | `/school/health` + `yt_*` đã review; drop `/health` local + `y_te` module key |
| Bữa ăn + equipment issues | Giữ local -> CR-079 | Remote chưa có |
| TKB copy/by-teacher/export | Giữ local -> CR-080 | Remote có `dieu_dong` (phân công thay) - khác feature, giữ cả hai |
| VNeID | Remote | `20261255_vneid_prep` superset; giữ select `vneid_subject_id` trong hocba.ts |

## Renumber

- Migrations local `20261248`-`20261252` -> `20261258`-`20261260`
  (payments=258/CR-077, comm=259/CR-078, bua_an=260/CR-079);
  `20261250/251` bị xóa (superseded).
- CR docs local -> CR-077..080; ACs -> AC-77.x/78.x/79.x/80.x.
- `20261261_cr081_reconcile_cleanup.sql` drop orphan tables:
  `student_health_profiles`, `health_checkups`, `health_incidents`,
  `school_signing_keys`, `hocba_xml_exports` + gỡ flag `y_te` khỏi
  `school_features`.

## Việc còn lại

- Apply các remote migration chưa chạy trên DB (`20261248_cr072_integration`,
  `20261255_vneid_prep`, `20261256_cr075_y_te_bhyt`, `20261257_cr076_van_thu`).
- Payments (CR-077) có thể tích hợp lên `int_connectors/int_outbox` sau -
  hiện `school_integrations` của CR-077 là config surface riêng, không xung đột.
