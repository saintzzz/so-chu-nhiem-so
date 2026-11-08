# Chien luoc he thong theo 6 dau muc - tai lieu tong hop

Cap nhat 2026-11-08. Gop toan bo phan tich + trang thai + cong viec da lam
cho 6 dau muc: can cu phap ly, dieu le quan tri truong, gia tri gia tang,
trai nghiem nguoi dung, ket noi CSDL nganh/du lieu cu, bao mat du lieu.

Nguon: `AUDIT-6DM-2026-11-08.md` (audit), `CR-116` (work items W1-W4),
`CSDL-NGANH-CONNECTOR.md` (spec), `GIA-TRI-GIA-TANG.md` (dinh vi).

---

## PHAN 1 - Phan mem xay dung tren quy dinh hien hanh nao

He thong duoc thiet ke va audit theo bo van ban sau (trang thai: DA AP
DUNG trong code, khong chi tren giay):

| Van ban | Pham vi ap dung trong he thong |
|---|---|
| **TT 15/2026/TT-BGDDT** | Dieu le truong THCS/THPT/lien cap moi nhat (hieu luc 10/5/2026, thay TT 32/2020 + TT 28/2020). Toan bo quy trinh dieu hanh: phan cong vai tro (BGH, PHT, GVCN, GVBM, to truong, ban CMHS), kiem tra duyet (giao an, so chu nhiem, hoat dong), moi quan he truong-gia dinh. Da cap nhat tham chieu UI qua CR-018. |
| **TT 22/2021/TT-BGDDT** | Khung danh gia hoc luc: cot diem DDGtx/DDGgk/DDGck, DTBm HK1/HK2/ca nam tach biet, mon nhan xet Dat/Chua dat, tieu chi xep loai va len lop - code tai `src/lib/tt22.ts`. |
| **Quyet dinh 3016/QD-BGDDT** | Hoc ba dien tu: export hoc ba XML chuan SCN-QD3016-v1 kem ky xac thuc he thong (`src/lib/hbxml.ts`, man hinh `/records/exports`). |
| **TT 26/2019 + TT 42/2021/TT-BGDDT** | CSDL nganh GD&DT: ma dinh danh (toi da 20 ky tu, bat bien) cho HS/GV/CBQL/NV - truong du lieu `students.national_id` + `profiles.national_id` (CR-116). |
| **Luat 91/2025 (PDPL) + ND 13/2023** | Du lieu ca nhan: trang legal public, DPIA v2, so dong thuan `consent_records`, so yeu cau chu the `data_requests`, runbook breach 72h, retention policy. |
| **ND 356/2025/ND-CP** | Chuyen du lieu ra nuoc ngoai: ho so danh gia tac dong chuyen du lieu (khung + data map 7 processor da dien). |
| **ND 130/2018/ND-CP** | Chu ky so: he thong dung nhan "ky xac thuc he thong" (HMAC noi bo) thay "ky so" - tranh hieu nham chu ky so CA hop phap. |
| **TT 10/2025/TT-BNV** | Chinh quyen dia phuong 2 cap: khong co Phong GD&DT - UBND xa nghiem thu, So GD&DT quan ly chuyen mon (CR-017). |
| **ND 53/2022/ND-CP** | Luu tru du lieu - phan tich tai Phan 6. |

Theo doi: du thao sua TT 22/2021 dang duoc BGD lay y kien - khi co thong tu
moi se mo CR thay cong thuc tinh DTBm/xep loai.

## PHAN 2 - Quan ly nha truong theo dieu le/thong tu nao

**Can cu quan tri: TT 15/2026/TT-BGDDT** - dieu le ap dung chung cho truong
tieu hoc, THCS, THPT va **truong pho thong co nhieu cap hoc** (khong tach
van ban rieng tung cap nhu the he TT 28/32 cu).

Ho tro cap truong trong he thong:

- Type `school.level`: `th | thcs | thpt | lien_cap` - 4 loai ke ca truong
  lien cap (mot truong nhieu cap hoc, dung chung nhan su/TKB/co so).
- Luong danh gia phan biet theo cap: tieu hoc chu yeu nhan xet Dat/Chua
  dat, THCS/THPT cham diem so theo TT22 - ca hai duong deu chay trong demo
  (2 truong TH + 1 truong THCS, ~1275 HS).
- THPT: xet tot nghiep (`/school/graduation`), tuyen sinh khoi 10
  (`/apply`), danh gia diem - day du.
- Cau truc to chuc theo Dieu le: BGH - PHT (co the theo campus), to chuyen
  mon (to truong), GVCN, GVBM, ban can su lop, ban CMHS, nhan vien y te,
  ke toan, thu vien, van thu.
- So GD&DT + UBND cap xa: cap quan ly ben tren truong theo mo hinh chinh
  quyen 2 cap (TT 10/2025).

Con can bo sung khi pilot mo rong: 1 tenant THPT va 1 tenant lien cap that
de test luong thuc te (da ghi trong backlog W3).

## PHAN 3 - Gia tri gia tang

Chi tiet day du tai `docs/positioning/GIA-TRI-GIA-TANG.md`. Tom tat:

**Tai sao can**: GVCN mat 3-5 gio/tuan vao so sao chep thu cong; du lieu
rai rac Excel/Zalo; TT 15/2026 + Luat 91/2025 bat buoc du lieu tre em duoc
quan ly co kiem soat; CSDL nganh yeu cau ma dinh danh thong nhat.

**Truong can gi**: chi can trinh duyet + file Excel danh sach (hoac file
xuat SMAS/vnEdu); khong server, khong IT, khoi tao 1 buoi cho ~500 HS;
go-live chi can GVCN diem danh tuan 1.

**Khac biet**: SMAS/vnEdu manh "bao cao len Bo" nhung yeu cong viec hang
ngay cua GV; he nay bat dau tu GVCN (diem danh 1 cham -> bao cao ngay tu
dong -> so chu nhiem tu sinh), AI da tang co fallback khong can API key,
19 module ban le nhu phu kien, ma dinh danh nganh la truong du lieu chinh.

## PHAN 4 - Trai nghiem nguoi dung: chuc nang hay dung hien the

Da trien khai (CR-116-W2, commit kem):

- Component `QuickActions` (`src/components/quick-actions.tsx`): strip
  the 4-6 chuc nang hay dung nhat, icon + mo ta ngan, dat ngay duoi
  PageHeader cua man hinh dau tien sau dang nhap.
- Cau hinh theo vai tro (`src/lib/quick-actions.ts`):

| Vai tro | Man hinh dau | The hay dung |
|---|---|---|
| GVCN | `/dashboard` | Diem danh, Bao cao ngay BGH, So diem, So dau bai, Nhan xet ren luyen, Tin nhan PH |
| GVBM | `/academics/grades` | Lich day, Nhap diem, So dau bai, Bai tap truc tuyen, Giao an, Trao doi GVCN |
| To truong | `/team/home` | Duyet giao an, Danh gia nang luc, Sinh hoat CM, GV trong to |
| BGH/PHT | `/school/dashboard` | Bao cao ngay cac lop, Ky duyet so, Phe duyet, TKB truong, Radar, Nhan su |
| Ke toan | `/school/staff` | Hoa don & thu tien, Dot thu, Danh muc, Bao cao thu chi, Tich hop TT |
| So/UBND/Admin | `/dept/dashboard` | Truong hoc, Du lieu & bao cao, Xa/phuong, Nguoi dung, Module |

- PH/HS: portal da la man hinh tong hop mot trang (diem, chuyen can, tin
  nhan, hoc ba, bai thi) - ban chat da la "chuc nang hay dung" dung san.
- Static theo vai tro (khong tracking ca nhan) - neu sau nay can ca nhan
  hoa theo tan suat thi mo CR rieng.

## PHAN 5 - Ket noi CSDL Bo + chuyen du lieu tu he thong cu

Spec day du tai `docs/research/CSDL-NGANH-CONNECTOR.md`. Ban chat:

**CSDL nganh = VEMIS** (`csdl.moet.gov.vn`, TT 26/2019 + TT 42/2021).
Co che hien nay la nhap/xuat **file chuan V.EMIS** qua tai khoan truong do
So cap - khong phai REST API cong khai.

Da lam (CR-116-W3):

- `profiles.national_id` (GV/CBQL/NV) + `students.national_id` (HS) - luu
  ma dinh danh nganh toi da 20 ky tu, nhap/sua tai `/school/users` va ho
  so HS.
- **Mapper nhap tu he thong cu** trong man hinh "Nhap danh sach HS": tu
  nhan dien file xuat SMAS ("Ma hoc sinh" = ma dinh danh) va vnEdu mau 1
  ("Ma VEMIS", "Ho dem"+"Ten" gop, "Cho o hien nay"/"Ho khau thuong tru"
  -> dia chi). Truong chuyen tu SMAS/vnEdu nap file xuat vao la xong.
- Hoc ba XML QD3016 + Excel import toan dien (HS, GV, diem, chuyen can,
  khoi tao truong) - san co.
- Integration framework (connectors + outbox + retry worker) - san sang
  cam connector `csdl_nganh` khi Bo mo API.

Con lai: `schools.national_id` (ma dinh danh co so GD), mau file V.EMIS
chinh thuc tu truong pilot de hoan thien export, do endpoint API tren
csdl.moet.gov.vn khi co credential truong.

## PHAN 6 - Bao mat du lieu: provider VN + consent theo tuoi

### 6.1 Khung phap ly thuc te

- **ND 13/2023 + Luat 91/2025**: du lieu HS la du lieu tre em = nhay cam -
  can dong thuan PHHS, DPIA, quyen chu the, breach 72h. DA CO trong he
  thong (CR-115).
- **Consent theo tuoi**: <14 tuoi bat buoc nguoi giam ho dong thuan;
  >=14 HS co the tu dong thuan (van nen ghi kem PH). He thong se suy dien
  nhom tuoi tu `students.dob` (CR-116-W4 - backlog ky thuat).
- **ND 53/2022 Dieu 26**: DN **trong nuoc** phai luu tru tai VN: thong tin
  ca nhan nguoi dung dich vu, du lieu do nguoi dung tao, moi quan he.
  DN **nuoc ngoai** chi bi ap khi: dich vu bi dung vi pham ANM + A05 gui
  van ban + khong chap hanh (khi do co 12 thang de tuan thu).
- **Du lieu tre em** thuoc nhom "du lieu quan trong" theo ND 53 - khi
  trien khai quy mo So/toan quoc se can danh gia ATTT voi A05 (Cuc An
  ninh mang, Bo Cong an).

### 6.2 Cau hoi dat ra: co phai thay toan bo ha tang khong? - KHONG

Ket luan nghien cuu: **co the giu nguyen Supabase + Vercel hien tai** ma
van dat compliance, vi luat khong cam tuyet doi chuyen du lieu ra nuoc
ngoai - no yeu cau ho so danh gia + bao ve thich dang. Ba lop phuong an:

**Phuong an A - Giu nguyen ha tang, hoan thien phap ly (dung ngay):**

1. Ho so chuyen du lieu ND 356 da san khung - chi can dien region Supabase
   that + DPA cac provider (da tai 6/7, OpenRouter dang cho tra loi).
2. Region: Supabase cho phep chon region - neu project dang o region gan
   VN nhat (Singapore) thi ghi nhan; khi can region chau A khac thi migrate
   project (Supabase ho tro).
3. AI providers: he thong DA pseudonymize + redact PII truoc khi gui AI
   (`src/lib/ai-privacy.ts`) - du lieu nhan dien tre em khong ra nuoc
   ngoai qua kenh AI.
4. Gia: $0 - chi hoan thien giay to. Compliance: du theo ND 13/356 neu
   ho so day du.

**Phuong an B - Giu stack, doi cho dat (khi truong cong yeu cau du lieu o
VN):**

- **Supabase la open-source**: self-host Supabase/PostgreSQL tren cloud
  co phap nhan VN - Viettel IDC, VNPT Cloud, CMC Cloud, FPT Cloud deu co
  san Postgres/VPS. Ung dung khong doi code (cung Postgres + cung API),
  chi doi connection string + storage endpoint.
- **Vercel -> VPS VN**: Next.js chay duoc tren VPS bat ky (Node runtime);
  hoac giu Vercel cho tinh + CDN con compute nhay cam chuyen ve VN
  (Vercel khong co region VN - day la diem can cau truc hybrid).
- **Resend -> SMTP VN**: dung SMTP cua VNPT/Viettel hosting hoac dich vu
  email co may chu VN; code email da truu tuong (`src/lib/email.ts`).
- **AI providers**: giu nguyen - chi du lieu da pseudonymize di ra.
- Chi phi uoc tinh: VPS/Postgres VN ~1-3 trieu/thang cho truong don; so
  voi viec viet lai la re hon nhieu. Compliance: manh nhat - toan bo du
  lieu nhan dien nam trong VN.

**Phuong an C - Tang ma hoa tang ung dung (bo sung, ket hop A hoac B):**

- Ma hoa truong nhay cam (suc khoe, tu van, hanh vi, so tien) o tang ung
  dung truoc khi ghi DB: AES-256-GCM voi khoa dat trong env/KMS - du DB o
  nuoc ngoai cung chi la ciphertext.
- Khong can thay ha tang; anh huong: khong tim kiem full-text tren truong
  ma hoa (thiet ke truong can chon loc) + phai quan ly khoa.
- Ap dung tot nhat cho: `counseling`, `health`, `safety`, ghi chu ren
  luyen - cac bang du lieu nhay cam cao nhat.

### 6.3 Khuyen nghi lo trinh

| Giai doan | Phuong an | Ly do |
|---|---|---|
| Hien tai (pilot, truong tu/thuong mai) | A | Ho so ND356 + DPA + pseudonymize AI la du compliance hien hanh |
| Khi ban cho truong cong co yeu cau du lieu VN | B | Self-host Supabase tren cloud VN - code khong doi, dap ung ND53 D26 cho DN trong nuoc |
| Khi mo rong quy mo So/toan quoc | B + C + ho so A05 | Du lieu quan trong -> luu VN + ma hoa truong nhay cam + danh gia ATTT |

Khong can viet lai ung dung o bat ky phuong an nao - kien truc (Supabase
open-source + Next.js portable + provider AI truu tuong) da thiet ke de
doi cho dat khi can.

### 6.4 Trang thai hien tai trong he thong

DA CO: so dong thuan + so yeu cau chu the (`/school/privacy`), DPIA v2,
runbook breach, retention, legal pages public, redact PII truoc AI, RLS
day du, VNeID prep (`vneid_subject_id`).

BACKLOG (CR-116-W4): suy dien nhom tuoi tu `dob` - canh bao khi ghi
consent sai doi tuong + bo loc "HS <14 chua co consent PH".

---

## Bang tong ket

| Dau muc | Trang thai sau CR-116 | Con lai |
|---|---|---|
| 1. Quy dinh hien hanh | DAT - 9 van ban trong code | Theo doi du thao TT22 moi |
| 2. Dieu le quan tri | DAT - TT15/2026, 4 loai truong | Tenant THPT/lien cap khi pilot |
| 3. Gia tri gia tang | DAT - doc dinh vi san | - |
| 4. UX the hay dung | DAT - QuickActions 6 vai tro | Ca nhan hoa (neu can) |
| 5. CSDL Bo/VNEDU | NEN TANG - mapper + ma dinh danh + spec | schools.national_id, mau V.EMIS that, endpoint khi Bo mo |
| 6. Bao mat VN | NEN TANG + lo trinh A/B/C ro rang | W4 consent tuoi; region that; self-host khi truong cong yeu cau |
