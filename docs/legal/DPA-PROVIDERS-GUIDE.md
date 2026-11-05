# DPA-PROVIDERS-GUIDE - Tinh trang va hanh dong can lam

Ngay: 2026-11-05. Muc tieu: du dieu kien "hop dong bao ve du lieu voi ben nhan nuoc ngoai" theo ND 356/2025 truoc khi nop ho so chuyen du lieu.

Tin vui: phan lon DPA hien dai **tu dong co hieu luc khi accept Terms** - khong can ky tay. Viec can lam chu yeu la TAI XUONG ban da ky luu vao ho so + 1-2 cho can submit form.

## Bang tong hop

| Provider | Vai tro | Trang thai DPA | Hanh dong cua Linh |
|---|---|---|---|
| Supabase | DB + Auth (toan bo DL) | Tu dong - tich hop trong ToS v3 tu 01/08/2026 | (1) Vao Dashboard > Org > Documents > "View DPA" > tai/luu PDF |
| Vercel | Hosting | Tu dong - DPA kem Terms, cover Pro/Enterprise | (2) Tai PDF tai vercel.com/legal > Data Processing Addendum |
| Resend | Email PHHS/GV | Tu dong - pre-signed khi signup | (3) Dang nhap resend.com > Settings > Documents > tai "DPA" da ky |
| OpenAI | AI fallback | Tu dong trong business terms tu 01/01/2026 + co the "Execute" lay ban ky | (4) platform.openai.com > Settings > Organization: (a) neu la personal account - nang business/org; (b) mo openai.com/policies/data-processing-addendum > "Execute data processing agreement" > dien legal entity + Org ID > nhan ban ky qua email |
| Anthropic | AI fallback | Tu dong - tich hop Commercial ToS khi dung API | (5) Tai PDF anthropic.com/legal > "Data Processing Addendum" (assets.claude.com/...dpa.pdf) |
| Google Gemini | AI chinh | Tu dong - kem Google API ToS; **khuyen nghi**: neu muon DPA Cloud chuan, chuyen key sang Vertex AI (Google Cloud DPA tu dong) | (6) Tai Google Cloud Data Processing and Security Terms tai cloud.google.com/terms/data-processing-terms (ap dung khi dung Vertex) |
| OpenRouter | AI fallback | Chua ro - khong thay DPA cong khai | (7) Gui email privacy@openrouter.ai yeu cau DPA; neu khong co - danh dau "processor it rui ro vi prompt da pseudonymize" hoac bo provider khoi chain |

## Checklist hoan tat (di 1-7) - cap nhat 05/11/2026

- [x] 1. DPA Supabase da luu `docs/legal/dpa/supabase-dpa.html` (trang chuan - DPA tich hop ToS, khong can ky tay)
- [x] 2. DPA Vercel da luu `docs/legal/dpa/vercel-dpa.pdf`
- [~] 3. DPA Resend: ban public da luu `resend-dpa.html`; **ban da ky tai khoan** can login > Settings > Documents > tai ve (5 phut - can tai khoan chu)
- [~] 4. OpenAI: DPA hieu luc tu dong tu 01/01/2026, ban luu `openai-dpa.txt`; **execute form** lay ban ky can business account + Org ID (10 phut - can tai khoan chu)
- [x] 5. DPA Anthropic da luu `docs/legal/dpa/anthropic-dpa.pdf`
- [x] 6. Google Cloud DPA da luu `docs/legal/dpa/google-cloud-dpa.html`
- [x] 7. OpenRouter: **da gui email xin DPA** 05/11/2026 (Resend id 01a1a901-da6c, tu linhld@vieschool.com) - cho phan hoi
- [x] 8. Bo ho so tai `docs/legal/dpa/` kem README

**Con lai 2 viec nho can tai khoan chu (~15 phut):** tai ban ky Resend tu Settings > Documents, va execute DPA OpenAI o platform.openai.com (neu muon co ban ky trong ho so - tuy chon vi da tu dong hieu luc).

## Ghi chu cho ho so chuyen du lieu

- Supabase: chon region nhat co the khi tao project - ke khai region that trong ho so.
- Vercel: primary processing facilities US theo DPA section 13.
- OpenAI: co the xin them "zero data retention" cho API (qua Compliance APIs trong Organization settings) - tang uy tin khi trinh So.
- Anthropic: API van la processor theo DPA - ok.
- Tat ca DPA tren deu theo khuan GDPR/SCC - chap nhan duoc nhu "hop dong bao ve du lieu" theo ND 356/2025; luat su xac nhan lai khi nop ho so.
