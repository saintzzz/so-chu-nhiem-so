# CR-040: Sinh username theo quy ước tên thật Việt Nam

## Vấn đề (why)

Tài khoản hiện tạo thủ công theo vai trò (`gvcn@demo.scn`) hoặc pattern seed
(`minh.tv@nd.scn`). Thực tế trường học cấp tài khoản theo quy ước:
tên riêng + chữ cái đầu họ và đệm, viết liền không dấu.

Ví dụ: `Lê Duy Linh` → `linhld`; một người khác sinh cùng base (vd trùng
tên) → `linhld1`, `linhld2`... Khi đưa vào trường thật, admin tạo hàng
chục tài khoản - gõ email tay từng người vừa chậm vừa không nhất quán.

## Phạm vi (what) - đã chốt với user

1. **`src/lib/username.ts`** - util chung:
   - `usernameBase(fullName)`: bỏ dấu tiếng Việt, lowercase, chỉ a-z0-9;
     từ cuối (tên riêng) + chữ đầu các từ trước (họ + đệm).
   - `suggestUsername(fullName, taken)`: thêm hậu tố số khi base đã bị chiếm.
2. **`/school/users` (form tạo cán bộ)**: gõ họ tên → tự đề xuất email
   `username@<domain chính của trường>`; admin sửa tay được (đề xuất,
   không ép; `emailTouched` giữ giá trị tay).
3. **`scripts/bootstrap-school.mjs`**: sheet `can_bo` thiếu email → tự sinh
   + dedupe cả file lẫn tài khoản hiện có; `--domain` để ép domain,
   mặc định = domain đa số hiện có của trường.
4. **`scripts/rename-demo-accounts.mjs`**: đổi email toàn bộ tài khoản demo
   sang quy ước mới (user chốt "đổi luôn") - đã apply prod: **88 tài khoản**
   (`auth.users` + `profiles`). `admin@demo.scn` giữ nguyên (tài khoản hệ
   thống, không phải người); tài khoản app khác cùng project Supabase
   (`@students.ioe-practice.example`) không động vào.
5. **Seed + docs**: `seed-real-demo.mjs` (teacherEmail bỏ dấu chấm, demo
   accounts → email tên thật), toàn bộ guide/demo scripts/QA scripts cập
   nhật email mới; regen PPTX/DOCX + đồng bộ `docs/handover/`.
6. **Fix kèm theo**: block email demo trong `src/lib/email.ts` + cron
   parent-digest nới từ `@demo.scn` → mọi `*.scn` (parent contact emails
   hiện là `@mail.scn` - block cũ đã không còn cover, rủi ro spam thật).

## Tác động (impact)

| Tầng | Thay đổi | Rủi ro |
|---|---|---|
| `src/lib/username.ts` | File mới (~44 dòng) | Thấp - pure function, unit test |
| `components/school/users-board.tsx` | Auto-suggest email + dedupe | Thấp - chỉ gợi ý |
| `bootstrap-school.mjs`, `gen-init-template.mjs` | Email tùy chọn, tự sinh | Thấp - dry-run verified |
| `rename-demo-accounts.mjs` | 88 email đổi trên prod | Đã apply + verify login |
| `seed-real-demo.mjs` + ~20 file docs/QA | Email mới | Thấp - thay thế đồng nhất |
| `src/lib/email.ts`, cron digest | Block `*.scn` | Cải thiện - chặn đúng hơn |

## Tiêu chí nghiệm thu

- `suggestUsername("Lê Duy Linh", [])` → `linhld`; với `linhld` đã có →
  `linhld1`; `linhld` + `linhld1` có → `linhld2`.
- Form tạo cán bộ: gõ "Phạm Thị Lan Anh" → đề xuất `anhptl@<domain>`;
  tên trùng → đề xuất hậu tố số; sửa tay không bị ghi đè.
- Bootstrap: `can_bo.email` trống → tự sinh, warn log rõ, chạy lại
  idempotent; `--domain` ép domain khi trường chưa có tài khoản.
- Login prod bằng email mới (vd `anhptl@nd.scn` / `demo1234`) thành công.
- Gates: tsc/lint/build/tests/consistency xanh.

## Kết quả

- Đã apply prod: 88/88 tài khoản đổi thành công, không trùng email.
- Mapping chính: `gvcn@demo.scn`→`anhptl@nd.scn`, `gvbm`→`minhtv@nd.scn`,
  `bgh`→`hainv@nd.scn`, `pht`→`duclm@nd.scn`, `totruong`→`hanhlth@nd.scn`,
  `ketoan`→`trangpt@nd.scn`; CVA: `oanhdtk`/`lienttb`/`phuongttm`/`havt@cva.scn`;
  KD: `ngaltt`/`longhd`/`anhdn@kd.scn`; `phuhuynh`→`annv@nd.scn`,
  `hocsinh`→`baong@nd.scn`, `sogd`→`sovqt@demo.scn`, `ubnd`→`daonvl@demo.scn`.
- Staff GV: `ten.vt@<tag>.scn` → `tenvt@<tag>.scn` (bỏ dấu chấm, đồng quy ước).
