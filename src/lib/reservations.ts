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
import { notifyWaiting } from "./push";
import { store } from "./store";

// The reservation lifecycle across the store and PayPal:
// reserve (stock taken) → customer approves on PayPal → authorize (money held)
// → owner taps "Entregado" → capture (sale recorded).
// If the customer never approves or never shows up, the hold is voided and the
// stock goes back.

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
  input: { customerName: string; lines: OrderLine[]; origin: string; lang: "es" | "en" },
): Promise<StartResult> {
  const lines = mergeLines(input.lines);
  const pickupBy = new Date(Date.now() + state.holdMinutes * 60_000);
  let res;
  try {
    res = await store.reserve(state.slug, input.customerName, lines, pickupBy);
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
  await store.markAuthorized(slug, id, auth.authorizationId, auth.payerId);
  return store.getReservation(slug, id);
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

/**
 * Expires reservations that were never approved or never picked up. Runs on
 * reads (the free Render instance has no background jobs). Returns true if
 * anything changed, so callers reload the state.
 */
export async function sweep(state: StallState, now = new Date()): Promise<boolean> {
  const approvalCutoff = now.getTime() - APPROVAL_MINUTES * 60_000;
  const due = state.reservations.filter(
    (r) =>
      (r.status === "held" && new Date(r.createdAt).getTime() < approvalCutoff) ||
      (r.status === "authorized" && new Date(r.pickupBy).getTime() < now.getTime()),
  );
  let changed = false;
  for (const r of due) {
    try {
      changed = (await cancel(state.slug, r.id, "expired")) || changed;
    } catch (e) {
      console.error(`reservation ${r.id}: expiry failed`, e);
    }
  }
  return changed;
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
