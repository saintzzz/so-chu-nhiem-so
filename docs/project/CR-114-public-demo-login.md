# CR-114 - Nut "Vao trai nghiem demo" tren trang login

## Van de

Outreach VieSchool hua "he sinh thai 3 san pham" nhung SCN canonical
(`sochunhiem.vieschool.com/login`) chi nhan credentials - lead khong the
tu xem thu. English Arena da co trial 24h (CR-006 scanning-marketing);
SCN la gap cuoi cua funnel. Ban `so-chu-nhiem-so.vercel.app` co demo la
Vite SPA khac han (prototype cu), khong phai app nay.

## Quyet dinh PO

Public-demo pattern: mot nut tren `/login` dang nhap thang vao tai khoan
demo dung chung tren truong seed `nd` (THCS Nguyen Du) - giong "Try demo"
cua nhieu SaaS. Khong provision per-lead (seed tenant day du la project
rieng, khong phai fix).

## Thay doi

- Auth user `demo.gvcn@nd.scn` / `demo1234`, profile `gvcn` full_name
  "Co Trai Nghiem", school/campus/department clone tu anhptl.
- Class 7A1 (39 HS, day du du lieu seed) gvcn_id -> demo profile.
  Filler teacher `huypq` mat lop view; QA trio (anhptl/minhtv/hainv)
  khong bi anh huong.
- `login-form.tsx`: refactor `signIn(email,pw)` dung chung; nut outline
  "Vao trai nghiem demo" + divider "hoac" + caption "Truong demo THCS
  Nguyen Du - du lieu mau san sang, khong can tai khoan".

## Rui ro da can nhac

- Credentials trong client bundle = ai cung login duoc va co the sua du
  lieu 7A1. Chap nhan: tenant `nd` la demo data, reseed duoc; blast
  radius gioi han trong mot lop filler.
- Demo concurrent viet de nhau (diem danh, thong bao) - data la mau,
  khong anh huong he thong that. Neu van dung: reseed dinh ky (CR rieng).

## Verify

- signIn demo.gvcn@nd.scn qua anon client: OK; profile role gvcn doc duoc;
  classes gvcn_id = [7A1]; students RLS: 39 rows visible.
- tsc + next build: green (148 routes).
- Browser prod sau deploy: nut -> dashboard "Xin chao, Co Trai Nghiem /
  Lop chu nhiem 7A1 - THCS Nguyen Du".

## External review round 1 (codex) - da fix

- P1: visitor co the goi auth.updateUser({password}) doi mat khau chung ->
  migration 20261262 them trigger `block_demo_credential_change` tren
  auth.users, chan ca doi email. Verify live: updateUser password/email deu
  bi BLOCK, creds goc van dang nhap duoc. `ChangePasswordButton` tu an voi
  session demo (hide dead UI; trigger la boundary cung).
- P2: copy loi demo "dang bao tri" gay hieu nham voi loi Turnstile/rate
  limit -> doi thanh copy trung lap "Khong vao duoc ban demo luc nay".
