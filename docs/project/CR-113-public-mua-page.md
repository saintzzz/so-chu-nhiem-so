# CR-113: Public /mua checkout page (Tier 0)

## What
- `src/proxy.ts`: `/mua` public (trang ban hang, rewrite sang
  vieschool-content) - truoc day redirect /login.
- `next.config.ts`: rewrite `/mua` -> vieschool-content/scn/mua.
- Content: `scn/mua/index.html` trong repo vieschool-content - bang gia
  goi gv 49k/thang, 299k/nam hoc + VietQR TPBank.

## Why
Can checkout truoc khi day traffic - khong co trang mua thi SEO/marketing
do vao trong. Tier 0: VietQR + kick hoat thu cong, 0 phi van hanh.
Tier 1 sau: SePay webhook tu dong (da co san /api/webhooks/sepay).

## Security impact
Them 1 path cong khai tinh (`/mua` exact match, khong prefix).
