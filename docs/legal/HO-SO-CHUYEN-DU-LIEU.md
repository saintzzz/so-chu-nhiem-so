# HO SO CHUYEN DU LIEU CA NHAN RA NUOC NGOAI - KHUNG NOP

Phap cu: Luat 91/2025 + ND 356/2025 - chuyen DLCN ra nuoc ngoai phai lap ho so danh gia tac dong chuyen du lieu, nop cho co quan chuyen trach ve bao ve du lieu ca nhan trong 60 ngay ke tu ngay chuyen.

Trang thai: KHUNG - dien xong khi co DPA providers (xem DPA-PROVIDERS-GUIDE.md) + luat su xac nhan.

## 1. Thong tin ben chuyen / ben nhan

- Ben chuyen: VieSchool - Sổ Chủ Nhiệm Số - dai dien: Lê Duy Linh - email linhld@vieschool.com - dia chi: [dien khi nop]
- Vai tro: ben xu ly du lieu theo chi dao cua truong hoc (ben kiem soat)

## 2. Danh muc du lieu chuyen

| Processor | Nuoc/Region | Loai du lieu | Muc dich | Tan suat |
|---|---|---|---|---|
| Supabase Inc | [region project - dien] | Toan bo du lieu ung dung + auth | Luu tru, truy van | Lien tuc |
| Vercel Inc | My (primary) | Request log, code chay ung dung, env | Hosting web app | Lien tuc |
| Resend (Plus Five Five Inc) | My | Email PHHS/GV + noi dung thong bao | Gui email giao dich | Theo su kien |
| OpenAI OpCo LLC | My | Prompt da luoc PII + an danh hoa ten | Tinh nang AI | Theo request |
| Anthropic PBC | My | Prompt da luoc PII + an danh hoa ten | Tinh nang AI fallback | Theo request |
| Google (Gemini API / Vertex) | My/Global | Prompt da luoc PII + an danh hoa ten | Tinh nang AI | Theo request |
| OpenRouter | My | Prompt da luoc PII + an danh hoa ten | Tinh nang AI fallback | Theo request |

Ghi chu giam thieu: du lieu gui den AI providers di qua `src/lib/ai-privacy.ts` - redact dinh danh (email/SDT/CCCD/ma HS) + pseudonymize ten; khong gui khoi du lieu tho.

## 3. Co so phap ly va dieu kien chuyen

- [ ] Hop dong/DPA voi tung ben nhan (checklist tai DPA-PROVIDERS-GUIDE.md)
- [ ] Dong thuan/cos o xu ly cua ben kiem soat (truong) - dieu khoan ToS 2.x
- [ ] Thong bao chu the qua /legal/privacy muc 4
- [ ] Bien phap ky thuat: TLS, RLS, phan quyen role, audit log, redact/pseudonymize

## 4. Danh gia rui ro chuyen du lieu

| Rui ro | Danh gia | Giam thieu |
|---|---|---|
| Bo nhan o quoc gia khong co khung BV du lieu tuong duong | My - co co che SCC/DPF trong DPA providers | DPA kem SCC |
| Du lieu tre em bi xu ly ngoai tam kiem soat | Cao | Truong = controller + consent chain + redact truoc AI |
| Dung sai muc dich boi provider | Thap | DPA cam xu ly ngoai chi dao; no training data (API business tier) |
| Ro ri tai provider | Thap-Trung | SOC2 cac provider + runbook breach 72h noi bo |

## 5. Ke khai khi nop

- Mau ho so theo huong dan cua co quan chuyen trach (Cap cuc An ninh mang - Bo Cong an; cap nhat cong nop hien hanh khi nop)
- [ ] Bien ban danh gia tac dong (tai lieu nay + DPIA-v2)
- [ ] Ban sao DPA da ky
- [ ] Mo ta bien phap to chuc + ky thuat
- [ ] Cam ket dap ung yeu cau kiem tra

## 6. Viec con lai truoc khi nop

1. Hoan tat checklist DPA-PROVIDERS-GUIDE.md (muc 1-7)
2. Dien region that cua Supabase project vao bang muc 2
3. Luat su xem lai + ky ten
4. Nop trong 60 ngay - luu y: moc 60 ngay de bam tinh tu luc chuyen du lieu thuc te; khuyen nghi nop som truoc truong tra phi dau tien.
