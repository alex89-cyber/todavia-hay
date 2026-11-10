import { NextResponse } from "next/server";
import { safeNext } from "@/lib/auth/config";
import { supabaseServer } from "@/lib/auth/server";
import { origin } from "@/lib/origin";
import { HOLDS_COOKIE } from "@/lib/stall";

export async function POST(request: Request) {
  const url = new URL(request.url);
  await (await supabaseServer()).auth.signOut();
  // En Render request.url es localhost: el destino usa el origen público.
  const response = NextResponse.redirect(
    new URL(safeNext(url.searchParams.get("next"), "/es"), origin(request)),
    { status: 303 },
  );
  // Los apartados guardados en este celular no pasan a la siguiente cuenta.
  response.cookies.delete(HOLDS_COOKIE);
  return response;
}
