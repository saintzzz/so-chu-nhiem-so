# CR-112: SEO discovery fixes (robots.txt, sitemap, crawl path)

## What
1. `src/proxy.ts`: `/robots.txt` va `/sitemap.xml` public (truoc day
   `/robots.txt` redirect sang `/login` - Googlebot khong doc duoc).
2. `public/robots.txt`: them `Sitemap:` directive tro toi
   `/guides/sitemap.xml`.
3. `next.config.ts`: rewrite `/sitemap.xml` -> sitemap cua guides tren
   vieschool-content.
4. `src/app/login/page.tsx`: them `<a href="/guides">` tren trang public
   duy nhat - tao crawl path tu trang da duoc Google crawl toi hub guides.

## Why
GSC URL Inspection bao 3/4 guide URL o trang thai "URL is unknown to
Google" (chua duoc crawl). Nguyen nhan: khong co discovery path -
robots.txt bi redirect, khong co Sitemap directive, khong co internal
link nao tu trang public toi /guides. John Mueller (Google): link
prominently tu trang da crawl la cach uu tien crawl/index nhanh nhat.

## Security impact
Chi mo them 2 path tinh khong nhay cam (`/robots.txt`, `/sitemap.xml`).
Matcher van tuong minh - khong dung startsWith rong.

## Scope
- proxy.ts: +3 dong public-path
- robots.txt: +Sitemap directive
- next.config.ts: +1 rewrite
- login/page.tsx: +1 anchor
