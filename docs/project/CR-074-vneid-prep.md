# CR-074: VNeID prep - `vneid_subject_id` + SSO vendor hook design

## Da lam (khong can credential)
- Migration `20261255_vneid_prep.sql`: `students.vneid_subject_id` +
  `profiles.vneid_subject_id` (text, null) + partial unique index
  (`where ... is not null`) - vendor `sub` la globally unique.
- Design hook duoi day = contract cho vendor phase.

## Tai sao cot rieng (khong dung `national_id`)
- `national_id` = so dinh danh ca nhan tren giay to (du lieu ho so, co the doi
  khi cap lai CCCD).
- `vneid_subject_id` = OIDC `sub` claim vendor tra ve sau xac thuc - stable
  auth key, khong leak ra UI, khong hien thi tren hoc ba.
- Mot nguoi co the co >=1 `sub` theo vendor/issuer; unique index chan link
  2 tai khoan vao cung 1 subject.

## SSO vendor hook - contract thiet ke

```
Browser        VieSchool                    VNeID vendor (OIDC)
   |  GET /api/auth/vneid/start                |
   |------------------------------------------->|  authorize?client_id+state+nonce+redirect_uri
   |<----------- redirect to vendor -----------|
   |              login + consent               |
   |-- GET /api/auth/vneid/callback?code+state->|
   |           server exchange code -> id_token |
   |           verify iss/aud/exp/nonce + sub   |
   |           lookup profiles.vneid_subject_id = sub
   |             -> found: create Supabase session
   |             -> not found + logged-in: link flow (set sub for current user)
   |             -> not found + anonymous: deny (khong JIT-provision)
```

### Quyet dinh khoa
- **Khong auto-provision**: `sub` chua biet -> bat user dang nhap thuong roi
  link (claim-on-first-use), hoac admin/service-role gan truoc. Tranh tao
  account khong kiem soat tu external IdP.
- **State + nonce**: cookie httpOnly, verify o callback - chong CSRF/replay.
- **Session**: tao qua Supabase admin (generate link / custom JWT) - quyet
  dinh ky thuat cu the cho vendor phase, khong chot o day.
- **Role mapping**: khong doi - `sub` chi resolve `profiles.id`, role van
  lay tu `profiles.role` + `concurrent_roles` (VNeID khong quyet quyen).
- **students.vneid_subject_id**: cho portal HS/PH (neu vendor cho xac thuc
  dan cu) + verify identity khi nap diem len CSDL Bo - cung contract tren,
  bang rieng.

### Diem cam trong code (khi implement)
- `proxy.ts` whitelist `/api/auth/vneid/*` (giong devin-callback).
- `login` page: nut "Dang nhap bang VNeID" -> `/api/auth/vneid/start`.
- Link flow: trang profile -> "Lien ket VNeID" (phai dang nhap san).

## Ngoai pham vi / backlog (BACKLOG-CREDENTIALS #1)
- Vendor onboarding: client_id/secret, certs, spec doc cu the, MOU voi
  Bo Thong tin & Truyen thong / RAC.
- Khong mock/gia lap OAuth VNeID trong app.
