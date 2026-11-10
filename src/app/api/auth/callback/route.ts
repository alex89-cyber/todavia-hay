
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { safeNext } from "@/lib/auth/config";
import { supabaseServer } from "@/lib/auth/server";
import { getProfile, saveProfile } from "@/lib/accounts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  // Usar la dirección pública de Render.
  // Nunca redirigir usuarios hacia localhost interno.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    url.origin;

  const origin = new URL(siteUrl).origin;

  const next = safeNext(
    params.get("next"),
    "/es/cuenta"
  );

  const lang = next.startsWith("/en") ? "en" : "es";
  const type = params.get("type");

  // Invitación y nueva contraseña: el enlace se usa
  // hasta que la persona pone su contraseña y toca
  // el botón. Si el antivirus del correo abre el
  // enlace antes que ella, no lo gasta.
  if (
    params.get("token_hash") &&
    (type === "invite" || type === "recovery")
  ) {
    const accept = new URL(
      `/${lang}/aceptar-invitacion`,
      origin
    );
    accept.searchParams.set("token_hash", params.get("token_hash")!);
    accept.searchParams.set("type", type);
    accept.searchParams.set("next", next);
    return NextResponse.redirect(accept);
  }

  const sb = await supabaseServer();

  let valid = false;

  if (params.get("code")) {
    const { error } =
      await sb.auth.exchangeCodeForSession(
        params.get("code")!
      );

    valid = !error;
  } else if (params.get("token_hash") && type) {
    const { error } = await sb.auth.verifyOtp({
      token_hash: params.get("token_hash")!,
      type: type as EmailOtpType,
    });

    valid = !error;
  }

  if (!valid) {
    const loginUrl = new URL(
      `/${lang}/login`,
      origin
    );

    loginUrl.searchParams.set("error", "link");

    return NextResponse.redirect(loginUrl);
  }

  const { data } = await sb.auth.getUser();
  const user = data.user;

  if (user) {
    const phone =
      (user.user_metadata?.phone as string | undefined) ??
      null;

    const profile = await getProfile(user.id).catch(
      () => null
    );

    if (
      phone &&
      profile &&
      !profile.phone &&
      profile.firstName &&
      profile.lastName
    ) {
      await saveProfile(user.id, {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone,
      }).catch((error) => {
        console.error(
          "callback: phone not saved",
          error
        );
      });
    }
  }

  const destination =
    type === "invite" || type === "recovery"
      ? `/${lang}/nueva-contrasena?next=${encodeURIComponent(next)}`
      : next;

  return NextResponse.redirect(
    new URL(destination, origin)
  );
}
