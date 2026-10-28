# CR-067: Bien dong hoc sinh (chuyen den/di, bao luu, nhap hoc lai)

## Why
Truong can quy trinh bien dong chinh thuc: chuyen truong, bao luu, nhap hoc lai.
Hien `students.status` chi duoc sua tay, khong co duyet, khong co giay to, khong co
lich su nghiep vu (chi co `student_record_history` per-field). Quy dinh: TT 32/2020
Dieu le truong - chuyen truong/bao luu do BGH quyet dinh, co ho so kem theo.

## Module
Module ban kem `bien_dong_hs` (school_features). Tat flag = mat nav + redirect route
+ RPC `module_disabled` + RLS read chan PostgREST (khop pattern CR-066).

## Scope
- Bang `sm_requests`: yeu cau bien dong (4 loai: transfer_out, transfer_in, reserve,
  return). Trang thai: pending/approved/rejected/cancelled.
- Snapshot `student_name` + `class_label` tai thoi diem yeu cau (audit-sound).
- `students.status` projection: them `reserved` vao check constraint
  (active/transferred/graduated/suspended/reserved). Loi chuyen di -> `transferred`.
- RPC security-definer (moi write qua RPC, direct table write revoke):
  - `sm_create`: gvcn tao cho HS lop chu nhiem cua minh; bgh/admin tao moi.
    transfer_in chi bgh/admin (can to_class_id + payload {full_name,dob,gender,
    national_id,address}). Guard: trang thai hop le theo loai, khong trung pending.
  - `sm_decide`: chi bgh/admin. Approve apply projection atomic:
    - transfer_out -> status='transferred'
    - reserve -> status='reserved'
    - return -> status='active' (+ optional doi lop to_class_id)
    - transfer_in -> insert students moi (code HS###### seq advisory-lock),
      class_id=to_class_id, created_student_id backfill
  - `sm_cancel`: nguoi tao hoac bgh/admin, chi khi pending.
- Ghi `student_record_history` cho thay doi status/class_id (changed_by = nguoi duyet).
- Thong bao cho nguoi yeu cau khi duyet/tu choi (notifications, link /movements).
- Tenant trigger: student_id + to_class_id phai cung school_id.
- UI `/movements`: GVCN + BGH/admin tao yeu cau; BGH/admin duyet; list + filter.
- Nav: "Bien dong hoc sinh" o section Quan ly hoc sinh (gvcn) + Hoc sinh & chat luong (bgh).

## Impact
- students_status_check: drop + re-create them 'reserved' - tuong thich nguoc.
- Cac query `.eq("status","active")` san co (attendance, leaves...) tu dong loai
  HS bien dong - dung semantics, khong can sua.
- Khong cham hoc ba/diem: HS bi bien dong van giu lich su hoc tap.

## Out of scope / backlog
- Xac nhan hai chieu giua 2 truong (transfer_out sang truong khac trong he thong):
  can lien thong multi-school - chua co co che, backlog.
- Giay to dinh kem scan/upload: payload giu metadata text; file upload -> backlog
  (can Storage bucket + quy dinh giay to).
- Thong bao PH/HS ve bien dong: backlog (kenh PH = email, can template rieng).

## Test
- Static contract tests/cr067.test.mjs.
- Live: tao/duyet tung loai, deny paths (gvbm, cross-school, module off, double
  pending, approve 2 lan), transfer_in tao HS moi + code seq, history + notification.
