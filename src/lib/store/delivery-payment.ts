
import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  isDeliveryPaymentMethod,
  type DeliveryPaymentMethod,
} from "../payment-methods";

/**
 * TODAVÍA HAY
 *
 * Registro de pagos contra entrega.
 *
 * Métodos disponibles:
 * - cash: efectivo
 * - card: terminal bancaria
 * - transfer: transferencia
 *
 * IMPORTANTE:
 * Esta función únicamente debe ejecutarse
 * después de comprobar:
 *
 * 1. Que el usuario pertenece al negocio.
 * 2. Que el pedido pertenece a ese negocio.
 * 3. Que el NIP del cliente es correcto.
 * 4. Que el cliente ya realizó su pago.
 */

export type DeliveryPaymentResult =
  | {
      ok: true;
      saleId: string;
    }
  | {
      ok: false;
      reason: "invalid_method" | "not_authorized";
    };

export async function registerDeliveryPayment(
  reservationId: string,
  method: DeliveryPaymentMethod,
): Promise<DeliveryPaymentResult> {
  // Validar método de pago.
  if (!isDeliveryPaymentMethod(method)) {
    return {
      ok: false,
      reason: "invalid_method",
    };
  }

  // Obtener configuración de Supabase.
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan las variables de entorno de Supabase.",
    );
  }

  // Crear cliente exclusivo del servidor.
  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  // Registrar el pago mediante la función SQL.
  const { data, error } = await supabase.rpc(
    "deliver_reservation_with_method",
    {
      p_reservation: reservationId,
      p_method: method,
    },
  );

  if (error) {
    console.error(
      "Error al registrar la entrega:",
      error.message,
    );

    throw new Error(
      "No se pudo registrar el pago del pedido.",
    );
  }

  // La función devuelve null cuando el
  // pedido ya no puede ser entregado.
  if (typeof data !== "string") {
    return {
      ok: false,
      reason: "not_authorized",
    };
  }

  return {
    ok: true,
    saleId: data,
  };
}
