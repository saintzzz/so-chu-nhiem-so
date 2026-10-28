# DEPLOYMENT TOPOLOGIES - 3 che do ban hang (PO architecture note)

Tinh huong thuc te se xay ra (user xac nhan 2026-10-28):
1. Khach doi runtime rieng: stack khac, scale khac, data-residency (on-prem/region)
2. Khach mua service doc lap hoan toan, khong dung phan con lai
3. (da cover) Khach mua module tren SaaS chung -> school_features, mac dinh

Muc tieu: kiem soat 3 truong hop BANG CUNG MOT codebase + 1 build.

## Topology A - SaaS multi-tenant (mac dinh)
- Vercel + Supabase cloud, `school_features` entitlement per truong.
- Feature rieng cua khach = module flag bat chi 1 truong (blast radius = 0).

## Topology B - Dedicated/On-prem (case 1)
- Cung build, dong goi Dockerfile + Postgres.
- Deploy: container app + Postgres (hoac Supabase self-hosted stack) trong
  region/on-prem cua khach.
- Luu y ky thuat:
  - NEXT_PUBLIC_* inline luc build -> on-prem build image rieng hoac truyen
    build-arg per khach (document o duoi).
  - Auth = Supabase Auth; on-prem hoac chay Supabase self-hosted, hoac giu
    Supabase cloud region gan + app on-prem (hybrid - khuyen nghi giai doan dau).
  - Migration SQL thuan Postgres -> chay duoc tren moi Postgres tuong thich.
- Khong can microservice: day la deployment variant cua cung monolith.
- Trigger build: khi co khach that -> CR-07x "on-prem packaging" (Dockerfile da
  co san tu note nay; con lai la CI image pipeline + license check).

## Topology C - Standalone service (case 2)
- "Khach chi mua thu vien" = CORE PLATFORM + 1 module, khong co gi khac.
- Cung codebase, build standalone mode:
  - CORE bat buoc (auth, schools, profiles, entitlements) - luon ship.
  - Module doc lap bat 1 flag; con lai khong co route.
- Extraction seam da san: server actions cua moi module chi goi RPC security-
  definer rieng cua module do (lib_*/sm_*/lms_*/fee_*). Khi can tach thanh
  service vat ly: move tables + RPC sang Postgres rieng, action goi HTTP service
  thay supabase.rpc - hop dong khong doi.
- Neu khach muon SERVICE NHUNG VAO HE CUA HO: public REST API + API key +
  webhooks tu outbox -> pham vi CR-072 (khong viet module UI).

## Extraction contract (luat cho moi module moi - enforce tu gio)
1. Bang prefix rieng cua module (`<domain>_*`), khong share bang voi module khac
   tru core (students/classes/profiles/schools/notifications).
2. Moi write qua RPC security-definer; direct table write revoke.
3. Module gate `*_module_enabled` trong RPC + read policies.
4. Server actions chi goi RPC cua module minh - day la seam de tach.
5. Cross-module fact doc qua core (students.class_id...) hoac qua outbox event
   (CR-072) - khong join sau vao bang module khac.
6. Static contract test rieng `tests/crXXX.test.mjs`.

Rule nay da dung cho lib_*/sm_*/lms_*/fee_*/tuyen_sinh - giu cho CR-068+.

## License/packaging model (chuan bi cho commercial)
- `school_features` hien tai = entitlement binary.
- Can mo rong khi co khach that: license = {school, modules[], seats,
  deployment_mode(saas|dedicated|standalone), expires_at}. Viet trong CR-072
  hoac CR-07x commercial packaging.
