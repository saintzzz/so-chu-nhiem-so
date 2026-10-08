# CR-042: Chat luong KHBD chuan CV 5512 + Sinh slide tu giao an + Toi uu hieu nang

- Ngay: 2026-10-08
- Trang thai: approved (user gop 3 hang muc, uy quyen chon thu tu)
- Thu tu thuc hien: **A -> B -> C** (A: loi chat luong ro nhat, risk thap;
  B: workflow moi, risk trung; C: cham dashboard - trang dung nhieu nhat,
  lam cuoi voi scope an toan nhat)

## 1. Phan tich (da nghien cuu thuc te)

### A. KHBD (DC-01) - "chi co khung, khong co noi dung"

- Giao an luu tren prod (`ai_usage: "none"`) la **fallback skeleton**:
  placeholder "GV neu cau hoi/tinh huong mo dau...", khong cau hoi that.
- Khung CV 5512 chinh thuc (Phu luc IV) yeu cau moi hoat dong co:
  **Noi dung = cau hoi/bai tap cu the** va **San pham = dap an/san pham du kien**.
  Prompt hien tai chi doi "5 nhan + bang GV-HS" - khong ep noi dung cu the.
- Khi AI loi -> fallback lang le -> user tuong tinh nang do.

Pham vi A:
1. `prompts.ts` DC-01: yeu cau cot Noi dung chua cau hoi/bai tap viet san +
   du kien cau tra loi/san pham HS; cam meta-text.
2. `fallbacks.ts` fbLessonPlan: bot placeholder (ghi ro "[can GV dien]"
   thay vi gia noi dung), giu khung CV 5512 dung.
3. `tool-runner.tsx`: khi `usedFallback` + doc-based tool -> banner vang
   "AI tam khong dung duoc - day la ban khung mau, chua co noi dung chi tiet"
   thay vi chi ghi "Mau he thong".

### B. Sinh slide tu giao an (DC-06)

- Hien DC-06 nhap doc lap mon/khoi/YCCD/ten bai - khong lien ket DC-01.
- Muc dich thuc te: slide chieu lop hoc bam tien trinh tiet day, chua
  cau hoi/nhiem vu + dap an, kem speaker notes cho GV.

Pham vi B:
1. Trang `/studio/library/[id]`: voi `type=lesson_plan` them nut
   "Sinh bai trinh chieu" -> `/studio/DC-06?from=<material_id>`.
2. Tool page doc `?from`, load material (RLS), truyen `fromMaterial` vao
   ToolRunner -> prefill mon/khoi/YCCD/ten bai + khoa cac truong nguon.
3. Generate route DC-06: `input.material_id` -> load content KHBD phia
   server, dua sections vao ctx.extra -> prompt sinh slide BAM NOI DUNG
   giao an that (cau hoi, nhiem vu, dap an).
4. Speaker notes: prompt sinh block `note` ("Ghi chu GV: ...");
   `pptx.ts` xuat note blocks vao `slide.addNotes()` thay vi hien tren slide.
5. Slide co slide "dap an/nhan xet" cho phan luyen tap khi can.

### C. Hieu nang dashboard + trang nang

Do tren prod (warm): dashboard render stream ~1.4s, cold ~4.7s.
Chuoi await: wave1(classes, school, timetable) -> taughtCls -> students
-> latestAtt -> batch 14 query. ~5 wave x ~200-400ms RTT.

Pham vi C (bao thu, khong doi schema):
1. `timetable_entries` embed `classes(id,name)` -> bo 1 wave.
2. Attendance: 1 query lay records gan nhat theo cua so ngay -> suy ra
   latestAtt trong JS -> bo 1 wave.
3. attTotal/attPresent tinh tu rows da fetch -> bo 2 query con.
4. Quet them pattern await tuan tu o cac page khac neu co de thap.

Rui ro: C cham trang nhieu nhat -> chi toi cau truc truy van, khong doi
business logic; verify bang Playwright so lieu khop cu.

## 2. Ngoai pham vi

- View/RPC gom aggregate (schema change) - de CR rieng neu van cham.
- Cold start Vercel function - van de ha tang, khong phai code.
- ngu_van grade range 1-12 (bug da phat hien) - CR rieng.

## 3. Ket qua verify tren prod (08/10)

- DC-01 prompt that -> Gemini 200, JSON valid 26KB, 9 sections; noi dung
  dung CV 5512: cau hoi nguyen van + "HS du kien tra loi" trong cot
  Noi dung, dung bieu mau truong (host dong "Trai nghiem dau").
- Root cause DC-01 luon ra ban khung tren prod (ca 3 lop, da fix het):
  1. `callGemini` timeout cung 25s < thoi gian sinh doc 40KB+ (~30-60s)
  2. `maxOutputTokens` 8192 sat nguong doc day du ~8-12k tokens
  3. Model sinh loi cu phap JSON ngau nhien (bad_json) -> khong retry,
     khong qua engine -> thang skeleton
- Fix: timeout 55s x 2 lan thu (retry kem nhan JSON hop le) <=110s trong
  maxDuration 120s; token cap 16384; bad_json di duong engine du phong.
- Prod sau deploy `dfe4ffd`: DC-01 "Nhan da thuc mot bien" ->
  provider=gemini (tvc_generations 14:24), khong con BAN KHUNG.
- DC-06 tu KHBD: prefill mon/khoi/bai/YCCD, slide co cau hoi + dap an
  trong note; PPTX export dung speaker notes (verify bang python-pptx).
- Dashboard warm ~1.0s (truoc ~1.4s); khong doi so lieu hien thi.
- Con lai (ops): DEVIN_API_KEY tren Vercel chua xac nhan - khi AI va
  retry deu hong, khong co engine du phong thi van ra ban khung co nhan.
