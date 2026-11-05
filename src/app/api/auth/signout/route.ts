import { NextResponse } from "next/server";
import { safeNext } from "@/lib/auth/config";
import { supabaseServer } from "@/lib/auth/server";

export async function POST(request: Request) {
  const url = new URL(request.url);
  await (await supabaseServer()).auth.signOut();
  return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next"), "/es"), url.origin), { status: 303 });
}
