import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AUTH_KEY, AUTH_URL, authEnabled } from "./lib/auth/config";

const locales = ["es", "en"];

// Sends /birria-dona-lupe to /es/birria-dona-lupe (or /en/... for English browsers),
// and keeps the Supabase session fresh: pages can read it but not rewrite cookies.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) {
    const preferred = request.headers.get("accept-language")?.toLowerCase() ?? "";
    const locale = preferred.startsWith("en") ? "en" : "es";
    request.nextUrl.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(request.nextUrl);
  }

  if (!authEnabled()) return;
  // Only when there is a session to refresh, so anonymous visits stay cheap.
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return;

  let response = NextResponse.next({ request });
  const sb = createServerClient(AUTH_URL, AUTH_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await sb.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
