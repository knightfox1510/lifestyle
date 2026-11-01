import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /api/cron and /api/ingest authenticate themselves (CRON_SECRET / per-user tokens).
const PUBLIC_PATHS = ["/login", "/auth", "/offline", "/api/cron", "/api/ingest", "/setup-keys.html"];

/** Refreshes the Supabase session cookie and gates private routes. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // getClaims() validates the JWT; do not run code between client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!signedIn && !isPublic) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Keep the query string (e.g. invite ?code=…) so it survives sign-in. A
    // signed-out form post goes back to its page (not the endpoint), and 303
    // turns the POST into a normal GET of the login page.
    const isPost = request.method !== "GET" && request.method !== "HEAD";
    const target = isPost ? (path.startsWith("/onboarding/") ? "/onboarding" : "/") : path + request.nextUrl.search;
    url.search = target === "/" ? "" : `?next=${encodeURIComponent(target)}`;
    return NextResponse.redirect(url, isPost ? 303 : 307);
  }

  if (signedIn && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
