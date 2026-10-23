# CR-053 Architecture - Học bạ số (rev 3)

**Phase:** Tech Lead - **Trạng thái:** rev 3 sau review r2 (7 findings đã vá).
**Inputs:** `CR-053-ba-requirements.md` (rev 3), `CR-053-design.md` (rev 2).

## 1. Schema - migration `20261214_cr053_year_end_decisions.sql`

```sql
-- Backfill legacy NULL trước khi NOT NULL/unique có nghĩa
insert into public.academic_years (school_id, name, start_date, end_date, is_current)
  select s.id, '2026-2027', '2026-08-05', '2027-05-31', true from schools s
   where not exists (select 1 from academic_years y where y.school_id = s.id);
update classes c set academic_year_id =
  (select y.id from academic_years y where y.school_id = c.school_id and y.is_current)
  where c.academic_year_id is null;

create table public.year_end_decisions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  school_id uuid not null references schools(id),
  academic_year_id uuid not null references academic_years(id),
  stage text not null default 'initial'
    check (stage in ('initial','after_retest','after_summer')),
  kqht text check (kqht in ('tot','kha','dat','chua_dat')),
  kqrl text check (kqrl in ('tot','kha','dat','chua_dat')),
  danh_hieu text check (danh_hieu in ('xuat_sac','gioi')),
  giay_khen_note text,
  promotion text check (promotion in ('len_lop','kiem_tra_danh_gia_lai','ren_luyen_he','o_lai')),
  override_legal_ground text
    check (override_legal_ground in ('tt22_9_3','danh_gia_lai','hs_khuyet_tat','mien_mon')),
  override_note text,
  exempt_subject_ids uuid[] not null default '{}',
  computed_snapshot jsonb,
  status text not null default 'draft'
    check (status in ('draft','submitted','approved','rejected','locked')),
  reject_reason text,
  revision int not null default 1,
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, academic_year_id, stage),
  check (status <> 'rejected' or (reject_reason is not null and char_length(btrim(reject_reason)) >= 10)),
  check (override_legal_ground is null or (override_note is not null and btrim(override_note) <> ''))
);

alter table public.year_end_decisions enable row level security;
revoke all on public.year_end_decisions from anon;
revoke delete on public.year_end_decisions from authenticated;
```

`evaluation_plan` trên `students` **bỏ** - HS khuyết tật/miễn môn xử lý qua `override_legal_ground` + `exempt_subject_ids` (r2 F5.4: tránh dead schema).

## 2. RLS - explicit role-set, `my_roles()` (initplan) cho concurrent roles

```sql
create policy yed_gvcn_read on public.year_end_decisions for select
  using ((select public.my_roles()) @> array['gvcn']
         and public.scn_student_in_my_homeroom(student_id));

-- Tách bgh/pht: pht campus-scoped qua scn_student_in_school (scn_pht_allows_campus),
-- khớp R2-10 trên mọi bảng bundle -> không lệch list/detail (r2 F4 option a)
create policy yed_bgh_read on public.year_end_decisions for select
  using ((select public.my_roles()) @> array['bgh']
         and school_id = (select public.my_school_id()));
create policy yed_pht_read on public.year_end_decisions for select
  using ((select public.my_roles()) @> array['pht']
         and public.scn_student_in_school(student_id));

create policy yed_dept_read on public.year_end_decisions for select
  using ((select public.my_roles()) && array['so_gd','ubnd']
         and school_id in (select public.scn_my_scope_school_ids()));  -- admin không khớp

create policy yed_gvcn_ins on public.year_end_decisions for insert
  with check ((select public.my_roles()) @> array['gvcn']
    and public.scn_student_in_my_homeroom(student_id)
    and school_id = (select public.my_school_id())
    and status in ('draft','submitted')
    and approved_by is null and approved_at is null
    and reject_reason is null and giay_khen_note is null);

create policy yed_gvcn_upd on public.year_end_decisions for update
  using ((select public.my_roles()) @> array['gvcn']
    and public.scn_student_in_my_homeroom(student_id)
    and status in ('draft','rejected'))
  with check (status in ('draft','rejected','submitted'));   -- rejected->rejected = lưu sửa; ->submitted = trình lại

create policy yed_bgh_upd on public.year_end_decisions for update
  using ((select public.my_roles()) @> array['bgh']
    and school_id = (select public.my_school_id())
    and status in ('submitted','approved'))
  with check (status in ('approved','rejected','locked'));
-- DELETE: không policy -> deny hoàn toàn
```

## 3. Trigger `trg_yed_guard` (BEFORE INSERT OR UPDATE) - spec đầy đủ

**Bypass:** `if pg_trigger_depth() > 1 or auth.jwt()->>'role' = 'service_role' then return new;` (cho trigger lock ở §4).

**INSERT:**
- `stage='initial'`: luôn OK.
- `stage='after_summer'`: require exists row `(student_id, academic_year_id, 'initial')` với `status in ('approved','locked') and promotion='ren_luyen_he'`.
- `stage='after_retest'`: require exists row cùng (student,year) `status in ('approved','locked') and promotion='kiem_tra_danh_gia_lai'` (initial hoặc after_summer) AND chưa tồn tại row after_retest (at-most-once).
- `NEW.decided_by = auth.uid()`, `NEW.decided_at = now()` nếu null → gán.
- Tenant: `students→classes.school_id = NEW.school_id` và `classes.academic_year_id = NEW.academic_year_id`.

**UPDATE - transitions hợp lệ** (ngoài list → `raise exception`):
| OLD → NEW | Ai | Điều kiện thêm |
|---|---|---|
| draft→draft | gvcn | giữ revision |
| draft→submitted | gvcn | |
| rejected→rejected | gvcn | lưu sửa trước khi trình lại |
| rejected→submitted | gvcn | `revision = old.revision+1`; clear `reject_reason=null`, `approved_by/at=null` |
| submitted→approved | bgh | `approved_by=auth.uid()`, `approved_at=now()` |
| submitted→rejected | bgh | `reject_reason` >=10 ký tự (check constraint) |
| approved→locked | trigger §4 | chỉ qua bypass |

**Immutable mọi UPDATE:** `student_id, school_id, academic_year_id, stage, decided_by, decided_at` (decided_* chỉ set ở insert/rejected→submitted).

**Field ownership chéo (r2 F2.2):**
- Path gvcn (old.status ∈ draft|rejected): cấm đổi `giay_khen_note, approved_by, approved_at` (giữ = old); `reject_reason` chỉ được clear khi →submitted.
- Path bgh (old.status ∈ submitted|approved): cấm đổi `kqht, kqrl, danh_hieu, promotion, override_legal_ground, override_note, exempt_subject_ids, computed_snapshot, revision` - BGH chỉ đổi `status, giay_khen_note, approved_by/at, reject_reason`.

## 4. Lock linkage - trigger trên `register_signoffs` (per-class, r2 F3)

`register_signoffs` là per-`class_id`+`period`; lock do client update trực tiếp (`lock-records-client.tsx`). Dùng AFTER trigger:

```sql
create function public.scn_lock_year_end_decisions() returns trigger ... as $$
begin
  if new.type = 'so_hoc_ba' and new.status = 'locked' and old.status is distinct from 'locked' then
    update public.year_end_decisions d set status = 'locked', updated_at = now()
     where d.status = 'approved'
       and d.student_id in (select id from students where class_id = new.class_id)
       and d.academic_year_id = (select academic_year_id from classes where id = new.class_id);
  end if;
  return new;
end $$;
create trigger trg_lock_yed after update of status on public.register_signoffs
  for each row execute function public.scn_lock_year_end_decisions();
```

Lock 1 lớp chỉ khóa quyết định lớp đó; `trg_yed_guard` bypass qua `pg_trigger_depth() > 1`.

## 5. TT22 lib - `src/lib/tt22.ts`

```ts
export type YearRating = 'tot' | 'kha' | 'dat' | 'chua_dat';
export type Stage = 'initial' | 'after_retest' | 'after_summer';
export type Promotion = 'len_lop' | 'kiem_tra_danh_gia_lai' | 'ren_luyen_he' | 'o_lai';
export type Missing = 'thieu_mon' | 'thieu_diem' | 'thieu_hanh_kiem' | null;

export interface ScoredSubject { subjectId: string; dtmCn: number | null; yearFinal: boolean }
export interface YearEndInput {
  scoredSubjects: ScoredSubject[];                        // đã loại exempt + đã split theo assessment_method='score'
  commentResults: ('dat' | 'chua_dat' | 'missing')[];     // đã loại exempt, CN = result HK2
  conductHk1: YearRating | null;
  conductHk2: YearRating | null;
  absentSessions: number;
}

export function hocLucYear(s: ScoredSubject[], c: ('dat'|'chua_dat'|'missing')[])
  : { value: YearRating | null; missing: Missing }
// THỨ TỰ check (r2 F5.3): s.length < 6 → 'thieu_mon' TRƯỚC;
//   rồi mọi scored !yearFinal|dtmCn null hoặc comment 'missing' → 'thieu_diem';
//   rồi bảng Đ.9 + Đ.9.3 bump (đúng 1 phần tử scored HOẶC comment kéo xuống >=2 bậc, còn lại đạt ngưỡng trên → +1 bậc)

export function renLuyenYear(hk1: YearRating | null, hk2: YearRating | null)
  : { value: YearRating | null; missing: Missing }   // 16 pair Đ.8

export function danhHieu(kqht: YearRating | null, kqrl: YearRating | null, s: ScoredSubject[])
  : 'xuat_sac' | 'gioi' | null                        // null input → null (Đ.15)

export function xetLenLop(i: YearEndInput & { stage: Stage; kqht: YearRating | null; kqrl: YearRating | null; hasPriorRetest: boolean })
  : { value: Promotion | null; missing: Missing }
// missing: kqht/kqrl null → 'thieu_diem'/'thieu_hanh_kiem'
// absentSessions > 45 → 'o_lai' (mọi stage)
// initial:        kqrl cd → 'ren_luyen_he'; kqht cd → 'kiem_tra_danh_gia_lai'
// after_summer:   kqrl cd → 'o_lai'; kqht cd & !hasPriorRetest → 'kiem_tra_danh_gia_lai'; kqht cd & hasPriorRetest → 'o_lai'
// after_retest:   (kqrl cd | kqht cd) → 'o_lai'
// else → 'len_lop'
```

**Buổi vắng:** `attendance_records` status `excused`/`unexcused` = **1 row = 1 buổi**, scope `academic_years.start_date..end_date`. Không nhân hệ số.

## 6. Data layer - `src/lib/hocba.ts` (server-only, staff)

```ts
export async function getClassYearEndBundles(classId: string, yearId: string): Promise<YearEndBundle[]>
export async function getStudentYearEndBundle(studentId: string, yearId: string): Promise<YearEndBundle>
```

- **Iterate `subjects` (school-scoped `.eq('school_id',...)`), KHÔNG `bySubject`** - môn 0 grade rows vẫn vào `scoredSubjects`/`commentResults` như 'missing' (r2 F5.1). Split theo `sub.assessment_method === 'comment'` (giá trị DB thật; portal đang dùng fallback `'diem'` + lặp bySubject - bug cần vá khi refactor).
- **`exempt_subject_ids` loại khỏi `subjects` TRƯỚC khi split** - GDTC là comment-subject (r2 F5.2).
- Batch cho class: 1 query/bảng `.in('student_id', ids)` rồi groupBy - grades, conduct_evaluations, competency_evaluations, nlpc_comments, attendance_records (year-scoped), year_end_decisions.
- Reliability: mọi query `fetchAllRows` bọc `mustRows()`, order composite cho bảng không có `id`: competency_evaluations `.order('student_id').order('term').order('attribute_code')`, nlpc_comments `.order('student_id').order('term').order('grp')`; single row dùng `must()`.
- **Portal `portal/student/hoc-ba` chỉ share phần pure-calc/subject+grade+attendance** (vá `'diem'`→đúng method) - KHÔNG gọi staff bundle vì `hoc_sinh` không có SELECT trên `year_end_decisions`/`competency_evaluations`/`nlpc_comments`/`academic_years` (r2 F6.2). Split: `buildSubjectRows(subjects, grades)` pure-ish shared; `getStudentYearEndBundle` staff-only.

## 7. Route + actions

- `src/app/(app)/records/hoc-ba/page.tsx`: `requireRoles(['gvcn','bgh','pht','so_gd','ubnd'])`. Class picker: `hasRole(profile,'pht') && !hasRole(profile,'bgh')` → `.eq('campus_id', profile.campus_id)` (r2 F4a); so_gd/ubnd → school picker trong `scn_my_scope_school_ids`.
- `actions.ts`: `saveDraftYearEnd`/`submitYearEnd`/`approveYearEnd`/`rejectYearEnd` - `getProfile` + `checkActionRole` + server re-verify homeroom/school.
  - **First-save:** `insert ... ` (RLS `yed_gvcn_ins` cho phép draft|submitted); nếu 23505 → fallback CAS update `.eq('id',existing).in('status',['draft','rejected']).eq('revision', rev).select('id')`.
  - **Update path:** CAS `.eq('status', expected).select('id')` (reliability).
  - Audit + notification mỗi transition.
- `src/components/records/hoc-ba-explorer.tsx` + `loading.tsx`.
- Nav `{ label: "Học bạ số", href: "/records/hoc-ba" }`: gvcn→"Quản lý học sinh" | bgh/pht→"Học sinh & chất lượng" | so_gd/ubnd→"Quản trị"; `ITEM_ICONS` + `PageHeader section` khớp.

## 8. Export - server-side `src/app/api/records/hoc-ba/export/route.ts`

`GET ?format=docx|pdf&student=<id>` hoặc `?class=<id>` (class: BGH only).

- Authz: `getProfile`; gvcn→`scn_student_in_my_homeroom` check; bgh→school; pht/so_gd/ubnd/other→**403**.
- `buildHocBaModel(bundle, decision)` shared cho 2 format.
- DOCX: package `docx` hiện có. PDF: `pdfmake` server-side, font Noto Sans 4 variants từ `public/fonts/` (đủ dấu TV + bold/italic); 0KB client.
- Class export: PageBreak per HS, `sortByVietnameseName`. Watermark "BẢN NHÁP - CHƯA DUYỆT" khi status ∉ approved|locked.

## 9. Notifications

`type:'hoc_ba'` + `TYPE_LABELS["hoc_ba"]="Học bạ số"`. Submit→BGH query `.or("role.eq.bgh,concurrent_roles.cs.{bgh}")` same school; approve/reject→`decided_by`. Link `/records/hoc-ba?class=..&student=..` khớp `notif_ins` regex.

## 10. Cascade

ROLE-MATRIX `/records/hoc-ba` row · qa-matrix expectations+deny · check-consistency (requireRoles + RLS exists + nav-icons) · `tests/tt22-year-end.test.mjs` (16 pair, boundaries, Đ.9.3 cả 2 loại môn, stage chains, >45 buổi, missing variants, at-most-once, exempt GDTC) · MEMORY/RUNS append.

## 11. Threat model

| Threat | Mitigation |
|---|---|
| GVCN self-approve/forge | ins column-guard + trigger transitions + actor binding |
| BGH sửa quyết định GVCN | trigger field-ownership chéo |
| Stage skip qua PostgREST | INSERT stage-prereq check |
| Concurrent-role bypass | `my_roles()` @>/&& |
| admin/UBND scope leak | dept_read explicit roles + `scn_my_scope_school_ids` |
| PHT campus leak/mismatch | `scn_student_in_school` + picker campus filter |
| Sửa sau lock | status-guard + trigger deny (chỉ trigger lock được →locked) |
| Export leak | server route 403 |
| Race double-submit | unique + insert-then-CAS |

## 12. Estimate

Migration+RLS+2 trigger 1d · tt22 fns+tests 1d · hocba.ts+route+explorer 1.5d · export 1d · QA/E2E 0.5d · **≈5 ngày**
