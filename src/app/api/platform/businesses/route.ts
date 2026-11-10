import { z } from "zod";

import { admin, findUserIdByEmail } from "@/lib/accounts";
import { origin as publicOrigin, sameOrigin } from "@/lib/origin";
import { platformAdmin } from "@/lib/platform-admin";

// ==========================================
// TODAVÍA HAY
// ALTA DE NEGOCIOS DESDE EL PORTAL DE SOCIOS
// ==========================================
//
// Un socio crea el negocio y escribe el correo
// del dueño. Si el correo no tiene cuenta, le
// llega una invitación para poner su contraseña
// y entra directo a su panel. Si ya tiene cuenta,
// solo se le da acceso al negocio nuevo.
// ==========================================

const NewBusiness = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,60}$/),
  plan: z.enum(["basic", "medium", "plus"]),
  ownerEmail: z.string().trim().toLowerCase().email().max(200),
  ownerFirstName: z.string().trim().max(60).optional(),
  ownerLastName: z.string().trim().max(60).optional(),
});

function fail(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return fail("Origen no autorizado", 403);
  }

  const account = await platformAdmin();
  if (!account) {
    return fail("Solo los socios autorizados pueden crear negocios", 403);
  }

  const input = NewBusiness.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return fail(
      "Revisa los datos: nombre, dirección (solo minúsculas, números y guiones, 3 a 60) y correo del dueño.",
      400,
    );
  }
  const { name, slug, plan, ownerEmail, ownerFirstName, ownerLastName } = input.data;
  const db = admin();

  // 1. La dirección del negocio debe estar libre.
  const { data: taken, error: takenError } = await db
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (takenError) {
    console.error("Alta de negocio:", takenError.message);
    return fail("No se pudo revisar la dirección del negocio", 500);
  }
  if (taken) {
    return fail(`Ya existe un negocio con la dirección "${slug}"`, 409);
  }

  // 2. Crear el negocio (cerrado, sin dueño todavía).
  const { data: business, error: businessError } = await db
    .from("businesses")
    .insert({ name, slug, plan, owner_id: null, is_open: false })
    .select("id")
    .single();
  if (businessError || !business) {
    console.error("Alta de negocio:", businessError?.message);
    return fail("No se pudo crear el negocio", 500);
  }

  // Si algo falla después, el negocio no se queda a medias.
  const undo = async () => {
    const { error } = await db.from("businesses").delete().eq("id", business.id);
    if (error) console.error("Alta de negocio, no se pudo deshacer:", error.message);
  };

  // 3. Dueño: invitar o, si ya tiene cuenta, solo dar acceso.
  const panel = `/es/panel/${slug}`;
  let userId: string | null = null;
  let invited = false;
  try {
    userId = await findUserIdByEmail(ownerEmail);
    if (!userId) {
      const { data, error } = await db.auth.admin.inviteUserByEmail(ownerEmail, {
        redirectTo: `${publicOrigin(request)}/api/auth/callback?next=${encodeURIComponent(panel)}`,
        data: {
          next: panel,
          lang: "es",
          invited_role: "owner",
          invited_business: slug,
          ...(ownerFirstName ? { first_name: ownerFirstName } : {}),
          ...(ownerLastName ? { last_name: ownerLastName } : {}),
        },
      });
      if (error || !data.user) throw new Error(error?.message ?? "sin usuario");
      userId = data.user.id;
      invited = true;
    }
  } catch (error) {
    console.error("Alta de negocio, invitación:", error);
    await undo();
    return fail(
      "No se pudo enviar la invitación al dueño. Revisa el correo y la configuración de correos (SMTP) de Supabase.",
      502,
    );
  }

  const { error: memberError } = await db
    .from("business_members")
    .upsert(
      { business_id: business.id, user_id: userId, role: "owner" },
      { onConflict: "business_id,user_id" },
    );
  if (memberError) {
    console.error("Alta de negocio, dueño:", memberError.message);
    await undo();
    return fail("Se creó la cuenta del dueño, pero no se pudo ligar al negocio. Intenta de nuevo.", 500);
  }

  // owner_id se conserva por compatibilidad con las primeras migraciones.
  await db.from("businesses").update({ owner_id: userId }).eq("id", business.id);

  return Response.json(
    {
      ok: true,
      business: { id: business.id, name, slug, plan },
      message: invited
        ? `Negocio creado. Le llegó una invitación a ${ownerEmail} para poner su contraseña y entrar a su panel.`
        : `Negocio creado. ${ownerEmail} ya tenía cuenta: al entrar verá el negocio nuevo en su panel.`,
    },
    { status: 201 },
  );
}
