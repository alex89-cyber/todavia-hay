import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { admin, findUserIdByEmail, getProfile, saveProfile } from "@/lib/accounts";
import { authEnabled } from "@/lib/auth/config";
import { supabaseServer } from "@/lib/auth/server";
import { DEMO_ACCOUNTS, DEMO_ROLES, type DemoRole, demoLanding, demoSlug } from "@/lib/demo";
import { origin, sameOrigin } from "@/lib/origin";

// POST /api/demo (formulario: role, lang)
// Entra a la demo pública con la cuenta fija de ese rol.
// Crea la cuenta y su lugar en el negocio la primera vez.
export async function POST(request: Request) {
  const site = origin(request);
  const form = await request.formData().catch(() => null);
  const role = String(form?.get("role") ?? "") as DemoRole;
  const lang = form?.get("lang") === "en" ? "en" : "es";
  const slug = demoSlug();

  if (!slug || !authEnabled() || !DEMO_ROLES.includes(role) || !sameOrigin(request)) {
    return NextResponse.redirect(new URL(`/${lang}`, site), 303);
  }

  try {
    const db = admin();
    const account = DEMO_ACCOUNTS[role];

    const { data: business, error: bErr } = await db.from("businesses").select("id").eq("slug", slug).maybeSingle();
    if (bErr || !business) throw new Error(`demo: no existe el negocio ${slug}`);

    // 1. La cuenta (sin correo real; ya confirmada).
    let userId = await findUserIdByEmail(account.email);
    if (!userId) {
      const created = await db.auth.admin.createUser({
        email: account.email,
        email_confirm: true,
        password: randomBytes(24).toString("base64url"),
        user_metadata: { demo: true },
      });
      if (created.error || !created.data.user) throw new Error(`demo: crear cuenta: ${created.error?.message}`);
      userId = created.data.user.id;
    }
    if (!(await getProfile(userId))) {
      await saveProfile(userId, { firstName: account.firstName, lastName: account.lastName, phone: null });
    }

    // 2. Su lugar en el negocio de prueba.
    if (account.member) {
      const m = await db
        .from("business_members")
        .upsert({ business_id: business.id, user_id: userId, role: account.member });
      if (m.error) throw new Error(`demo: miembro: ${m.error.message}`);
    }

    // 3. Iniciar sesión sin contraseña: enlace mágico que se usa aquí mismo.
    const link = await db.auth.admin.generateLink({ type: "magiclink", email: account.email });
    const tokenHash = link.data?.properties?.hashed_token;
    if (link.error || !tokenHash) throw new Error(`demo: enlace: ${link.error?.message}`);

    const sb = await supabaseServer();
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (error) throw new Error(`demo: sesión: ${error.message}`);

    return NextResponse.redirect(new URL(demoLanding(role, lang, slug), site), 303);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return NextResponse.redirect(new URL(`/${lang}?demo=error#demo`, site), 303);
  }
}
