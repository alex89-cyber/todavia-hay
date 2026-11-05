import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/lib/auth/config";
import { supabaseServer } from "@/lib/auth/server";
import { getProfile, saveProfile } from "@/lib/accounts";

// Where Supabase sends people back: email confirmation, invitation, password
// reset and Google. Opens the session, then goes on to `next`.
// Email links (templates in Supabase → Authentication → Emails) look like
//   {{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=email&next={{ .Data.next }}
// with type=invite (owners, next=/es/panel) and type=recovery for password resets.
// Google and in-browser flows come back with ?code=.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const p = url.searchParams;
  const next = safeNext(p.get("next"), "/es/cuenta");
  const sb = await supabaseServer();

  let ok = false;
  const type = p.get("type");
  if (p.get("code")) {
    ok = !(await sb.auth.exchangeCodeForSession(p.get("code")!)).error;
  } else if (p.get("token_hash") && type) {
    ok = !(await sb.auth.verifyOtp({ token_hash: p.get("token_hash")!, type: type as EmailOtpType })).error;
  }
  const lang = next.startsWith("/en") ? "en" : "es";
  if (!ok) return NextResponse.redirect(new URL(`/${lang}/login?next=${encodeURIComponent(next)}&error=link`, url.origin));

  const { data } = await sb.auth.getUser();
  const user = data.user;
  if (user) {
    // The phone typed at sign-up is saved now, bringing counter stamps along.
    const phone = (user.user_metadata?.phone as string | undefined) ?? null;
    const profile = await getProfile(user.id).catch(() => null);
    if (phone && profile && !profile.phone && profile.firstName && profile.lastName) {
      await saveProfile(user.id, { firstName: profile.firstName, lastName: profile.lastName, phone }).catch((e) =>
        console.error("callback: phone not saved", e),
      );
    }
  }
  const to = type === "invite" || type === "recovery" ? `/${lang}/nueva-contrasena?next=${encodeURIComponent(next)}` : next;
  return NextResponse.redirect(new URL(to, url.origin));
}
