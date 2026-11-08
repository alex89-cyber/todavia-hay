
import { z } from "zod";

import {
  isOwner,
  unauthorized,
} from "@/lib/owner-auth";

import { deliver } from "@/lib/reservations";

/**
 * TODAVÍA HAY
 *
 * API para confirmar entregas y pagos.
 *
 * El negocio:
 * 1. Introduce el NIP del cliente.
 * 2. Selecciona cómo recibió el pago.
 * 3. Confirma la entrega.
 *
 * La función deliver valida el pedido
 * antes de registrar la venta.
 */

// Datos que debe enviar el panel.
const deliverySchema = z.object({
  reservationId: z.string().uuid(),

  code: z.string().optional(),

  lastName: z.string().optional(),

  method: z.enum([
    "cash",
    "card",
    "transfer",
  ]),
});

// Tipo para obtener el negocio desde la URL.
type DeliveryRouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

// Confirmar pago y entrega.
export async function POST(
  request: Request,
  context: DeliveryRouteContext,
) {
  try {
    // Obtener el negocio.
    const { slug } = await context.params;

    // Verificar que el usuario tenga acceso.
    if (!(await isOwner(slug))) {
      return unauthorized();
    }

    // Leer los datos enviados.
    const body: unknown = await request.json();

    // Validar los datos.
    const parsed = deliverySchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "invalid_data",
          message: "Datos de entrega inválidos.",
        },
        {
          status: 400,
        },
      );
    }

    const {
      reservationId,
      code,
      lastName,
      method,
    } = parsed.data;

    // Comprobar que se proporcione
    // el NIP o el apellido.
    if (!code && !lastName) {
      return Response.json(
        {
          error: "missing_proof",
          message:
            "Debes introducir el NIP o apellido.",
        },
        {
          status: 400,
        },
      );
    }

    // Confirmar el pedido utilizando
    // la lógica central de reservaciones.
    const result = await deliver(
      slug,
      reservationId,
      {
        code,
        lastName,
      },
      method,
    );

    // Verificar resultado.
    if (result !== "ok") {
      const status =
        result === "not_found"
          ? 404
          : result === "wrong_code" ||
              result === "wrong_last_name"
            ? 403
            : result === "invalid_method"
              ? 400
              : 409;

      return Response.json(
        {
          ok: false,
          error: result,
        },
        {
          status,
        },
      );
    }

    // Entrega confirmada.
    return Response.json(
      {
        ok: true,
        reservationId,
        paymentMethod: method,
        status: "captured",
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "Error al registrar la entrega:",
      error,
    );

    return Response.json(
      {
        ok: false,
        error: "delivery_failed",
        message:
          "No se pudo completar la entrega.",
      },
      {
        status: 500,
      },
    );
  }
}
