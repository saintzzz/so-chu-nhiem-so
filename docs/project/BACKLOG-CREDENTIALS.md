# BACKLOG - Items can credential / dau vao ngoai

PO ruling: chi nhung item **thuc su** can credential/doi tac/phan cung/lega onboarding
moi nam o day. Moi item ghi ro dieu kien unblock.

## 1. VNeID dang nhap (production)
- **Can**: dang ky dinh danh to chuc theo ND 69/2024, hoac hop dong vendor
  C06/LGSP (VNPT/FPT...). Khong co OAuth public cho app doc lap.
- **Da chuan bi**: schema `vneid_subject_id` tren `students` + `profiles`
  (unique partial index, migration 20261255) + SSO hook contract
  (`docs/project/CR-074-vneid-prep.md`); chi cho vendor spec de implement.
- **Khong lam fake**: khong gia lap OAuth VNeID trong app.

## 2. Connector CSDL hoc ba so Bo GD&DT (QD 3016)
- **Can**: credentials + API spec chinh thuc tu So/Bo (envelope XML, token,
  SHA256). Chi tiet goi y trong docs/research.
- **Phan khong can cred**: XML export hoc ba (CR-069) + framework
  `integration_connectors` + outbox (CR-072) van implement duoc.

## 3. Ky so hoc ba XML bang CA thuong mai
- **Can**: CA/vendor (VNPT-CA, FPT-CA, Viettel-CA...) + chung thu so to chuc.
- **Phan khong can cred**: system signing (HMAC/RSA key cua he thong) + chu ky
  dien tu nguoi dung qua OTP/PIN - implement duoc ngay (CR-069).

## 4. Diem danh camera / biometric
- **Can**: phan tu (camera/edge device), DPIA rieng (luu embedding, khong luu
  anh), dong y phu huynh, giai doan pilot duyet.
- **Da chuan bi**: DPIA + kien truc edge + schema + luong du lieu +
  checklist trien khai (`docs/research/CAMERA-ATTENDANCE-DESIGN.md`);
  chi cho khach hang pilot + vendor edge.

## 5. Cong thanh toan online (VNPAY/MoMo)
- **Can**: merchant account + ky hop dong -> API keys.
- **Phan khong can cred**: `fee_payments` da san sang nhan `provider_ref` +
  callback webhook skeleton - gan vao sau.

## 6. Zalo OA / SMS thong bao PH
- **Can**: OA approval + API keys. Hien PH channel = email only (repo law).

## 7. Bao hiem y te (BHYT) - cong BHXH
- **Can**: cong BHXH VN tra cuu the BHYT theo CCCD. Module `y_te_bhyt` noi bo
  (ho so suc khoe, so the, han BHYT nhap tay) KHONG can cred -> dung roadmap.

## 8. CRM / SIS ben thu 3
- **Can**: vendor spec cu the. Framework connector (CR-072) mo san.

## 9. Google Workspace Marketplace + Classroom add-on (research: GOOGLE-MS-INTEGRATION)
- **Can**: Google Cloud project + OAuth consent + Marketplace review + Google SSO;
  truong dung can Workspace for Education Teaching&Learning/Plus.
- **Gia tri**: embed VieSchool vao Classroom (iframe attachment), domain install,
  kenh phan phoi 40M+ users. Mot kenh ban doc quyen Google.

## 10. Microsoft AppSource + Teams LTI app
- **Can**: Entra app registration + admin consent + partner onboarding/review.
- **Gia tri**: embed vao Teams; phan phoi qua AppSource.
- **Khong can cred**: OneRoster PROVIDER endpoint (CR-072) - truong M365 nhap
  client cred vao SDS la Teams/Entra/OneNote tu provision tu data minh.

## Roadmap khong can credential - dang chay SDLC
- CR-068 xet_tot_nghiep
- CR-069 hoc ba XML QD 3016 + system signing
- CR-070 dieu dong gan period_id TKB
- CR-071 dashboard quick-actions theo role
- CR-072 integration framework (connectors + outbox skeleton)
- y_te_bhyt + van_thu modules (sellable)
- VNeID prep: vneid_subject_id + hook design doc
- Camera: DPIA/design doc
