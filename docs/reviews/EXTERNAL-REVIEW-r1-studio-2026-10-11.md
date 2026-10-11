# External Review r1 - Studio fixes (2026-10-11)

**Degraded mode**: pinned cross-model subagent (reviewer-gpt) không chạy được -
weekly usage quota hết (trace c66c44f2). Codex Cloud không khả dụng trong môi
trường này. Review thực hiện bởi self-review có cấu trúc của primary agent
(SWE-2) kèm verify thực nghiệm trên prod/DB thay vì chỉ đọc code. Cần re-run
cross-model khi quota phục hồi.

**Diff reviewed**: `1756635` (ensureTvcProfile trong reviewMaterial),
`2a3ce1e` (AI hedged race + gemini model order + CR-048 DB migration).

## Scope check: writers vào bảng có FK -> tvc.profiles

| Bảng / cột | Writer path | ensure/sync |
|---|---|---|
| materials.author_id | saveMaterial | ✓ line 74 |
| matrices.owner_id | saveMaterial | ✓ line 74 |
| reviews.reviewer_id | reviewMaterial | ✓ hotfix line ~187 |
| reviews.reviewer_id | submitMaterialReview | ✓ (author - đã ensure ở save) |
| questions.owner_id | saveQuestion | ✓ line ~334 |
| khbd_templates.created_by | saveKhbdTemplate | ✓ line ~707 |
| generations.user_id | generate route | ✓ line 418 |
| exams.owner_id | (không có writer trong SCN - bảng của TVC360) | n/a |

=> Class bug đã đóng bởi 2 lớp: ensure ở mọi path + trigger CR-048 bảo đảm
staff luôn có row kể cả path mới trong tương lai.

## Findings

- **MEDIUM (noted, không fix trong vòng này)**: `ensureTvcProfile()` nuốt lỗi
  (không return error) - nếu upsert fail thì RPC vẫn fail FK với message generic
  "Không cập nhật được.". Được giảm thiểu mạnh bởi trigger CR-048 (staff luôn có
  row ngay khi tạo/đổi role) - ensure chỉ còn là belt cho path auth-only.
- **LOW**: hedged race để các call thua chạy tiếp server-side - burn thêm quota
  tối đa raceN-1 request/doc. Giới hạn ở generateDoc (race=3, AI_DOC_RACE tunable);
  call JSON nhỏ giữ sequential.
- **LOW**: tvc.profiles.role của row tạo trước (qua ensure) giữ 'giao_vien' kể cả
  BGH - by design không downgrade; SCN RBAC không đọc tvc role (chỉ là FK anchor).
  Chỉ ảnh hưởng app TVC360 standalone nếu có - chấp nhận được, ghi vào CR-048.
- **LOW**: trigger chạy sau mọi INSERT/UPDATE public.profiles - overhead không
  đáng kể (update profiles hiếm).
- **OK**: race resolve-once, pending counter đúng; sau race fail thì sequential
  tiếp từ config N+1 - worst-case bằng hành vi cũ (không tệ hơn).
- **OK**: `AI_PROVIDER`/`AI_ALLOWED_PROVIDERS`/`GEMINI_MODELS`/env model ordering
  được tôn trọng trong cả race path; test hook AI_FORCE_ERROR vẫn hoạt động.
- **OK**: không có secret/key nào được log; migration chỉ đọc public.profiles,
  ghi tvc.profiles - SECURITY DEFINER cần thiết cho cross-schema write.
- **OK**: verify thực nghiệm - update role hoc_sinh->bgh tạo tvc row
  kiem_duyet; hoc_sinh insert không tạo row; race=3 đo được 5.3s vs 33.7s.

## Verdict

ACTIONABLE_CRITICAL_HIGH: 0

**Khuyến nghị**: re-run cross-model review khi quota phục hồi (subagent
reviewer-gpt) trước đợt release lớn tiếp theo; không block cho 2 commit này vì
(a) fix đã được verify trên prod bằng E2E thật, (b) blast radius nhỏ.
