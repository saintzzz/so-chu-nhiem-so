# CR-016: Audit sau - UI/UX cho nguoi dung giao duc + Business flow 100% + Role & Responsibility 100%

## Ly do

Sau chuoi CR-013/014/015 va 2 vong test (interaction sweep + business-flow + full coverage 45/45),
yeu cau moi: dao sau hon nua theo dung SDLC framework -

1. **UIUX thuc su de dung** cho nguoi lam giao duc (GVCN, GVBM, BGH, PH, HS) - khong chi "dung duoc"
   ma phai dung tu nhien, it click, ro rang theo tu duy nha truong.
2. **Business flow dung 100%** - moi state machine (draft->submitted->approved, pending->signed...)
   dung nghiep vu truong hoc, cross-role visibility dung.
3. **Role & responsibility dung 100%** - doi chieu TT 32/2020 Dieu le truong, TT 28/2009, TT 22/2021
   voi ROLE-MATRIX.md va implementation thuc te.

## Pham vi audit

| Tang | Noi dung | Phuong phap |
|---|---|---|
| BA | Role/responsibility matrix vs van ban phap ly + guards thuc te | Deterministic enumeration + review |
| Designer | Task-flow audit theo personas giao duc, friction points, mobile | Playwright + heuristic |
| Tester | Business-flow correctness: state machines, cross-role visibility, edge cases | E2E + DB verify |
| Security | Write-path audit: server action role check, RLS coverage, client bypass | Static analysis |

## Impact assessment

- Khong doi requirement nghiep vu - day la audit + fix chat luong.
- Findings se duoc phan loai: fix ngay (bug/UX defect) vs can confirm (quyet dinh nghiep vu).
- Estimate: 1 chu ky audit + fix theo findings.

## Quy tac

- Human-in-the-loop: moi quyet dinh nghiep vu (ai duoc quyen gi, flow nao dung) phai hoi Q&A.
- Khong bypass: moi mutation test qua UI that, verify DB sau.
