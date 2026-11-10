
import "server-only";

import {
  kitchenStage,
  needsConfirmation,
  pickupSettings,
  prepStartsAt,
  type KitchenStage,
} from "./pickup";

import {
  type Reservation,
  type ReservationStatus,
  type StallState,
} from "./stall";

// ==========================================
// TODAVÍA HAY
// PEDIDOS VISIBLES PARA EL CLIENTE
// ==========================================

export type HeldOrder = {
  id: string;
  code: string | null;
  orderNumber: number | null;
  items: string;
  totalCents: number;
  pickupMode: "asap" | "scheduled";
  pickupAt: string | null;
  pickupBy: string;

  // Estado real registrado en Supabase.
  status: ReservationStatus;

  stage: KitchenStage;
  needsConfirmation: boolean;
  confirmed: boolean;
  confirmBy: string | null;
};

// ==========================================
// CONVERTIR RESERVACIÓN PARA LA INTERFAZ
// ==========================================

export function heldOrder(
  s: StallState,
  lang: "es" | "en",
  r: Reservation,
  now = new Date(),
): HeldOrder {
  const names = new Map(
    s.dishes.map((d) => [
      d.id,
      lang === "es" ? d.nameEs : d.nameEn,
    ]),
  );

  const p = pickupSettings(s);
  const confirm =
    r.status === "authorized" &&
    needsConfirmation(r);

  return {
    id: r.id,

    // El NIP ya no hace falta cuando
    // el pedido fue entregado o cancelado.
    code:
      r.status === "authorized"
        ? r.pickupCode
        : null,

    orderNumber: r.orderNumber,

    items: r.lines
      .map(
        (l) =>
          `${l.qty} × ${
            names.get(l.dishId) ?? "?"
          }${l.note ? ` (${l.note})` : ""}`,
      )
      .join(", "),

    totalCents: r.totalCents,
    pickupMode: r.pickupMode,
    pickupAt: r.pickupAt,
    pickupBy: r.pickupBy,
    status: r.status,

    stage: kitchenStage(r, p, now),

    needsConfirmation: confirm,

    confirmed: Boolean(r.confirmedAt),

    confirmBy: confirm
      ? prepStartsAt(
          r,
          p,
        ).toISOString()
      : null,
  };
}

// ==========================================
// IDENTIFICADORES DEL NAVEGADOR
// ==========================================

export function holdIds(
  cookie: string | undefined,
): string[] {
  return (cookie ?? "")
    .split(",")
    .filter(
      (id) =>
        /^[0-9a-f-]{36}$/i.test(id),
    )
    .slice(0, 30);
}

// ==========================================
// HISTORIAL DE PEDIDOS
// ==========================================

// Incluye pedidos pendientes,
// entregados, vencidos y cancelados.
//
// Solo devuelve reservas que pertenecen
// a la cuenta autenticada o que están
// asociadas a la cookie del navegador.
//
// No identifica clientes por nombre.

export function heldOrders(
  s: StallState,
  lang: "es" | "en",
  cookie: string | undefined,
  customerId: string | null = null,
): HeldOrder[] {
  const ids = holdIds(cookie);
  const owned = new Set(ids);

  return s.reservations
    .filter((r) => {
      // Con sesión: solo los pedidos de esa cuenta,
      // aunque el celular guarde los de otra.
      if (customerId !== null) {
        return r.customerId === customerId;
      }

      // Sin sesión: los que se hicieron sin cuenta
      // desde este navegador.
      return owned.has(r.id) && !r.customerId;
    })
    .filter(
      (r) =>
        r.status !== "held",
    )
    .sort(
      (a, b) =>
        new Date(
          b.createdAt,
        ).getTime() -
        new Date(
          a.createdAt,
        ).getTime(),
    )
    .slice(0, 30)
    .map(
      (r) =>
        heldOrder(s, lang, r),
    );
}
