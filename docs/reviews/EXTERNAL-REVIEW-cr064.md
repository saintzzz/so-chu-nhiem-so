# EXTERNAL REVIEW - CR-064 Khoan thu / hoc phi

Reviewer: cross-model subagent (reviewer-gpt), 4 rounds.
Ket qua cuoi: **APPROVE - 0 findings** (round 4).

## Rounds

| Round | Verdict | Findings | Commit fix |
|---|---|---|---|
| r1 | REJECT | 7H + 3M + 3L | `3eaeddc` |
| r2 | REJECT | 1H + 1M + 1L | `0db07a9` |
| r3 | REJECT | 1H + 3M | `35ace0f` |
| r4 | **APPROVE** | 0 | - |

## r1 - nen tang

- RPC security-definer thieu role/school check -> them my_roles()/my_school_id() trong `fee_issue_period`, `fee_collect` (20261235).
- Write policies + RPC khong ton trong `school_features` -> helper `fee_module_enabled`, check `module_disabled` o moi write path (20261236).
- Cross-school IDOR (class_id/student_id/fee_item_id/period/invoice) -> trigger `fee_check_tenant` tren 5 bang, raise `cross_school_*`.
- Receipt race count(*)+1 -> bang `fee_receipt_seq` counter per school + unique index `fee_inv_receipt_uq`.
- Issue: lock period `FOR UPDATE`, draft-only, dem insert that qua `GET DIAGNOSTICS`.
- UI: loading.tsx, AutoGrowTextarea cho note, formatMoney dung chung, parent portal co section cong no, notifications cho PH khi phat hanh.

## r2 - notification + parent flag

- HIGH: notification insert trong action bi RLS chan lang le (`parents_staff_read` khong co ke_toan -> links rong). Fix: chuyen vao trong `fee_issue_period` RPC (security definer, join truc tiep), tra ve `{issued, notified}` (20261237). Verified live: "Da phat hanh 435 hoa don, gui 1 thong bao cho phu huynh."
- MED: parent portal doc `school_features` truc tiep (parent khong doc duoc) + khong dua flag error vao srcErrors. Fix: dung RPC `fee_module_enabled` (grant authenticated).
- LOW: portal an ca section khi 0 hoa don -> empty state ro rang.

## r3 - notify scoped + bien lai

- HIGH: notify join tat ca invoices cua period -> draft period co invoice cu lek thong bao. Fix: `v_students uuid[]` chi gom HS vua insert (`v_ins > 0`), notify `ps.student_id = any(v_students)` (20261238).
- MED: join parent khong check cung truong -> join `profiles pr on pr.id = pa.profile_id and pr.school_id = p.school_id`.
- MED: partial payment tieu so BL nhung khong luu -> `fee_payments.receipt_no` + unique index `fee_pay_receipt_uq`; moi lan thu deu co bien lai (dung thuc te). Verified: BL000003 luu tren payment.
- MED: invoices page swallow query error -> error state rieng.

## Verified live (Supabase production DB)

- `fee_issue_period`: {issued:435, notified:1}; `module_disabled`, `cross_school_student`, `already_issued`, `school_mismatch` raise dung.
- `fee_collect`: BL000001/BL000002/BL000003 atomic per school; receipt luu tren payment; overpay/negative bi `invalid_amount`; paid/exempt bi `already_settled`.
- Trigger `fee_check_tenant` chan insert cheo truong ke ca service role.
- E2E ke_toan (trangpt@nd.scn): tao item -> tao dot -> phat hanh 435 -> thu 50k -> hoa don "Da thu du" -> reports dung -> tat module -> route deny -> bat lai.

## Debt ghi nhan (khong blocking)

- Dang ky khoan thu tu chon (fee_registrations) chua co UI - bang + RPC da ho tro.
- In bien lai PDF / hoa don dien tu ND123 - tich h Hop sau.
- Bao cao cong no theo lop/khoi - reports page co ban, mo rong khi co khach.
