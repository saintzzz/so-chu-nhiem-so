# External Review - CR-066 thu_vien

## Round 1 (reviewer-gpt) - REJECT: 2H + 5M + 1L

| # | Finding | Triage | Fix |
|---|---|---|---|
| 1 | lib_checkout doi copy truoc khi validate borrower | confirmed | 216eb5e - reorder: validate -> lock -> insert |
| 2 | lib_return update copy thieu school/on_loan predicate | confirmed | 216eb5e - where school_id + status='on_loan' + copy_state_conflict |
| 3 | mutating RPC con default PUBLIC execute | confirmed | 216eb5e - revoke public,anon -> grant authenticated |
| 4 | read policies thieu module flag | confirmed | 216eb5e - lib_module_enabled trong ca 3 read policies |
| 5 | lib_books direct write khong co CHECK | partial | 216eb5e - giu RLS write (intentional) + CHECK title/price/year |
| 6 | loans.copy_id FK mo ho khi cascade | confirmed | 216eb5e - on delete restrict |
| 7 | pickers loans page khong scope school | confirmed | 216eb5e - classes/students/profiles .eq school_id |
| 8 | "&" separator vi convention | not-confirmed | & va · la sibling convention khac app |

## Round 2 - APPROVE (0 findings)

Live-verified: happy path, bad-borrower rollback, module_off -> 0 rows PostgREST, anon -> permission denied.
Commits: 2a32ffb (impl) + 216eb5e (r1 fixes). Deploy: auto via master.
