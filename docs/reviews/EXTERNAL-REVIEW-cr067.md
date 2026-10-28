# External Review - CR-067 bien_dong_hs
## r1 (reviewer-gpt) REJECT: 2H + 3M -> f0dcf3e
1. code seq lexicographic -> numeric max(substring::bigint) under advisory lock
2. decide update status truoc projection -> projection truoc, status sau (atomic)
3. payload dob/gender khong validate -> invalid_dob/invalid_gender o create
4. gvcn doc ca truong -> RLS: own-request + own-class; bgh/admin/so_gd all
5. table thieu overflow container -> relative overflow-x-auto
## r2 - APPROVE (0 findings)
Live-verified 16+7 checks. Commits: 7d10572 + f0dcf3e.
