# EXTERNAL REVIEW r1 - CR-082 SEO guides rewrite

Scope: `2e36efe` proxy exemption + next.config rewrites + `46d37d3` follow-up.
Reviewer: same-session manual pass (cross-model subagents unavailable - quota).
Method: cold read of full diff, live verification on prod.

## Findings

| Sev | Finding | Disposition |
|---|---|---|
| Medium | `pathname.startsWith("/guides")` overmatched - any future `/guidesXYZ` route would bypass auth redirect | FIXED in `46d37d3` - explicit match set: `/guides`, `/guides/*`, `/guides-indexnow-key.txt` |
| Low | `vercel.json` rewrites silently ignored by Next 16 (proxy runs first) | FIXED in `2e36efe` - rewrites moved to `next.config.ts`, vercel.json keeps headers only |
| Info | authed users on /guides skip `noindex` header | Intended - public content must stay indexable; crawlers hold no session anyway |

## Verified live (Playwright)

- `/guides` + 3 guide pages: 200, canonical on `sochunhiem.vieschool.com`
- `/guides/sitemap.xml`: 200, 4 product-domain URLs
- `/guides-indexnow-key.txt`: 200, key served
- Auth routes still redirect to /login; `check-consistency.mjs` PASS; preflight PASS
