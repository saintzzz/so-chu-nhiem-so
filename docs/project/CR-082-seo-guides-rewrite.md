# CR-082: SEO guides trên sochunhiem.vieschool.com/guides qua rewrite

## Thay đổi
- `next.config.ts`: thêm `rewrites()` (`beforeFiles`) map
  - `/guides` → `https://vieschool-content.vercel.app/scn/guides`
  - `/guides/:path*` → `https://vieschool-content.vercel.app/scn/guides/:path*`
  - `/guides-indexnow-key.txt` → key file cho IndexNow
- `src/proxy.ts`: exempt `pathname.startsWith("/guides")` khỏi auth redirect.
  Proxy chạy TRƯỚC rewrites trong routing order - nếu không exempt, mọi
  request anonymous vào /guides bị redirect /login trước khi rewrite kịp chạy.
  Khi `user` có session, path /guides cũng bỏ qua header `noindex` (CR-054 chỉ
  áp cho route nghiệp vụ).
- `vercel.json`: giữ nguyên header CSP riêng cho `/guides/:path*` mở
  `style-src`/`font-src` tới fonts.googleapis.com / fonts.gstatic.com (trang
  guide dùng web font Be Vietnam Pro + Fraunces). Bỏ block `rewrites` -
  Next.js chỉ áp rewrites qua next.config.

## Lý do
Chương trình SEO-marketing VieSchool (theo mô hình fasttrack.vieschool.com):
content editorial tiếng Việt serve trên chính domain sản phẩm để SEO equity
cộng vào sochunhiem.vieschool.com. Code content nằm ở repo riêng
`saintzzz/vieschool-content` - marketing churn không chạm build app.

## Impact assessment
- **Routes app:** không đổi - `/guides/*` chưa tồn tại trong App Router,
  rewrite chỉ bắt path mới.
- **RBAC:** guides là trang marketing public do CR này phê duyệt - proxy chỉ
  mở đúng prefix `/guides`, mọi route `/app/*`, `/(app)`, API nghiệp vụ vẫn
  default-deny qua guard hiện hữu + `requireRoles` ở server.
- **CSP:** scope nới lỏng CHỈ trên `/guides/*` (font + style), các route app
  giữ CSP hiện tại nguyên bản.
- **Security:** destination là project Vercel cùng team, static HTML. Proxy
  exemption không leak data vì destination là public content.
- **Rollback:** xóa rewrites + exemption, push → guides về /login như cũ.

## Estimate
1 commit; chạm `next.config.ts`, `src/proxy.ts`, `vercel.json`.
