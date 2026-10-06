# CR-033 - Backlog sweep (xu ly toan bo backlog con lai)

## Pham vi

Gom tat ca backlog con lai cua CR-024..CR-032 vao mot dot:

### Code da implement

1. **Audit cho thay doi quyen** - logAudit `school.feature_grant`,
   `school.item_acl_deny/_remove` (truoc chi co hanh dong, khong ai
   biet ai doi quyen ai).
2. **requireFeature("school.users")** tren /school/users - admin page
   gio chiu feature grant nhu cac trang studio.
3. **Library review theo mon to** - to truong vao /studio/library thay
   2 nhom: "Cho duyet - mon cua to toi" (uu tien) va "mon khac".
   Verify: to truong Toan thay KHBD Toan nhom tren, phieu Tieng Viet
   nhom duoi.
4. **AI job exponential backoff** - useTvcAiJob poll 2s -> +2s/lan ->
   cap 20s (truoc: 3s co dinh, ~67% traffic PostgREST thua khi job dai).
5. **Bo count exact ngan hang** - /studio/questions khong query
   `count:"exact"` nua (tren bank lon, count exact ~2.5s @ conc50);
   client chunk-load den khi het, "dang tai du ngan hang..." hien
   trong luc tai.
6. **TTS preview cho cau nghe Tieng Anh** - nut "Nghe thu" tren ngữ
   cảnh cau tieng_anh dung SpeechSynthesis trinh duyet (mien phi,
   khong can API TTS). Luu y: giam thi doc lai khi thi giay.
7. **Editor tham so hinh (CR-031)** - nut "sua" tren moi figure mo
   JSON spec editor -> parse -> render lai SVG ngay.
8. **ACL listing (CR-030)** - expand cau hoi (admin) thay danh sach
   GV dang bi an + nut x go tung nguoi (truoc chi co prompt nhap email
   mu, khong biet dang an voi ai).
9. **Thong ke nhan su** tren /school/users - chips dem theo vai tro +
   loai hop dong (dem "Chua khai bao" de thay du lieu con thieu).

### Data / coverage

- **Lap day gap YCCD tieu hoc**: viet thu cong 21 cau (qua validate
  + dedupe gate cua harness) cho 21 chuan TOAN/TVIET lop 1-5 chua co
  cau nao trong 3 bank truong test + TC.9 -> TH coverage = 0 gap
  (truoc: 21 YCCD 0 cau). Cau viet tay thay vi harness LLM vi Gemini
  free-tier 20 req/ngay da can.
- **TVIET1.3.1 + TOAN3.TC.9** bo sung rieng sau.

## Quyet dinh khong lam (ghi nhan, khong "bo trong")

| Item | Trang thai | Ly do / CR tiep theo |
|---|---|---|
| Export DOCX/PPTX qua queue+worker | Deferred | Serverless request van OK <5s cho de <50 cau; queue can infra rieng (pgmq/Upstash) - lam khi co 50+ truong |
| Partition questions theo school | Deferred | GIN + school index du cho <1M rows; partition khi >10M |
| Supavisor / nang instance | Ops | Quyet dinh budget cua du an, khong phai code |
| Layer-3 review (So GD) | Deferred | Pilot chua lien truong; mo khi co mo hinh cum truong |
| Media bank curated theo YCCD | Deferred | Can asset thuc (anh co ban quyen) - nghiep vu noi dung |
| QTI/IMS export, "Cung soan" | Roadmap | Tinh nang moi lon, CR rieng |
| Duyet 80 YCCD nhan cong | Nghiep vu | Viec cua hoi dong chuyen mon, tool da ho tro |

## Verify

- typecheck/lint/consistency/build xanh.
- Playwright: gv001 (to truong TN) - bank loc "Mon cua to toi" chi
  cau Toan; DC-01 preselect toan; library nhom dung 2 muc.
- DB: 63+3 cau GAP insert dung 3 truong, subject_code/grade backfilled.
