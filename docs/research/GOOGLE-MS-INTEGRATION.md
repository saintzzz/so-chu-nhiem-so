# GOOGLE / MICROSOFT INTEGRATION - nghien cuu sau (PO decision)

Ngay nghien cuu: 2026-10-28. Muc dich: danh gia sau cac kha nang Google/MS tools
cho kien truc modular + chien luoc ban module. Ket luan: Google/MS khong phai
nen tang de dung LMS — nhung la **kenh phan phoi + chuan interop + capability
connector** rat lon, chi can 1-2 chuan mo la bang duoc ca 2 he sinh thai.

## A. GOOGLE - 4 lop gia tri

### A1. Classroom add-ons (kenh lon nhat, duy nhat cua Google)
- Nhung noi dung/assignment cua VieSchool TRUC TIEP vao Google Classroom qua
  iframe `AddOnAttachment`: GV tao + cham bai ben thu 3 khong roi Classroom.
- Phan phoi qua **Google Workspace Marketplace**; admin ca truong/huyen cai 1 lan
  (domain-wide install). Badge "Works with Classroom".
- Yeu cau: Google SSO bat buoc; Cloud project; Marketplace review; can Workspace
  for Education Teaching & Learning hoac Plus.
- API nen: `AddOnAttachment` + `CourseWork` API (tao/sua assignment, sync roster,
  post grade ve Classroom gradebook - tuong duong LTI Advantage).
- Dong thu hut: 40M+ users Classroom; truong VN xai Workspace for Education
  Fundamentals (mien phi) rat nhieu.

### A2. CourseWork API / Share button (cap tich hop nhe hon)
- Share button: nhan share noi dung vao Classroom stream (re nhat, khong access
  duoc stream sau khi tao).
- CourseWork API: toan quyen stream items, roster, diem — cung muc LMS-lite sync.

### A3. SIS integrations + Admin SDK (roster chieu nguoc)
- Chinh sach "SIS integrations" cua Google: ho tro sync lon tu SIS -> Classroom.
- Admin SDK: provision user/OU/group vao domain Workspace cua truong —
  onboarding khong nhap tay.

### A4. Capability connectors
- Meet API: tao meeting space theo tiet TKB.
- Google Calendar API: dong bo lich GV/HS tu TKB.
- Drive API: export hoc ba/hoc lieu, backup.
- Cloud: BigQuery (analytics cap So), Cloud Run/Cloud SQL/PubSub (infra).
- Partner Advantage - Education Build track: badge + co-marketing voi Google.

## B. MICROSOFT - 3 lop gia tri

### B1. School Data Sync (SDS) + OneRoster PROVIDER — chien luoc lon nhat
- SDS (mien phi trong M365 Edu) doc du lieu SIS cua truong qua **OneRoster 1.1
  API hoac CSV** roi tu dong provision: Teams class teams, OneNote Class
  Notebook, Exchange/SharePoint groups, Entra ID users, Intune groups, admin
  units.
- **Neu VieSchool expose OneRoster provider endpoint** (roster/users/classes/
  enrollments), truong chay M365 chi can nhap 1 client_id/secret: TOAN BO Teams +
  Entra + OneNote duoc provision TU DU LIEU CUA MINH. VieSchool tro thanh system
  of record; M365 la downstream consumer — dung vi tri ban hang.
- SDS classic -> new SDS transition cuoi 2024; OneRoster REST + OAuth2 client
  credentials la chuan vao.

### B2. Teams Store / LTI apps / AppSource
- Teams ho tro LTI apps qua store: embed VieSchool vao Teams; assignments + grade
  sync; SSO qua Entra ID.
- AppSource = marketplace phan phoi (can partner onboarding + review).

### B3. Capability connectors
- Graph API: users/groups/calendar (TKB -> Outlook calendar), files (OneDrive/
  SharePoint export), Teams meeting creation.
- Intune: MDM cho thiet bi hoc sinh (kiosk app cho diem danh?) - tuong lai.
- Azure: Container Apps + Azure Postgres + Service Bus + Key Vault + AppSource
  billing.

## C. CHUAN MO - viet 1 lan, chay moi he sinh thai
Day la insight quan trong nhat: cac chuan sau cho phep ban san pham cho ca truong
dung Google, MS, Moodle, Canvas, Schoology... ma khong viet tich hop rieng:

| Chuan | Vai tro | Chi tiet |
|---|---|---|
| **OneRoster 1.1** | SIS <-> LMS/SIS roster sync | SDS (MS) + nhieu SIS tieu nhan; provider API: users/classes/enrollments |
| **LTI 1.3 Advantage** | Embed tool vao bat ky LMS | Deep Linking + Names&Roles + Assignment&Grade Services; Teams + Canvas + Moodle deu ho tro |
| **Common Cartridge** | Dong goi noi dung/de thi | Export ngan hang cau hoi + hoc lieu dung o moi LMS |
| **OIDC/OAuth2** | SSO | Google Sign-In, Entra ID, va sau nay VNeID (cung pattern hook) |
| **Ed-Fi** (backlog) | Data exchange cap tinh/so | My + mot so nuoc; tham khao cho CSDL Bo |

## D. MICROSERVICE - MODULAR DE BAN HANG: phan tich that

### D1. "Ban module" la bai toan PACKAGING, khong phai DEPLOYMENT
- `school_features` + module registry + nav/route/RPC gates: khach mua gi thay do —
  day CHINH LA co che ban kieu Porsche, da hoat dong qua 7 CR.
- Microservice infra khong tao them kha nang ban nao — no la quyet dinh van hanh.
- Viec tung module (thu_vien, bien_dong_hs, lms_lite, khoan_thu...) da la bounded
  context chuan: bang rieng (lib_*/sm_*/lms_*/fee_*), WRITE CHI QUA RPC
  security-definer (= service API contract), module flag rieng. Day la strangle-
  ready design — tach ra service that bat cu khi nao can ma khong viet lai logic.

### D2. Neu van muon kien truc microservice — lo trinh dung
Layer 1 - CORE PLATFORM (bat buoc chung): auth/SSO, schools, profiles, RBAC,
  entitlements (school_features), notifications, audit. KHONG duoc tach.
Layer 2 - DOMAIN SERVICES (tach khi can): sis (students/classes/movements),
  academics (grades/records/hocba), lms (lms_lite + ngan hang), finance
  (khoan_thu), library, comms, admissions, integrations.
Layer 3 - EVENT BACKBONE: Postgres outbox (CR-072) -> worker; cac module da viet
  qua RPC nen chuyen sang event handler de dang (vd bien_dong -> attendance
  propagation hien dang la inline query).
Deployment: hien tai monolith; khi tach -> Supabase Edge Functions / Cloud Run /
Azure Container Apps TUNG SERVICE, giu nguyen hop dong RPC.
Triggers de tach THAT: >100 truong active, module nao do can SLA/scale rieng,
yeu cau data-residency, hoac team doc lap tung domain.

### D3. "Ban microservice" dung nghia thuong mai = API PRODUCT
- Mo public REST API per module (API key per school, quota, webhooks tu outbox):
  ban cho vendor/SO khac — day la doanh thu microservice that su.
- LTI tool provider: VieSchool nhung vao Moodle/Canvas/Teams = ban vao ca truong
  khong dung UI cua minh.

## E. QUYET DINH PO + ung vao roadmap

Ngay (khong can credential):
1. CR-072 mo rong: connector framework + outbox + **OneRoster provider endpoint**
   (roster/users/classes/enrollments, OAuth2 client creds) + LTI 1.3 provider
   metadata design + capability connectors da liet ke (Meet/Calendar/Drive/Graph).
2. Common Cartridge export cho ngan hang cau hoi (re, gia tri lon cho LMS khac).

Can onboarding (vao BACKLOG-CREDENTIALS):
3. Google: Workspace Marketplace app + Classroom add-on review + Google Cloud
   project + Google SSO config.
4. MS: AppSource/Teams app + Entra app registration + admin consent flow.
5. Partner tracks: Google Education Build; Microsoft partner co-sell.

Khong lam:
- Dung lai tren Google Sites/Apps Script/Power Platform: khong so huu UX/data,
  khong ban module doc lap duoc, chet theo platform.
- Migrate infra sang GCP/Azure bay gio: khong them sellable feature, ton thang
  cong — chi can thiet khi trigger o D2 xay ra.
