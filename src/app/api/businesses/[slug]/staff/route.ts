
import { z } from "zod";

import { currentAccount } from "@/lib/auth/server";
import { admin, findUserByEmail } from "@/lib/accounts";
import { origin as publicOrigin, sameOrigin } from "@/lib/origin";

import {
  getBusinessPlan,
  type BusinessPlan,
} from "@/lib/business-plan-access";

// ==========================================
// TODAVÍA HAY
// GESTIÓN DE PERSONAL
// PROTECCIÓN POR PLAN Y POR ROL
// ==========================================
//
// BASIC:
// - Solo propietario.
// - Sin invitaciones de empleados.
//
// MEDIUM:
// - Propietario.
// - Encargados y meseros.
//
// PLUS:
// - Propietario.
// - Encargados, meseros y cocina.
//
// IMPORTANTE:
// Cambiar de plan NO elimina usuarios
// ni registros de business_members.
// ==========================================

// ==========================================
// VALIDACIÓN DE DATOS
// ==========================================

const InviteSchema = z.object({
  email: z.email().trim().max(254),

  role: z.enum([
    "manager",
    "waiter",
    "kitchen",
  ]),
});

const RemoveSchema = z.object({
  userId: z.uuid(),
});

type StaffRole = z.infer<
  typeof InviteSchema
>["role"];

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

// ==========================================
// VERIFICAR PROPIETARIO
// ==========================================

async function ownerBusiness(slug: string) {
  const me = await currentAccount();

  if (!me) {
    return null;
  }

  const db = admin();

  const {
    data: business,
    error: businessError,
  } = await db
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (businessError) {
    throw new Error(
      "No se pudo consultar el negocio.",
    );
  }

  if (!business) {
    return null;
  }

  const {
    data: membership,
    error: memberError,
  } = await db
    .from("business_members")
    .select("role")
    .eq("business_id", business.id)
    .eq("user_id", me.id)
    .eq("role", "owner")
    .maybeSingle();

  if (memberError) {
    throw new Error(
      "No se pudieron verificar los permisos.",
    );
  }

  if (!membership) {
    return null;
  }

  return {
    businessId: business.id as string,
    ownerId: me.id as string,
  };
}

// ==========================================
// VERIFICAR ORIGEN DE SOLICITUD
// ==========================================

function trustedOrigin(request: Request) {
  return sameOrigin(request);
}

// ==========================================
// FUNCIONES PERMITIDAS POR PLAN
// ==========================================

function canManageEmployees(
  plan: BusinessPlan,
): boolean {
  return (
    plan === "medium" ||
    plan === "plus"
  );
}

function canInviteRole(
  plan: BusinessPlan,
  role: StaffRole,
): boolean {
  // En Básico no se puede invitar
  // ningún tipo de empleado.
  if (plan === "basic") {
    return false;
  }

  // Cocina es exclusiva de Plus.
  if (role === "kitchen") {
    return plan === "plus";
  }

  // Manager y waiter:
  // Medium y Plus.
  return (
    plan === "medium" ||
    plan === "plus"
  );
}

// ==========================================
// RESPUESTAS DE PLAN
// ==========================================

function planRequiredResponse(
  feature: "employees" | "kitchen",
) {
  if (feature === "kitchen") {
    return Response.json(
      {
        error:
          "El personal de cocina está disponible únicamente en el plan Plus.",
        code: "PLUS_REQUIRED",
        requiredPlan: "plus",
      },
      { status: 403 },
    );
  }

  return Response.json(
    {
      error:
        "La gestión de empleados está disponible en los planes Medium y Plus.",
      code: "UPGRADE_REQUIRED",
      requiredPlan: "medium",
    },
    { status: 403 },
  );
}

// ==========================================
// VINCULAR UNA CUENTA QUE YA EXISTE
// ==========================================

async function linkExisting(
  businessId: string,
  userId: string,
  role: StaffRole,
  plan: BusinessPlan,
) {
  const db = admin();

  const {
    data: current,
    error: readError,
  } = await db
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    console.error(
      "Error leyendo personal:",
      readError.message,
    );

    return Response.json(
      {
        error:
          "No se pudo asignar el empleado. Intenta otra vez.",
      },
      { status: 500 },
    );
  }

  if (current?.role === "owner") {
    return Response.json(
      {
        error:
          "Ese correo es del propietario del negocio.",
      },
      { status: 409 },
    );
  }

  const { error } = current
    ? await db
        .from("business_members")
        .update({ role })
        .eq("business_id", businessId)
        .eq("user_id", userId)
    : await db
        .from("business_members")
        .insert({
          business_id: businessId,
          user_id: userId,
          role,
        });

  if (error) {
    console.error(
      "Error asociando cuenta existente:",
      error.message,
    );

    return Response.json(
      {
        error:
          "No se pudo asignar el empleado. Intenta otra vez.",
      },
      { status: 500 },
    );
  }

  return Response.json(
    {
      ok: true,
      linked: true,
      message: current
        ? "Ese empleado ya estaba registrado: se actualizó su perfil."
        : "Ese correo ya tenía cuenta: se agregó al negocio. Puede entrar con su correo y contraseña de siempre, en Mi panel.",
      plan,
      role,
    },
    { status: current ? 200 : 201 },
  );
}

// ==========================================
// POST: INVITAR EMPLEADO
// ==========================================

export async function POST(
  request: Request,
  ctx: RouteContext,
) {
  // 1. Validar origen.
  if (!trustedOrigin(request)) {
    return Response.json(
      {
        error: "Origen no autorizado",
      },
      { status: 403 },
    );
  }

  const { slug } = await ctx.params;

  // 2. Verificar propietario.
  let access: Awaited<
    ReturnType<typeof ownerBusiness>
  >;

  try {
    access = await ownerBusiness(slug);
  } catch (error) {
    console.error(
      "Error verificando propietario:",
      error,
    );

    return Response.json(
      {
        error:
          "No se pudieron verificar los permisos.",
      },
      { status: 500 },
    );
  }

  if (!access) {
    return Response.json(
      {
        error:
          "Solo el propietario puede invitar empleados.",
      },
      { status: 403 },
    );
  }

  // 3. Comprobar plan contratado.
  let plan: BusinessPlan;

  try {
    plan = await getBusinessPlan(slug);
  } catch (error) {
    console.error(
      "Error verificando plan:",
      error,
    );

    return Response.json(
      {
        error:
          "No se pudo comprobar el plan contratado.",
      },
      { status: 500 },
    );
  }

  // No permitir invitaciones en Básico.
  if (!canManageEmployees(plan)) {
    return planRequiredResponse("employees");
  }

  // 4. Validar correo y rol.
  const input = InviteSchema.safeParse(
    await request.json().catch(
      () => null,
    ),
  );

  if (!input.success) {
    return Response.json(
      {
        error:
          "Correo o perfil no válido.",
      },
      { status: 400 },
    );
  }

  const db = admin();

  const email =
    input.data.email.trim().toLowerCase();

  const role = input.data.role;

  // 5. Validar rol según el plan.
  if (!canInviteRole(plan, role)) {
    return planRequiredResponse(
      role === "kitchen"
        ? "kitchen"
        : "employees",
    );
  }

  // ========================================
  // ¿EL CORREO YA TIENE CUENTA?
  // ========================================
  //
  // Si ya existe (por ejemplo, ya era cliente
  // o trabaja en otro negocio), no se manda
  // invitación: se le da acceso directo y
  // entra con su correo y contraseña de siempre.

  let existingId: string | null;

  try {
    // Una invitación que nunca se aceptó no cuenta
    // como cuenta: se le vuelve a mandar.
    const existing = await findUserByEmail(email);
    existingId = existing?.confirmed ? existing.id : null;
    if (existing && !existing.confirmed) {
      await db
        .from("business_members")
        .delete()
        .eq("business_id", access.businessId)
        .eq("user_id", existing.id);
    }
  } catch (error) {
    console.error(
      "Error buscando cuenta:",
      error instanceof Error ? error.message : error,
    );

    return Response.json(
      {
        error:
          "No se pudo revisar si el correo ya tiene cuenta. Intenta otra vez.",
      },
      { status: 500 },
    );
  }

  if (existingId) {
    return linkExisting(
      access.businessId,
      existingId,
      role,
      plan,
    );
  }

  // ========================================
  // ENVIAR INVITACIÓN
  // ========================================

  const redirectTo =
    `${publicOrigin(request)}` +
    "/es/aceptar-invitacion?next=" +
    encodeURIComponent("/es/empleado");

  const {
    data,
    error: inviteError,
  } = await db.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo,
      data: {
        invited_role: role,
        invited_business: slug,
      },
    },
  );

  if (inviteError || !data.user) {
    const alreadyExists =
      /already|registered|exists/i.test(
        inviteError?.message ?? "",
      );

    console.error(
      "Error invitando empleado:",
      inviteError?.message,
    );

    return Response.json(
      {
        error: alreadyExists
          ? "Este correo ya tiene cuenta, pero no se pudo vincular. Intenta otra vez."
          : "No se pudo enviar la invitación. Revisa la configuración de correo de Supabase.",
      },
      {
        status: alreadyExists
          ? 409
          : 502,
      },
    );
  }

  // ========================================
  // ASIGNAR EMPLEADO AL NEGOCIO
  // ========================================

  const {
    error: memberError,
  } = await db
    .from("business_members")
    .insert({
      business_id: access.businessId,
      user_id: data.user.id,
      role,
    });

  if (memberError) {
    console.error(
      "Error asociando empleado:",
      memberError.message,
    );

    return Response.json(
      {
        error:
          "Se creó la invitación, pero no se pudo asignar el empleado al negocio. Requiere revisión antes de reenviar.",
      },
      { status: 500 },
    );
  }

  return Response.json(
    {
      ok: true,
      message:
        "Invitación enviada. El empleado debe revisar su correo.",
      plan,
      role,
    },
    { status: 201 },
  );
}

// ==========================================
// DELETE: QUITAR ACCESO A EMPLEADO
// ==========================================
//
// Esto es una baja de personal solicitada
// por el dueño, no un cambio de plan.
//
// Al bajar de Medium a Básico:
// NO se ejecuta esta función.
// Los empleados permanecen registrados.
// ==========================================

export async function DELETE(
  request: Request,
  ctx: RouteContext,
) {
  // 1. Validar origen.
  if (!trustedOrigin(request)) {
    return Response.json(
      {
        error: "Origen no autorizado",
      },
      { status: 403 },
    );
  }

  const { slug } = await ctx.params;

  // 2. Verificar propietario.
  let access: Awaited<
    ReturnType<typeof ownerBusiness>
  >;

  try {
    access = await ownerBusiness(slug);
  } catch (error) {
    console.error(
      "Error verificando propietario:",
      error,
    );

    return Response.json(
      {
        error:
          "No se pudieron verificar los permisos.",
      },
      { status: 500 },
    );
  }

  if (!access) {
    return Response.json(
      {
        error:
          "Solo el propietario puede administrar empleados.",
      },
      { status: 403 },
    );
  }

  // 3. Comprobar el plan.
  let plan: BusinessPlan;

  try {
    plan = await getBusinessPlan(slug);
  } catch (error) {
    console.error(
      "Error verificando plan:",
      error,
    );

    return Response.json(
      {
        error:
          "No se pudo comprobar el plan contratado.",
      },
      { status: 500 },
    );
  }

  // Bloquear gestión en Básico.
  if (!canManageEmployees(plan)) {
    return planRequiredResponse("employees");
  }

  // 4. Validar usuario.
  const input = RemoveSchema.safeParse(
    await request.json().catch(
      () => null,
    ),
  );

  if (!input.success) {
    return Response.json(
      {
        error: "Usuario inválido.",
      },
      { status: 400 },
    );
  }

  const db = admin();

  // ========================================
  // CONSULTAR EMPLEADO
  // ========================================

  const {
    data: member,
    error: lookupError,
  } = await db
    .from("business_members")
    .select("role")
    .eq(
      "business_id",
      access.businessId,
    )
    .eq(
      "user_id",
      input.data.userId,
    )
    .maybeSingle();

  if (lookupError) {
    return Response.json(
      {
        error:
          "No se pudo consultar al empleado.",
      },
      { status: 500 },
    );
  }

  if (!member) {
    return Response.json(
      {
        error:
          "Empleado no encontrado.",
      },
      { status: 404 },
    );
  }

  // ========================================
  // PROTEGER PROPIETARIOS
  // ========================================

  if (member.role === "owner") {
    return Response.json(
      {
        error:
          "No puedes eliminar al propietario.",
      },
      { status: 403 },
    );
  }

  // ========================================
  // REVOCAR ACCESO DE EMPLEADO
  // ========================================

  const { error } = await db
    .from("business_members")
    .delete()
    .eq(
      "business_id",
      access.businessId,
    )
    .eq(
      "user_id",
      input.data.userId,
    )
    .neq("role", "owner");

  if (error) {
    console.error(
      "Error quitando empleado:",
      error.message,
    );

    return Response.json(
      {
        error:
          "No se pudo quitar al empleado.",
      },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    message:
      "Se retiró el acceso del empleado al negocio.",
  });
}
