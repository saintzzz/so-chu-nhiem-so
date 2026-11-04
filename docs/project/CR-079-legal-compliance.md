# CR-079 - Legal compliance fixes (audit 2026-11-05)

- Ngay: 2026-11-05
- Loai: CR compliance - UI copy + trang public + tai lieu phap ly
- Nguon: `docs/legal/AUDIT-PHAP-LY-2026-11-05.md` muc 1,4,6 va tiep nhan 2,3,8

## Pham vi

1. Trang public `/legal/privacy` + `/legal/terms` (noi dung Luat 91/2025 + ND13) + footer link tai `/login`.
2. Doi nhan "ky so" -> "ky xac thuc he thong" trong hoc ba (nav + exports board) - tranh hieu nham chu ky so ND130.
3. `docs/project/DPIA-v2-2026-11.md` - cover them y_te_bhyt, camera, billing, trial tenant.
4. `docs/runbook/DATA-BREACH-72H.md` - quy trinh thong bao ro ri 72h.
5. `docs/legal/DPA-PROVIDERS-GUIDE.md` + `docs/legal/HO-SO-CHUYEN-DU-LIEU.md` - huong dan ky DPA tung provider + khung ho so chuyen du lieu nuoc ngoai.

## Impact

- Route public moi khong can role guard (public pages, khong query du lieu).
- UI copy: nav label doi -> phai khop ten section. Khong cham logic/RLS.
- Tai lieu: ho tro phap che khi truong/So hoi.
