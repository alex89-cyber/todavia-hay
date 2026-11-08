import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./push", () => ({
  notifyWaiting: vi.fn(async () => 0),
  alertOwnerToPrepare: vi.fn(async () => 1),
  askCustomerToConfirm: vi.fn(async () => 1),
  tellCustomerReady: vi.fn(async () => 1),
}));

const { sweep } = await import("./reservations");
const { store } = await import("./store");
const push = await import("./push");

const SLUG = "birria-dona-lupe";
const MIN = 60_000;

async function reserved(createdAt: Date, mode: "asap" | "scheduled", pickupAt: Date, toleranceMin = 20) {
  const s = (await store.get(SLUG))!;
  const dish = s.dishes[0];
  const r = await store.reserve(SLUG, "Ana Ramírez", [{ dishId: dish.id, qty: 1 }], new Date(pickupAt.getTime() + toleranceMin * MIN));
  if (!r.ok) throw new Error(r.reason);
  await store.markAuthorized(SLUG, r.reservation.id, null);
  await store.updatePickup(SLUG, r.reservation.id, { pickupMode: mode, pickupAt: pickupAt.toISOString() });
  // createdAt drives "more than an hour ahead".
  const st = (await store.get(SLUG))!;
  st.reservations.find((x) => x.id === r.reservation.id)!.createdAt = createdAt.toISOString();
  return r.reservation.id;
}

describe("sweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Pay at pickup: nothing is held, so a no-show is just released, never charged.
  it("releases an order nobody picked up after the tolerance, without charging", async () => {
    const now = new Date();
    const id = await reserved(new Date(now.getTime() - 60 * MIN), "asap", new Date(now.getTime() - 30 * MIN));
    await sweep((await store.get(SLUG))!, now);
    const r = await store.getReservation(SLUG, id);
    expect(r?.status).toBe("expired");
    expect((await store.get(SLUG))!.sales.some((x) => x.reservationId === id)).toBe(false);
  });

  it("cancels for free an order scheduled hours ahead that was never confirmed", async () => {
    const now = new Date();
    // Ordered 3 h ago for 10 minutes from now; kitchen starts 20 min before → already due.
    const id = await reserved(new Date(now.getTime() - 180 * MIN), "scheduled", new Date(now.getTime() + 10 * MIN));
    await sweep((await store.get(SLUG))!, now);
    const r = await store.getReservation(SLUG, id);
    expect(r?.status).toBe("expired");
    expect((await store.get(SLUG))!.sales.some((x) => x.reservationId === id)).toBe(false);
  });

  it("asks to confirm, then tells the kitchen once confirmed", async () => {
    const now = new Date();
    // Ordered 2 h ago for 30 min from now: ask at pickup-20-15 = now-5 min.
    const id = await reserved(new Date(now.getTime() - 120 * MIN), "scheduled", new Date(now.getTime() + 30 * MIN));
    await sweep((await store.get(SLUG))!, now);
    expect(push.askCustomerToConfirm).toHaveBeenCalledTimes(1);
    await sweep((await store.get(SLUG))!, now);
    expect(push.askCustomerToConfirm).toHaveBeenCalledTimes(1); // only once
    await store.updatePickup(SLUG, id, { confirmedAt: now.toISOString() });
    await sweep((await store.get(SLUG))!, new Date(now.getTime() + 12 * MIN));
    expect(push.alertOwnerToPrepare).toHaveBeenCalled();
    expect((await store.getReservation(SLUG, id))?.status).toBe("authorized");
  });
});
