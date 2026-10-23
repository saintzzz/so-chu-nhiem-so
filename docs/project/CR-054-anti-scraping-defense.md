# CR-054 - Anti-scraping / anti-AI-crawler defense plan (status: PROPOSAL - lop 1 robots.txt + X-Robots-Tag da deploy; phan con lai cho keys/WAF)

Yeu cau cua PO: viet phuong an truoc, implement sau. So Chu Nhiem So la
app **full-authenticated** (khong co public content surface ngoai
landing/login) nen threat model khac English Arena - muc tieu chinh la
du lieu hoc sinh (nhay cam, PDPK) va cong cu AI, khong phai content bank.

## Tai san can bao ve

1. **Du lieu hoc sinh** (students, grades, conduct, hoc ba) - nhay cam
   nhat, da bao ve boi RLS + RBAC. Scraper can session hop le.
2. **TVC tools output + question bank tvc_questions** - IP cua giao vien.
3. **AI endpoints** (`/api/ai/*`, tool-runner) - chi phi tinh theo call;
   bot cao hoac abuse lam dung quota.
4. **Export endpoints** (hoc-ba DOCX/PDF, register exports) - bulk
   extraction channel hop phap, can cap rieng.

## Phong thu DA CO (khong lam lai)

- RLS tren moi bang + `requireRoles`/`checkActionRole` tren route/action.
- `ai_quota` (migration 20261123) - cap cuoc goi AI per user/school.
- `audit_logs` + `src/lib/audit.ts` - durable audit trail.
- Proxy.ts guard + session theo Supabase Auth.
- Rate-limit mac dinh cua Vercel/Supabase infra (khong custom).

## Moi de doa con lai

| Threat | Mo ta | Muc rui ro |
|---|---|---|
| T1 Stolen/shared session | JWT ro ri -> bulk export du lieu HS | CAO - du lieu nhay cam |
| T2 Credential stuffing | Brute `demo1234`-style login | Trung - Supabase Auth co cap mac dinh |
| T3 Authed bulk scrape | User hop le nhung script cao toan truong | Trung - khong co per-uid row cap tren read |
| T4 AI abuse | Script goi tool-runner lien tuc dot quota | Trung - da co ai_quota nhung chua co velocity cap |
| T5 AI crawler landing | GPTBot cao trang public | Thap - landing khong co data |

## Phuong an de xuat (theo lop, re -> dat)

### Lop 1 - Re, lam ngay duoc

1. `public/robots.txt` chan AI crawlers (GPTBot, ClaudeBot, CCBot,
   Bytespider, Google-Extended) + `X-Robots-Tag: noindex, nofollow` cho
   route authed qua headers trong `proxy.ts` (1 dong middleware).
2. **Export velocity cap**: `export_audit` dem so file export
   per-uid per-hour; >N (vd 20/h) -> tam khoa + log audit_logs
   type=`export_throttled`. Export la kenh ro ri lon nhat cua app
   authed - mot uid hop le co the tai ca truong qua DOCX.
3. Vercel WAF: Bot Protection managed ruleset + rate limit
   `/api/*` (300 req/phut/IP) - dashboard toggle, khong doi code.
4. Session anomaly signal: log `auth.sessions` user_agent/ip_hash vao
   audit khi IP doi giua phien (Supabase hook hoac check o getProfile
   cache) - phat hien T1 som.

### Lop 2 - Can thiet ke nho

5. Per-uid read caps tren cac bang nhay cam: RPC wrap hoac DB-side
   `check_rate_limit` nhu pattern `practice.check_rate_limit` cua
   English Arena - port sang `scn.check_rate_limit`, goi trong
   service-role path cua export + hoc-ba bundle.
6. AI velocity cap bo sung: `ai_quota` la daily; them sliding-window
   per-minute (vd 10 req/phut/uid) chan burst script.
7. Login anomaly: Supabase Auth `confirm email` + rate limit dang
   nhap; canh bao admin khi 1 uid co >2 IP/dat nuoc khac nhau trong
   ngay (nightly job nho tren audit_logs).

### Lop 3 - Dai han

8. Watermark export: footer DOCX/PDF ghi (uid, timestamp, request-id)
   - neu file ro ri ra ngoai, truy nguon duoc. Hien export da co
     attribution - chi can them request-id hidden.
9. School-level kill switch: feature flag `read_only_mode` per-school
   khi phat hien scrape lon - khoa export, van cho doc.
10. Honeypot student rows (tien trien can than - de test nguoc).

## De xuat trien khai (khi PO duyet)

- Buoc 1 (1 PR nho): robots.txt + noindex header proxy.ts + Vercel WAF
  toggle + export_audit cap. KHONG can account ngoai.
- Buoc 2: port check_rate_limit sang schema public cho scn (migration
  nho) + per-uid export cap enforcement.
- Buoc 3: anomaly jobs khi co truong that onboard.

## Impact assessment

- Client: khong doi UI (robots + headers la tang mang).
- Export: cap 20 file/h/uid - giao vien that hiem khi vuot; neu vuot
  that, thong bao + lien he BGH mo khoa.
- DB: export_audit la 1 bang nho + trigger dem; khong cham nghiep vu.
- Rui ro: Vercel WAF chan nham bot hop phap (uptime probe) - whitelist
  `/api/health` + health.svg.

## Out of scope

- Chan AI crawler tren trang login/landing bang JavaScript challenge -
  khong can, noindex du cho SEO hop phap.
- MFA bat buoc - de xuat rieng, khong thuoc pham vi nay.
