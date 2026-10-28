# External Review - CR-068 xet_tot_nghiep
## r1 (reviewer-gpt) REJECT: 1H -> 876b453
1. tn_finalize ghi de override thu cong khi decision='pending' ma decided_by
   da set -> 'pending' qua tn_set_decision = huy override (xoa decided_*);
   finalize chi tinh lai dong pending co decided_by is null.
## r2 - APPROVE (0 findings)
Live-verified 18/18: 107 HS seed khoi 9, dup campaign chan, gvbm deny,
gvcn ngoai lop deny, eligible recompute theo exam, override preserved,
finalize 1 graduated + 106 rejected + history + notify, module-off chan
read+RPC, campaign_closed chan moi thao tac.
Commits: 8b02e89 + 876b453.
