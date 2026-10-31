import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Optimistic auth check (Next.js 16 Proxy - replaces middleware).
 * Real authorization is enforced by Server Components + RLS.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // cap nhat request.cookies de Server Components doc session moi
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub
    ? { id: claimsData.claims.sub }
    : null;

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  // CR-082: noi dung SEO cong khai tren /guides* (rewrite sang
  // vieschool-content trong next.config). Prefix match bao gom ca
  // /guides-indexnow-key.txt o root.
  const isPublicGuides =
    pathname === "/guides" ||
    pathname.startsWith("/guides/") ||
    pathname === "/guides-indexnow-key.txt";
  // CR-112: robots.txt + sitemap phai public de Googlebot doc duoc
  // (truoc day redirect /login -> mat kenh discovery)
  const isPublicSeoFiles =
    pathname === "/robots.txt" || pathname === "/sitemap.xml";
  // Cong tuyen sinh cong khai: trang /apply/* chi doc qua RPC definer,
  // POST /api/admissions/apply co honeypot + Turnstile + RPC kiem open.
  const isPublicApply =
    pathname === "/apply" ||
    pathname.startsWith("/apply/") ||
    pathname === "/api/admissions/apply";
  // Public API: devin-callback co callback_token rieng, cron routes co
  // CRON_SECRET, webhooks co svix signature (RESEND_WEBHOOK_SECRET).
  const isPublicApi =
    isPublicApply ||
    pathname === "/api/ai/devin-callback" ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/webhooks/");

  // redirect giu nguyen cookie da refresh (ke ca cookie xoa session)
  const redirectWithCookies = (url: URL) => {
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user && !isLogin && !isPublicApi && !isPublicGuides && !isPublicSeoFiles) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return redirectWithCookies(url);
  }
  if (!user && (isPublicGuides || isPublicSeoFiles)) {
    return response;
  }
  if (!user && isPublicApi) {
    // cong apply cong khai: khong cho indexer thu thap URL dot tuyen
    if (isPublicApply) {
      response.headers.set(
        "X-Robots-Tag",
        "noindex, nofollow, noai, noimageai",
      );
    }
    return response;
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return redirectWithCookies(url);
  }
  // CR-054: route authed khong cho indexer (crawler hop phap deu mat
  // session ngay, nhung noindex ngan data leak qua search cache/preview).
  if (user && !isPublicGuides && !isPublicSeoFiles) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noai, noimageai");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
