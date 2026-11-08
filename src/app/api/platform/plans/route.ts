
import { z } from "zod";

import { admin } from "@/lib/accounts";
import { platformAdmin } from "@/lib/platform-admin";

const PlanChange = z.object({
  businessId: z.string().uuid(),
  plan: z.enum(["basic", "medium", "plus"]),
});

export async function PATCH(request: Request) {
  // Solo solicitudes provenientes de
  // nuestra propia página web.
  const origin = request.headers.get("origin");

  if (
    !origin ||
    origin !== new URL(request.url).origin
  ) {
    return Response.json(
      { error: "Origen no autorizado" },
      { status: 403 },
    );
  }

  // La validación sucede en el servidor.
  const account = await platformAdmin();

  if (!account) {
    return Response.json(
      { error: "Solo los socios autorizados pueden cambiar planes" },
      { status: 403 },
    );
  }

  const input = PlanChange.safeParse(
    await request.json().catch(() => null),
  );

  if (!input.success) {
    return Response.json(
      { error: "Datos inválidos" },
      { status: 400 },
    );
  }

  const { error } = await admin().rpc(
    "th_change_business_plan",
    {
      p_business_id: input.data.businessId,
      p_admin_id: account.id,
      p_new_plan: input.data.plan,
    },
  );

  if (error) {
    console.error(
      "Error actualizando plan:",
      error.message,
    );

    return Response.json(
      { error: "No se pudo actualizar el plan" },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    plan: input.data.plan,
  });
}
