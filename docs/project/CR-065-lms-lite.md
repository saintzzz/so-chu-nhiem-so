# CR-065: lms-lite - HS lam bai trac nghiem truc tuyen

## Nguon

PO roadmap sau phan tich doi thu (`docs/research/COMPETITIVE-ANALYSIS.md`):
vnEdu LMS / K12Online co lop hoc ao + cham tu dong; ta co ngan hang
cau hoi + sinh de nhung HS chua lam bai tren he thong. `tvc_exam_sessions`
+ `tvc_exam_submissions` la dead schema - scaffold san nhung chua co code.

## Scope v1

1. GV giao de da co (`tvc_exams`) cho lop: chon lop + cua so mo/dong +
   thoi luong -> tao session (`tvc_exam_sessions` + class_id/school_id/
   opens_at/closes_at).
2. HS authenticated (`hoc_sinh`) thay bai duoc giao trong portal, vao
   lam trong cua so, nop 1 lan.
3. Cham tu dong: multiple_choice, true_false_4, short_answer theo
   `answer.correct`; essay -> `essay_pending` cho GV cham sau.
4. GV xem ket qua theo session: diem tu dong, trang thai nop, danh sach
   HS chua nop.
5. Module flag `lms_lite` - doc lap, ban kem theo truong.

## Thiet ke

- `tvc_exam_sessions`/`tvc_exam_submissions` la VIEW tren schema `tvc`
  (app TVC360 dung chung) -> KHONG dung. Bang rieng `lms_sessions` +
  `lms_submissions` trong public; snapshot de (stem/qtype/points/correct)
  vao `lms_sessions.questions` luc giao - de da giao immutable, khong
  FK cross-schema, audit-sound.
- `lms_sessions`: school_id, exam_id (tham chieu tvc.exams), title,
  class_id, owner_id, duration_minutes, opens_at/closes_at, status
  (open/closed), questions jsonb.
- `lms_submissions`: session_id, student_id, school_id, student_name,
  class_name (denormalize luc start), answers, status
  (in_progress/submitted), auto_score, max_auto_score, essay_pending,
  started_at/submitted_at. unique(session_id, student_id).
- RPC security-definer:
  - `lms_assign(p_exam, p_class, p_opens, p_closes, p_duration, p_title)`
    -> check role + owner/cung-truong + class cung truong + module +
    window hop le -> snapshot de vao session.
  - `lms_my_assignments()` -> HS xem bai giao cho lop minh + state
    (upcoming/open/in_progress/submitted/closed) + diem.
  - `lms_session_results(p_session)` -> GV xem submissions + HS chua nop.
  - `lms_start_attempt(p_session)` -> check hoc_sinh + class match +
    window + chua co submitted -> tra de (KHONG kem answer/solution)
    + tao in_progress submission.
  - `lms_submit_attempt(p_session, p_answers)` -> cham auto, submitted.
  - `lms_save_draft` de tam: v1 khong luu draft.
- Auto-score o server trong RPC (khong tin client): so cau dung x points.
- short_answer cham exact-match normalized (trim, casefold, bo khoang
  trang thua); essay_pending=true neu de co essay.

## RLS / bao mat

- Session read: staff cung truong doc het; HS chi doc session lop minh.
- `lms_sessions.questions` chua dap an -> revoke table grant, cap lai
  select THEO COT (tru questions); HS khong the select dap an qua
  PostgREST. Insert/delete chi qua RPC; update chi cot `status` (CAS
  dong bai).
- `lms_submissions`: revoke ghi truc tiep; HS doc bai minh qua RLS,
  staff cung truong doc het; moi ghi qua RPC.
- RPC tra stem/qtype/points/context/media, tuyet doi khong tra 'correct'.
- Moi RPC + write policy check `lms_module_enabled` (module flag o DB).
- Deadline server-side: least(closes_at, started+duration) + 60s grace;
  nop 2 lan -> already_submitted.

## Khong lam (v1)

- Ngan hang de thi ngau nhien per-HS, chong gian lan (tab switch),
  nhieu lan lam, chuong trinh tu hoc - ghi debt.
- Essay grading UI (hien tai GV cham qua ket qua; trang cham rieng sau).

## Acceptance criteria

- AC-65.1: `lms_lite` la module doc lap trong school_features + nav.
- AC-65.2: GV giao de -> session co class_id + window; HS lop do thay
  trong portal; HS lop khac KHONG thay (RLS/RPC).
- AC-65.3: `lms_start_attempt` khong tra answer/solution; ngoai cua so
  raise `not_open`; HS lop khac raise `forbidden`.
- AC-65.4: `lms_submit_attempt` cham dung MC/TF/SA, essay_pending dung;
  nop 2 lan bi `already_submitted`.
- AC-65.5: module off -> action + RPC raise `module_disabled`.
- AC-65.6: UI qua Playwright: GV giao -> HS lam -> nop -> GV thay ket qua.
