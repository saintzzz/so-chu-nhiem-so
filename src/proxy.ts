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
  // Public API: devin-callback co callback_token rieng, cron routes co
  // CRON_SECRET, webhooks co svix signature (RESEND_WEBHOOK_SECRET).
  const isPublicApi =
    pathname === "/api/ai/devin-callback" ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/webhooks/");

  // redirect giu nguyen cookie da refresh (ke ca cookie xoa session)
  const redirectWithCookies = (url: URL) => {
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user && !isLogin && !isPublicApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return redirectWithCookies(url);
  }
  if (!user && isPublicApi) {
    return response;
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return redirectWithCookies(url);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
