import "server-only";
import type { OrderLine } from "./inventory";
import {
  authorizeOrder,
  captureAuthorization,
  createReservationOrder,
  PayPalError,
  voidAuthorization,
} from "./paypal";
import { lastNameMatches, type Reservation, type StallState } from "./stall";
import { alertOwnerToPrepare, askCustomerToConfirm, notifyWaiting, tellCustomerReady } from "./push";
import {
  confirmAskAt,
  kitchenStage,
  needsConfirmation,
  pickupSettings,
  prepStartsAt,
  type ResolvedPickup,
} from "./pickup";
import { store } from "./store";

// The reservation lifecycle across the store and PayPal:
// reserve (stock taken) → customer approves on PayPal → authorize (money held)
// → owner taps "Entregado" → capture (sale recorded).
// If the customer never approves, or never confirms an order scheduled hours
// ahead, the hold is voided and the stock goes back. If they confirmed (or
// ordered for right now) and nobody picks it up within the tolerance, it is
// charged: the customer is told so before paying.

/** A reservation nobody approved on PayPal gives its stock back after this. */
export const APPROVAL_MINUTES = 15;

export type StartResult =
  | { ok: true; reservation: Reservation; approveUrl: string }
  | { ok: false; reason: "closed" | "short" | "payment" | "error"; short?: string[] };

/** Same dish twice becomes one line. */
export function mergeLines(lines: OrderLine[]): OrderLine[] {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.dishId, (m.get(l.dishId) ?? 0) + l.qty);
  return [...m].map(([dishId, qty]) => ({ dishId, qty }));
}

export async function startReservation(
  state: StallState,
  input: {
    customerName: string;
    lines: OrderLine[];
    origin: string;
    lang: "es" | "en";
    pickup: ResolvedPickup;
    /** The signed-in account reserving; its card gets the stamp. */
    customerId?: string | null;
  },
): Promise<StartResult> {
  const lines = mergeLines(input.lines);
  let res;
  try {
    res = await store.reserve(state.slug, input.customerName, lines, input.pickup.pickupBy);
    if (res.ok) {
      const pickupAt = input.pickup.pickupAt.toISOString();
      const customerId = input.customerId ?? null;
      await store.updatePickup(state.slug, res.reservation.id, { pickupMode: input.pickup.mode, pickupAt, customerId });
      res.reservation = { ...res.reservation, pickupMode: input.pickup.mode, pickupAt, customerId };
    }
  } catch (e) {
    console.error("reservation: store failed", e);
    return { ok: false, reason: "error" };
  }
  if (!res.ok) return res;

  const r = res.reservation;
  const back = `${input.origin}/api/reservations/return?slug=${encodeURIComponent(state.slug)}&id=${r.id}&lang=${input.lang}`;
  const name = new Map(state.dishes.map((d) => [d.id, input.lang === "es" ? d.nameEs : d.nameEn]));
  const price = new Map(state.dishes.map((d) => [d.id, d.priceCents]));
  try {
    const order = await createReservationOrder({
      reservationId: r.id,
      businessName: state.name,
      currency: state.currency,
      items: lines.map((l) => ({ name: name.get(l.dishId) ?? l.dishId, qty: l.qty, unitCents: price.get(l.dishId) ?? 0 })),
      returnUrl: `${back}&result=approved`,
      cancelUrl: `${back}&result=cancelled`,
      locale: input.lang === "es" ? "es-MX" : "en-US",
    });
    await store.setPayPalOrder(state.slug, r.id, order.orderId);
    return { ok: true, reservation: { ...r, paypalOrderId: order.orderId }, approveUrl: order.approveUrl };
  } catch (e) {
    console.error("reservation: create order failed", e);
    await store.release(state.slug, r.id, "voided");
    return { ok: false, reason: "payment" };
  }
}

/** The customer came back from PayPal having approved: place the hold. */
export async function confirmApproval(slug: string, id: string, orderId: string): Promise<Reservation | null> {
  const r = await store.getReservation(slug, id);
  if (!r || r.paypalOrderId !== orderId) return null;
  if (r.status !== "held") return r;
  const auth = await authorizeOrder(orderId);
  // With an account the stamp goes to the account's card, not the PayPal payer.
  await store.markAuthorized(slug, id, auth.authorizationId, r.customerId ? `user:${r.customerId}` : auth.payerId);
  // "Para ahorita" goes straight to the kitchen.
  const s = await store.get(slug);
  if (s) await advance(s).catch((e) => console.error("pickup: advance failed", e));
  return store.getReservation(slug, id);
}

/** Owner taps "Listo": tell the customer to come. */
export async function markReady(slug: string, id: string): Promise<boolean> {
  const r = await store.getReservation(slug, id);
  if (!r || r.status !== "authorized") return false;
  if (r.readyAt) return true;
  const readyAt = new Date().toISOString();
  await store.updatePickup(slug, id, { readyAt });
  const s = await store.get(slug);
  if (s) await tellCustomerReady(s, { ...r, readyAt }).catch((e) => console.error("push: ready failed", e));
  return true;
}

/** Customer confirms they are still coming for an order scheduled hours ahead. */
export async function confirmPickup(slug: string, id: string): Promise<"ok" | "not_found" | "not_needed"> {
  const r = await store.getReservation(slug, id);
  if (!r || r.status !== "authorized") return "not_found";
  if (!needsConfirmation(r)) return "not_needed";
  if (!r.confirmedAt) await store.updatePickup(slug, id, { confirmedAt: new Date().toISOString() });
  return "ok";
}

/** The customer cancelled on PayPal. */
export async function cancelApproval(slug: string, id: string): Promise<void> {
  const r = await store.getReservation(slug, id);
  if (r?.status === "held") await store.release(slug, id, "voided");
}

/** What the owner typed at the counter: the customer's code, or their last name if they lost it. */
export type PickupProof = { code?: string; lastName?: string };

/** "Entregado": charge the held payment and record the sale. */
export async function deliver(
  slug: string,
  id: string,
  proof: PickupProof = {},
): Promise<"ok" | "not_found" | "not_authorized" | "wrong_code" | "wrong_last_name"> {
  const r = await store.getReservation(slug, id);
  if (!r) return "not_found";
  if (r.status !== "authorized" || !r.paypalAuthorizationId) return "not_authorized";
  // Reservations from before codes existed are handed over as they always were.
  if (r.pickupCode) {
    if (proof.lastName !== undefined) {
      if (!lastNameMatches(r.customerName, proof.lastName)) return "wrong_last_name";
    } else if (proof.code !== r.pickupCode) return "wrong_code";
  }
  await captureAuthorization(r.paypalAuthorizationId);
  await store.markDelivered(slug, id);
  return "ok";
}

/** Owner cancels, or the pickup time passed: release the hold, nothing is charged. */
export async function cancel(slug: string, id: string, status: "voided" | "expired" = "voided"): Promise<boolean> {
  const r = await store.getReservation(slug, id);
  if (!r) return false;
  if (r.status === "authorized" && r.paypalAuthorizationId) {
    try {
      await voidAuthorization(r.paypalAuthorizationId);
    } catch (e) {
      // Already voided or expired at PayPal: the stock still has to come back.
      if (!(e instanceof PayPalError && e.status === 422)) throw e;
    }
  }
  return store.release(slug, id, status);
}

/** Nobody picked it up within the tolerance: charge it, as the customer was told. */
async function chargeNoShow(slug: string, r: Reservation): Promise<boolean> {
  if (r.status !== "authorized" || !r.paypalAuthorizationId) return false;
  await captureAuthorization(r.paypalAuthorizationId);
  const done = await store.markDelivered(slug, r.id);
  await store.updatePickup(slug, r.id, { noShow: true });
  return done;
}

/**
 * Moves orders along their pickup timeline. Runs on reads (the free Render
 * instance has no background jobs), so the panel being open is what keeps it
 * on time. Returns true if any reservation finished, so callers reload.
 */
export async function sweep(state: StallState, now = new Date()): Promise<boolean> {
  const approvalCutoff = now.getTime() - APPROVAL_MINUTES * 60_000;
  const p = pickupSettings(state);
  let changed = false;
  for (const r of state.reservations) {
    try {
      if (r.status === "held" && new Date(r.createdAt).getTime() < approvalCutoff) {
        changed = (await cancel(state.slug, r.id, "expired")) || changed;
      } else if (r.status === "authorized") {
        if (needsConfirmation(r) && !r.confirmedAt && now >= prepStartsAt(r, p)) {
          // Never confirmed: nothing was cooked, so nothing is charged.
          changed = (await cancel(state.slug, r.id, "expired")) || changed;
        } else if (new Date(r.pickupBy).getTime() < now.getTime()) {
          changed = (await chargeNoShow(state.slug, r)) || changed;
        }
      }
    } catch (e) {
      console.error(`reservation ${r.id}: sweep failed`, e);
    }
  }
  if (!changed) await advance(state, now);
  return changed;
}

/** Sends each due notice once: ask to confirm, tell the kitchen to start. */
async function advance(state: StallState, now = new Date()) {
  const p = pickupSettings(state);
  for (const r of state.reservations) {
    if (r.status !== "authorized") continue;
    const stage = kitchenStage(r, p, now);
    if (stage === "awaiting_confirmation" && !r.confirmAskedAt && now >= confirmAskAt(r, p)) {
      await store.updatePickup(state.slug, r.id, { confirmAskedAt: now.toISOString() });
      await askCustomerToConfirm(state, r).catch((e) => console.error("push: confirm failed", e));
    }
    if (stage === "to_prepare" && !r.prepAlertedAt) {
      await store.updatePickup(state.slug, r.id, { prepAlertedAt: now.toISOString() });
      await alertOwnerToPrepare(state, r).catch((e) => console.error("push: prep failed", e));
    }
  }
}

/** Loads a stall with expired reservations already released. */
export async function loadStall(slug: string): Promise<StallState | null> {
  const s = await store.get(slug);
  if (!s) return null;
  if (!(await sweep(s))) return s;
  // Stock came back, so a dish someone is waiting for may be available again.
  const fresh = await store.get(slug);
  if (fresh) notifyWaiting(fresh).catch((e) => console.error("push: notify failed", e));
  return fresh;
}
