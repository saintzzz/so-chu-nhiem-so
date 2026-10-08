# CR-041: Hop nhat "AI sinh cau hoi" vao ngan hang Studio + sửa Nhat ky & lich su

- Ngay: 2026-10-08
- Trang thai: approved (user chon phuong an 1)
- Pham vi: `/academics/exams`, `/studio/questions`, `src/lib/audit.ts`

## 1. Yeu cau

1. Panel "AI sinh cau hoi theo chu de" o Quan ly ky thi (`/academics/exams`) sinh
   cau hoi chi de xem/copy, KHONG vao ngan hang, khong gan YCCD, khong duyet -
   trung lap voi Studio. **Phuong an 1**: go bo panel, thay bang loi vao Studio;
   kha nang sinh AI theo chu de duoc dua vao dung ngan hang cau hoi (DC-04)
   de ket qua chay qua pipeline chuan: draft -> gan YCCD -> duyet 2 lop -> DC-03 rut de.
2. Man hinh "Nhat ky & lich su" (`/register/audit`) hien chua co du lieu.

## 2. Phan tich tac dong

### 2a. Luong sinh cau hoi

- `src/components/exams/question-gen.tsx` + `POST /api/ai/gen-questions`:
  panel doc lap, output khong ghi DB. Xoa component; route duoc dung lai
  boi ngan hang (reshape output sang AiRow).
- `src/components/tvc/question-bank.tsx`: da co may `aiRows -> gan YCCD
  tung cau -> importQuestions` (dung cho import anh/PDF). Them nguon
  "sinh theo chu de" dung chung may nay - khong viet pipeline moi.
- `/studio/questions?gen=1` mo san panel sinh (deep-link tu trang ky thi).
- `importQuestions`: them tuy chon `source` (mac dinh "imported"; AI-gen
  dung "generated").

### 2b. Nhat ky & lich su

Trang doc 3 bang: `audit_logs`, `student_record_history`, `digest_deliveries`.
Kiem chung tren prod (2026-10-08): ca 3 bang = 0 dong do:

- Du lieu demo seed bang service role (khong qua server action) nen khong
  co audit; khong co user nao thao tac that truoc do.
- `digest_deliveries` chi ghi khi cron `/api/cron/parent-digest` chay -
  `vercel.json` chua co lich cron (khong tu bat, can quyet dinh van hanh).
- Da verify bang mutation that tren prod: sua `national_id` 1 HS ->
  ca 2 bang ghi dung ngay. Tinh nang hoat dong.

Van de tiem an: `logAudit` fire-and-forget (`void async`) - tren serverless
co the bi cat truoc khi insert xong. Fix bang `after()` cua Next.js:
lich chen giu song sau response ma khong chan UX.

## 3. Thiet ke

### UI

- `/academics/exams`: go `<QuestionGen>`; them card "Sinh cau hoi bang AI"
  mo ta + nut link `/studio/questions?gen=1`.
- `/studio/questions`: nut "Sinh bang AI" (icon Sparkles, canh nut Import).
  Panel: Mon (code), Khoi (1-12), Chu de, Dang (TN 4 phuong an / Tu luan),
  Muc (biet/hieu/van_dung/van_dung_cao), So cau (1-15) -> POST gen-questions
  -> ket qua vao `aiRows` hien co (preview + gan YCCD + import).
- `?gen=1` tu mo panel.

### API

`POST /api/ai/gen-questions` giu nguyen URL, doi output:
`{ rows: [{ stem, qtype, level, points, answer, solution, topic, subject, grade, standard_code }] }`
- `qtype`: `trac_nghiem` -> `multiple_choice` (options ghep vao stem "A. ..."),
  `tu_luan` -> `essay` (answer -> solution).
- `level`: nhan biet->biet, trung binh->hieu, van dung->van_dung,
  van dung cao->van_dung_cao.
- Them input `grade` (bat buoc cung subject, dung de tai YCCD dung scope).
- `standard_code`: AI tu goi y ma YCCD (co the rong - user chon tay).

### logAudit

`audit.ts` duoc goi truc tiep boi ca client components (browser supabase
client) lan server actions -> file nam trong client bundle, KHONG import
tinh `next/server` duoc (build vo). Implementation:

```ts
const work = async () => { /* getClaims + insert, log loi ra console */ };
if (typeof window === "undefined") {
  // server: import dong next/server, len lich after() trong request scope;
  // ngoai request scope after() nem loi -> chay truc tiep
  void import("next/server").then(({ after }) => {
    try { after(() => work()); } catch { void work(); }
  }).catch(() => void work());
} else {
  void work(); // client: fire-and-forget du - trinh duyet giu fetch song
}
```

Phat hien them khi implement: `subject` trong rows tu AI la TEN mon trong
khi ngan hang can MA mon (`subject_code`) de tai YCCD - fix bang cach ep
scope theo lua chon cua GV trong gen form (override `applyAiRows`).

## 4. Test plan

- Static test: exams page khong con import QuestionGen; bank co nut Sinh AI;
  route tra `rows`.
- UI prod: `/academics/exams` hien card link; `/studio/questions?gen=1` mo
  panel; sinh cau hoi -> preview -> gan YCCD -> import xuat hien trong bank.
- Audit: mutation that sinh row `audit_logs` (da verify 2026-10-08).

## 5. Ngoai pham vi (ghi nhan cho PO)

- `digest_deliveries` trong: can lich cron `vercel.json` + RESEND_API_KEY -
  quyet dinh van hanh, khong tu bat vi lien quan gui email that.
- Backfill lich su: khong the - bang la append-only cua thao tac that.
