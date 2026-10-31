# CR-082: SEO guides trên sochunhiem.vieschool.com/guides qua rewrite

## Thay đổi
Thêm `rewrites` vào `vercel.json`:
- `/guides/:path*` → `https://vieschool-content.vercel.app/scn/guides/:path*`
- `/guides-indexnow-key.txt` → key file cho IndexNow

Thêm header `Content-Security-Policy` riêng cho `/guides/:path*` mở `style-src`/
`font-src` tới fonts.googleapis.com / fonts.gstatic.com (trang guide dùng web
font Be Vietnam Pro + Fraunces).

## Lý do
Chương trình SEO-marketing VieSchool (theo mô hình fasttrack.vieschool.com):
content editorial tiếng Việt serve trên chính domain sản phẩm để SEO equity cộng
vào sochunhiem.vieschool.com. Code content nằm ở repo riêng
`saintzzz/vieschool-content` - marketing churn không chạm build app.

## Impact assessment
- **Routes app:** không đổi - `/guides/*` chưa tồn tại trong App Router, rewrite
  chỉ bắt path mới.
- **RBAC:** guides là trang marketing public - không chạm auth, `requireRoles`,
  hay bất kỳ route nghiệp vụ nào. `/(app)` guards nguyên vẹn.
- **CSP:** scope nới lỏng CHỈ trên `/guides/*` (font + style), các route app giữ
  CSP hiện tại nguyên bản.
- **Security:** destination là project Vercel cùng team, static HTML.
- **Rollback:** xóa rewrite + header block, push → guides 404 ngay.

## Estimate
1 commit, không chạm src/.
