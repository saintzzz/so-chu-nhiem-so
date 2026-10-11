# External Review Loop — Round 2 (Codex Cloud)

- **Ngày:** 2026-10-11
- **Kênh:** Codex Cloud qua ChatGPT web (Playwright/CDP, Chrome thật profile riêng) — đúng runbook primary channel.
- **Scope:** GitHub master `7e36fdf` (r16 remediation `7a4cc86` + E2E threshold `7e36fdf`). Codex đọc file đổi qua GitHub API (local snapshot cũ hơn).
- **Kết luận Codex:** "Round 2 is not clean" — 0 Critical mới; 6 High + 1 conditional High + 5 Medium.

## Triage & xử lý

| # | Sev | Finding | Triage | Xử lý |
|---|---|---|---|---|
| 1 | High | `scn_sync_period_attendance` NULL-authz fail-open (my_roles() NULL → `if not NULL` không raise) | **Confirmed** (source + logic) | Fixed — `auth.uid() is null` early raise + `v_allowed is distinct from true`; cùng pattern fix ở `scn_save_period_log`; revoke EXECUTE từ public/anon trên 4 RPC. Smoke: anonymous `period_attendance_sync_denied` ✅ |
| 2 | High | INSERT question với `review_state='approved'` bypass duyệt | **Confirmed** (`tvc_q_insert` không ràng review_state) | Fixed — `trg_tvc_question_guard` nay là `before insert or update`; INSERT non-RPC/non-service ép `review_state='unreviewed'` + `owner_id=auth.uid()` + school check. Smoke: insert approved → unreviewed ✅ |
| 3 | High | context/media/standard_ids/subject_code/grade đổi không invalidate approval | **Confirmed** | Fixed — guard UPDATE đã thêm đủ 6 trường + variant_params vào invalidation set. Smoke: update context trên câu approved → unreviewed ✅ (đã revert) |
| 4 | High | `former` vẫn giữ owner access + submit được | **Confirmed** | Fixed — owner clause của `tvc_q_read/update/delete` + `tvc_mat_owner` nay yêu cầu `scn_is_edu_staff()` (trừ câu hỏi cá nhân school_id null); `submit_material_review` thêm auth + staff + `scn_has_feature('studio')` + tenant + `scn_item_denied`; `sync_tvc_profile` conflict update giờ sync cả role (max-rank, không hạ cấp admin/kiem_duyet sẵn có, 'former' quay lại thì cấp role mới) |
| 5 | High | Guard profiles chặn cả BGH quản lý nhân sự | **Confirmed + sâu hơn báo cáo**: prod chỉ có `profiles_self_update` → BGH update nhân sự đã no-op từ trước r16 (RLS lọc hết, action báo "Không cập nhật được hồ sơ") | Fixed — (a) `profiles_no_priv_escalation` thêm nhánh BGH/PHT: cùng trường, không đổi school/org, role đích ⊆ nhân sự trường, concurrent ⊆ CONCURRENT_ELIGIBLE, campus/dept thuộc trường, không tự sửa mình; (b) policy mới `profiles_staff_mgmt_update` cho UPDATE cùng trường. Smoke: bgh đổi gvbm→to_truong ✅; bgh đổi →admin bị chặn ✅ (đã revert) |
| 6 | High | `openaiBaseUrl()` fallback lặng về api.openai.com ngoài allowlist | **Confirmed** | Fixed — fail-closed: URL không parse được / không HTTPS (trừ localhost) / host ngoài `AI_ALLOWED_ENDPOINTS` → throw `ai_endpoint_*`; không còn silent fallback |
| 7 | Cond-High | Material INSERT bypass workflow | **Confirmed trên prod** (`tvc_mat_owner` WITH CHECK chỉ `author_id=auth.uid()`) | Fixed — `trg_tvc_material_guard` nay là `before insert or update`; INSERT non-RPC ép `author_id=auth.uid()`, `status='personal'`, `review_note=null`, school=actor school (khác trường → raise). Smoke: insert published+forged note → personal/null ✅; cross-school → raise ✅ |
| 8 | Med | `maxTotalMs` không bound sequential calls/retries | **Confirmed** | Fixed — deadline truyền vào `timeoutMs=min(perCall, remaining)` mỗi call; kết quả về sau deadline bị reject; `generateDoc` dùng 1 budget 105s cho cả 2 attempt (không reset 70s/lần) |
| 9 | Med | Race winner chỉ check JSON-parseable (`{}` thắng) | **Confirmed** | Fixed — winner predicate = extractJson + isDocContent + tool validator trong `generateDoc` |
| 10 | Med | SSR ordering ≠ keyset ordering → mất rows bulk-insert | **Confirmed** | Fixed — SSR `/studio/questions` thêm `.order("id", desc)` khớp keyset |
| 11 | Med | Sửa KHBD default → cửa sổ mất default | **Confirmed** | Fixed — update không ghi `is_default=false` nữa (preserve); default chỉ đổi qua RPC atomic |
| 12 | Med | Exam candidate cap 5000 chung → cell chết đói + lỗi DB bị nuốt | **Confirmed** | Fixed — fetch theo từng standard (cap 300/standard, batch 8 song song), dedupe theo id; lỗi fetch → 500 rõ ràng thay vì `[THIẾU CÂU HỎI]` giả |

Phụ: `review_material` decision=NULL lọt allowlist → `decision is null or not in (...)` (nằm trong migration).

## Artifacts thay đổi

- `supabase/migrations/20261119_r2_security_fixes.sql` (applied lên prod 5 chunks, verified bằng JWT-claims smoke tests)
- `src/lib/ai.ts`, `src/lib/tvc/ai-json.ts`, `src/lib/tvc/actions.ts`, `src/app/(app)/studio/questions/page.tsx`, `src/app/api/studio/tools/[code]/generate/route.ts`
- Hotfix giữa chừng round: `5d3d35c` — vá `malformed array literal "admin"` trong `scn_sync_period_attendance` (pattern `any((select …))` của r16)

## Gates

- typecheck ✅ / lint 0 errors ✅ / `check-consistency` ✅ / build 126 pages ✅
- Studio E2E: chạy lại sau deploy (xem `docs/qa/studio-e2e-*.json`)
- Deferred từ r1 giữ nguyên (org-scoped `scn_is_dept`, AI PII/quota infra, gradebook stale-write, TT22 provisional, parent-digest outbox, check-consistency prod-size timeout).

## Tiếp theo

Deploy → submit **Codex r3** re-verify toàn bộ trên HEAD mới.
