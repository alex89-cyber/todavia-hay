import "server-only";
import { kitchenStage, needsConfirmation, pickupSettings, prepStartsAt, type KitchenStage } from "./pickup";
import { isActive, type Reservation, type StallState } from "./stall";

/** One order this browser reserved, as the customer sees it. */
export type HeldOrder = {
  id: string;
  code: string | null;
  orderNumber: number | null;
  items: string;
  totalCents: number;
  pickupMode: "asap" | "scheduled";
  /** Chosen time, or estimated ready time for "para ahorita". */
  pickupAt: string | null;
  /** Charged if not picked up by then. */
  pickupBy: string;
  stage: KitchenStage;
  needsConfirmation: boolean;
  confirmed: boolean;
  /** Unconfirmed orders are cancelled for free at this time. */
  confirmBy: string | null;
};

export function heldOrder(s: StallState, lang: "es" | "en", r: Reservation, now = new Date()): HeldOrder {
  const name = new Map(s.dishes.map((d) => [d.id, lang === "es" ? d.nameEs : d.nameEn]));
  const p = pickupSettings(s);
  const confirm = needsConfirmation(r);
  return {
    id: r.id,
    code: r.pickupCode,
    orderNumber: r.orderNumber,
    items: r.lines.map((l) => `${l.qty} × ${name.get(l.dishId) ?? "?"}`).join(", "),
    totalCents: r.totalCents,
    pickupMode: r.pickupMode,
    pickupAt: r.pickupAt,
    pickupBy: r.pickupBy,
    stage: kitchenStage(r, p, now),
    needsConfirmation: confirm,
    confirmed: Boolean(r.confirmedAt),
    confirmBy: confirm ? prepStartsAt(r, p).toISOString() : null,
  };
}

export const holdIds = (cookie: string | undefined) => (cookie ?? "").split(",").filter(Boolean);

/** Active reservations this browser made (cookie set on the PayPal return), newest first. */
export function heldOrders(
  s: StallState,
  lang: "es" | "en",
  cookie: string | undefined,
  customerId: string | null = null,
): HeldOrder[] {
  const ids = holdIds(cookie);
  return s.reservations
    .filter(
      (r) =>
        (ids.includes(r.id) || (customerId !== null && r.customerId === customerId)) &&
        isActive(r) &&
        r.status === "authorized",
    )
    .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
    .map((r) => heldOrder(s, lang, r));
}
