# CR-062 - Tuyen sinh dau cap (module tuyen_sinh)

## Nguon yeu cau (logic nghiep vu user dua)
- Lop 6 (tieu hoc -> THCS): truong nhan ho so dang ky -> duyet -> nhap hoc.
- Lop 10 (THCS -> THPT): dang ky -> dang ky du thi (SBD) -> thi -> do/truot
  -> nhap hoc -> gan ma dinh danh -> phan cong giang day (da co san).
- Module ban rieng: them key `tuyen_sinh` vao school_features.

## Chuan thuc te VN
- Lop 6: xet tuyen theo dia ban tuyen (khong thi tuyen, tru truong chuyen) -
  flow submitted -> approved/rejected -> enrolled.
- Lop 10: thi tuyen 3 mon Toan/Van/Ngoai ngu (+ mon chuyen neu co) - flow
  submitted -> exam_registered (co SBD) -> cham diem -> passed/failed theo
  diem chuan -> enrolled.
- Ma dinh danh HS: students.national_id da co san.

## Scope
- admission_campaigns: level khoi_6|khoi_10, quota, benchmark, status.
- admission_applications: ho so + SBD + exam_scores jsonb + total + status.
- Trang /school/admissions (bgh/pht/admin): campaign CRUD, import Excel/
  nhap tay ho so, duyet, cap SBD, nhap diem, chot diem chuan -> do/truot,
  nhap hoc -> tao students (national_id).
- KHONG lam: cong dang ky public (sau), chuyen truong chuyen rieng.

## AC
1. bgh/pht/admin tao campaign 2 level; gvcn khong thay menu. so_gd chi
   giam sat (SELECT qua RLS, khong thao tac - thao tac thuoc truong).
2. Import Excel ho so -> rows trong DB (verify bang query).
3. khoi_6: approve -> enrolled tao students + national_id.
4. khoi_10: cap SBD -> nhap diem -> chot benchmark -> pass/fail -> enroll.
5. Module off: nav an + route deny + action reject.
6. RLS: chi cung truong thay campaign cua minh.

## Quyet dinh nghiep vu (review r-adm1)
- Quota (chi tieu): khi quota > 0 va so thi sinh dat benchmark vuot quota,
  cutoff hieu luc = diem cua thi sinh xep hang thu quota (theo tong diem).
  Dong diem o nguong deu do (khong xet tieu chi phu - de cho CR sau neu
  truong can thu tu uu tien khac).
- Finalize block khi con thi sinh exam_registered chua co diem
  (missing_scores:N) - khong cho chot khi con nguoi thieu diem.
- Nhap hoc atomic qua RPC admission_enroll: khoa advisory theo campaign,
  kiem campaign+class cung truong, find-or-create students theo code
  (code unique toan cuc, khong theo truong) + national_id de retry khong
  sinh trung, link CAS status approved|passed + student_id null.
- Cap SBD atomic qua RPC admission_assign_exam_numbers (advisory lock)
  - tranh race 2 request cap trung so.
- Chot ket qua atomic qua RPC admission_finalize (advisory lock +
  lock campaign row).
