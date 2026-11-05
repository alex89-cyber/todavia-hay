import { NextResponse, type NextRequest } from "next/server";

const locales = ["es", "en"];

// Sends /birria-dona-lupe to /es/birria-dona-lupe (or /en/... for English browsers).
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;

  const preferred = request.headers.get("accept-language")?.toLowerCase() ?? "";
  const locale = preferred.startsWith("en") ? "en" : "es";
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
