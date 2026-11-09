
import "server-only";

import type { OrderLine } from "./inventory";

import {
  lastNameMatches,
  phoneCardId,
  type Reservation,
  type StallState,
} from "./stall";

import {
  alertOwnerToPrepare,
  askCustomerToConfirm,
  notifyWaiting,
  tellCustomerReady,
} from "./push";

import {
  confirmAskAt,
  kitchenStage,
  needsConfirmation,
  pickupSettings,
  prepStartsAt,
  type ResolvedPickup,
} from "./pickup";

import { store } from "./store";

// ==========================================
// TODAVÍA HAY
// RESERVACIONES: SE PAGA AL RECOGER
// TELÉFONO OPCIONAL
// ==========================================

// Conservado para compatibilidad.
export const APPROVAL_MINUTES = 15;

export type PaymentMethod =
  | "cash"
  | "card"
  | "transfer";

export type StartResult =
  | {
      ok: true;
      reservation: Reservation;
    }
  | {
      ok: false;
      reason: "closed" | "short" | "error";
      short?: string[];
    };

// ==========================================
// UNIFICAR PRODUCTOS
// ==========================================

export function mergeLines(
  lines: OrderLine[],
): OrderLine[] {
  const quantities = new Map<string, number>();

  for (const line of lines) {
    quantities.set(
      line.dishId,
      (quantities.get(line.dishId) ?? 0) +
        line.qty,
    );
  }

  return [...quantities].map(
    ([dishId, qty]) => ({
      dishId,
      qty,
    }),
  );
}

// ==========================================
// IDENTIFICAR TARJETA DE RECOMPENSAS
// ==========================================

// Prioridad:
// 1. Cuenta existente, si la hay.
// 2. Número de teléfono proporcionado.
// 3. Sin tarjeta, si no hay ninguno.
//
// Se puede reservar sin teléfono.

function rewardCardId(
  customerId: string | null,
  phone: string | null,
): string | null {
  if (customerId) {
    return `user:${customerId}`;
  }

  if (!phone) {
    return null;
  }

  return phoneCardId(phone);
}

// ==========================================
// CREAR RESERVACIÓN
// ==========================================

export async function startReservation(
  state: StallState,
  input: {
    customerName: string;
    customerPhone?: string | null;
    lines: OrderLine[];
    origin: string;
    lang: "es" | "en";
    pickup: ResolvedPickup;
    customerId?: string | null;
    /** Comer aquí: cuántas personas. */
    dineIn?: { partySize: number } | null;
  },
): Promise<StartResult> {
  const lines = mergeLines(input.lines);

  const customerId =
    input.customerId ?? null;

  const customerPhone =
    input.customerPhone?.trim() || null;

  // Si no hay cuenta ni teléfono,
  // cardId será null.
  //
  // Eso NO impide reservar.

  const cardId = rewardCardId(
    customerId,
    customerPhone,
  );

  let result:
    | Awaited<ReturnType<typeof store.reserve>>
    | undefined;

  try {
    // Apartar inventario.
    result = await store.reserve(
      state.slug,
      input.customerName,
      lines,
      input.pickup.pickupBy,
    );

    if (!result.ok) {
      return result;
    }

    const pickupAt =
      input.pickup.pickupAt.toISOString();

    // Guardar horario e identificación
    // de cuenta, si existe.
    await store.updatePickup(
      state.slug,
      result.reservation.id,
      {
        pickupMode: input.pickup.mode,
        pickupAt,
        customerId,
        ...(input.dineIn
          ? { dineIn: true, partySize: input.dineIn.partySize }
          : {}),
      },
    );

    result.reservation = {
      ...result.reservation,
      pickupMode: input.pickup.mode,
      pickupAt,
      customerId,
      dineIn: Boolean(input.dineIn),
      partySize: input.dineIn?.partySize ?? null,
    };
  } catch (error) {
    console.error(
      "Error al crear el pedido:",
      error,
    );

    // Si la reserva ya descontó stock,
    // intentar liberar ese inventario.
    if (result?.ok) {
      await store
        .release(
          state.slug,
          result.reservation.id,
          "voided",
        )
        .catch((releaseError) => {
          console.error(
            "Error al liberar inventario:",
            releaseError,
          );
        });
    }

    return {
      ok: false,
      reason: "error",
    };
  }

  const reservation = result.reservation;

  // ========================================
  // CONFIRMAR PEDIDO
  // ========================================

  try {
    // "authorized" significa confirmado,
    // pero todavía NO pagado.
    //
    // El tercer argumento es la tarjeta
    // de recompensas, o null si el
    // cliente no quiere asociarla.

    await store.markAuthorized(
      state.slug,
      reservation.id,
      cardId,
    );

    const confirmed =
      await store.getReservation(
        state.slug,
        reservation.id,
      );

    if (
      !confirmed ||
      confirmed.status !== "authorized"
    ) {
      throw new Error(
        "No se encontró el pedido confirmado",
      );
    }

    const updatedState =
      await store.get(state.slug);

    if (updatedState) {
      await advance(updatedState).catch(
        (error) => {
          console.error(
            "Error al actualizar cocina:",
            error,
          );
        },
      );
    }

    return {
      ok: true,
      reservation: confirmed,
    };
  } catch (error) {
    console.error(
      "Error al confirmar pedido:",
      error,
    );

    await store
      .release(
        state.slug,
        reservation.id,
        "voided",
      )
      .catch((releaseError) => {
        console.error(
          "Error al cancelar reserva fallida:",
          releaseError,
        );
      });

    return {
      ok: false,
      reason: "error",
    };
  }
}

// ==========================================
// PEDIDO LISTO
// ==========================================

export async function markReady(
  slug: string,
  id: string,
): Promise<boolean> {
  const reservation =
    await store.getReservation(slug, id);

  if (
    !reservation ||
    reservation.status !== "authorized"
  ) {
    return false;
  }

  if (reservation.readyAt) {
    return true;
  }

  const readyAt = new Date().toISOString();

  await store.updatePickup(
    slug,
    id,
    { readyAt },
  );

  const state = await store.get(slug);

  if (state) {
    await tellCustomerReady(
      state,
      { ...reservation, readyAt },
    ).catch((error) => {
      console.error(
        "Error al notificar al cliente:",
        error,
      );
    });
  }

  return true;
}

// ==========================================
// CONFIRMAR RECOGIDA PROGRAMADA
// ==========================================

export async function confirmPickup(
  slug: string,
  id: string,
): Promise<
  "ok" | "not_found" | "not_needed"
> {
  const reservation =
    await store.getReservation(slug, id);

  if (
    !reservation ||
    reservation.status !== "authorized"
  ) {
    return "not_found";
  }

  if (!needsConfirmation(reservation)) {
    return "not_needed";
  }

  if (!reservation.confirmedAt) {
    await store.updatePickup(
      slug,
      id,
      {
        confirmedAt: new Date().toISOString(),
      },
    );
  }

  return "ok";
}

// ==========================================
// COMPROBANTE DE ENTREGA
// ==========================================

export type PickupProof = {
  code?: string;
  lastName?: string;
};

// ==========================================
// ENTREGAR PEDIDO Y REGISTRAR PAGO
// ==========================================

export async function deliver(
  slug: string,
  id: string,
  proof: PickupProof = {},
  method?: PaymentMethod,
): Promise<
  | "ok"
  | "not_found"
  | "not_authorized"
  | "wrong_code"
  | "wrong_last_name"
  | "invalid_method"
> {
  const reservation =
    await store.getReservation(slug, id);

  if (!reservation) {
    return "not_found";
  }

  if (reservation.status !== "authorized") {
    return "not_authorized";
  }

  if (
    method !== "cash" &&
    method !== "card" &&
    method !== "transfer"
  ) {
    return "invalid_method";
  }

  // Validar NIP o apellido.
  if (reservation.pickupCode) {
    if (proof.lastName !== undefined) {
      if (
        !lastNameMatches(
          reservation.customerName,
          proof.lastName,
        )
      ) {
        return "wrong_last_name";
      }
    } else if (
      proof.code !== reservation.pickupCode
    ) {
      return "wrong_code";
    }
  }

  // Registrar entrega y pago.
  // La función SQL debe acreditar el
  // sello solamente si hay una tarjeta
  // de recompensas asociada.
  //
  // No sumar sellos aquí por separado
  // para evitar duplicados.

  const saved = await store.markDelivered(
    slug,
    id,
    method,
  );

  return saved ? "ok" : "not_authorized";
}

// ==========================================
// CANCELAR PEDIDO
// ==========================================

export async function cancel(
  slug: string,
  id: string,
  status: "voided" | "expired" = "voided",
): Promise<boolean> {
  return store.release(
    slug,
    id,
    status,
  );
}

// ==========================================
// REVISAR PEDIDOS VENCIDOS
// ==========================================

export async function sweep(
  state: StallState,
  now = new Date(),
): Promise<boolean> {
  const settings = pickupSettings(state);

  let changed = false;

  for (const reservation of state.reservations) {
    try {
      if (reservation.status === "held") {
        changed =
          (await cancel(
            state.slug,
            reservation.id,
            "expired",
          )) || changed;
      } else if (
        reservation.status === "authorized"
      ) {
        if (
          needsConfirmation(reservation) &&
          !reservation.confirmedAt &&
          now >= prepStartsAt(
            reservation,
            settings,
          )
        ) {
          changed =
            (await cancel(
              state.slug,
              reservation.id,
              "expired",
            )) || changed;
        } else if (
          reservation.dineIn &&
          new Date(
            reservation.pickupBy,
          ).getTime() < now.getTime()
        ) {
          // Comer aquí y no llegó: ya se preparó,
          // es merma y no regresa al inventario.
          changed =
            (await store.noShow(
              state.slug,
              reservation.id,
            )) || changed;
        } else if (
          new Date(
            reservation.pickupBy,
          ).getTime() < now.getTime()
        ) {
          changed =
            (await cancel(
              state.slug,
              reservation.id,
              "expired",
            )) || changed;
        }
      }
    } catch (error) {
      console.error(
        `Error al revisar pedido ${reservation.id}:`,
        error,
      );
    }
  }

  if (!changed) {
    await advance(state, now);
  }

  return changed;
}

// ==========================================
// ACTUALIZAR COCINA Y AVISOS
// ==========================================

async function advance(
  state: StallState,
  now = new Date(),
): Promise<void> {
  const settings = pickupSettings(state);

  for (const reservation of state.reservations) {
    if (reservation.status !== "authorized") {
      continue;
    }

    const stage = kitchenStage(
      reservation,
      settings,
      now,
    );

    if (
      stage === "awaiting_confirmation" &&
      !reservation.confirmAskedAt &&
      now >= confirmAskAt(
        reservation,
        settings,
      )
    ) {
      await store.updatePickup(
        state.slug,
        reservation.id,
        {
          confirmAskedAt: now.toISOString(),
        },
      );

      await askCustomerToConfirm(
        state,
        reservation,
      ).catch((error) => {
        console.error(
          "Error al pedir confirmación:",
          error,
        );
      });
    }

    if (
      stage === "to_prepare" &&
      !reservation.prepAlertedAt
    ) {
      await store.updatePickup(
        state.slug,
        reservation.id,
        {
          prepAlertedAt: now.toISOString(),
        },
      );

      await alertOwnerToPrepare(
        state,
        reservation,
      ).catch((error) => {
        console.error(
          "Error al notificar cocina:",
          error,
        );
      });
    }
  }
}

// ==========================================
// CARGAR NEGOCIO
// ==========================================

export async function loadStall(
  slug: string,
): Promise<StallState | null> {
  const state = await store.get(slug);

  if (!state) {
    return null;
  }

  if (!(await sweep(state))) {
    return state;
  }

  const fresh = await store.get(slug);

  if (fresh) {
    notifyWaiting(fresh).catch((error) => {
      console.error(
        "Error en notificaciones:",
        error,
      );
    });
  }

  return fresh;
}
