import { describe, expect, it } from "vitest";
import {
  atLocal,
  hhmm,
  kitchenStage,
  needsConfirmation,
  pickupOptions,
  pickupSettings,
  resolvePickup,
} from "./pickup";
import type { Reservation, StallState } from "./stall";

const TZ = "America/Mexico_City"; // UTC-6, no DST
// Wednesday 2026-11-04 14:02 local = 20:02 UTC.
const NOW = new Date("2026-11-04T20:02:00Z");

function stall(over: Partial<StallState> = {}, hours = true): StallState {
  return {
    slug: "x",
    name: "X",
    currency: "MXN",
    timezone: TZ,
    isOpen: true,
    openedAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    dishes: [],
    ingredients: [],
    openingCount: {},
    sales: [],
    holdMinutes: 30,
    reservations: [],
    loyalty: { rewardDishId: null, stampsPerReward: 10 } as unknown as StallState["loyalty"],
    settings: {
      openingHours: hours
        ? [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, enabled: day !== 0, open: "09:00", close: "18:00" }))
        : [],
    },
    ...over,
  };
}

function res(over: Partial<Reservation>): Reservation {
  return {
    id: crypto.randomUUID(),
    customerName: "Ana Ramírez",
    lines: [],
    totalCents: 100,
    status: "authorized",
    pickupBy: NOW.toISOString(),
    createdAt: NOW.toISOString(),
    paypalOrderId: null,
    paypalAuthorizationId: null,
    payerId: null,
    pickupCode: "1234",
    orderNumber: 1,
    pickupMode: "asap",
    pickupAt: null,
    confirmedAt: null,
    readyAt: null,
    noShow: false,
    confirmAskedAt: null,
    prepAlertedAt: null,
    customerId: null,
    ...over,
  };
}

describe("time zones", () => {
  it("builds local times", () => {
    expect(atLocal(NOW, TZ, 15 * 60).toISOString()).toBe("2026-11-04T21:00:00.000Z");
    expect(hhmm(NOW, TZ)).toBe("14:02");
  });
});

describe("pickupOptions", () => {
  it("offers asap and slots from now + notice, on the opening grid", () => {
    const o = pickupOptions(stall(), NOW);
    expect(o.asap.available).toBe(true);
    // 14:02 + 20 min notice = 14:22 → first 15-minute slot is 14:30, last is 18:00.
    expect(hhmm(o.slots[0], TZ)).toBe("14:30");
    expect(hhmm(o.slots.at(-1)!, TZ)).toBe("18:00");
  });

  it("is closed outside opening hours, and says when it opens", () => {
    const late = new Date("2026-11-05T01:00:00Z"); // 19:00 local
    const o = pickupOptions(stall(), late);
    expect(o.asap).toEqual({ available: false, reason: "closed" });
    expect(o.slots).toEqual([]);
    expect(o.opensAt?.toISOString()).toBe("2026-11-05T15:00:00.000Z"); // Thursday 9:00
  });

  it("skips Sunday when it is the rest day", () => {
    const sat = new Date("2026-11-08T01:00:00Z"); // Saturday 19:00 local
    expect(pickupOptions(stall(), sat).opensAt?.toISOString()).toBe("2026-11-09T15:00:00.000Z"); // Monday
  });

  it("turns asap off when it would be ready after closing", () => {
    const o = pickupOptions(stall(), new Date("2026-11-04T23:45:00Z")); // 17:45
    expect(o.asap).toEqual({ available: false, reason: "closing" });
    expect(o.slots.map((d) => hhmm(d, TZ))).toEqual([]); // 17:45 + 20 = 18:05 > 18:00
  });

  it("needs the day opened in the panel", () => {
    expect(pickupOptions(stall({ isOpen: false }), NOW).asap.available).toBe(false);
    expect(pickupOptions(stall({ isOpen: false }), NOW).slots).toEqual([]);
  });

  it("with no hours configured, only the panel decides", () => {
    const o = pickupOptions(stall({}, false), NOW);
    expect(o.asap.available).toBe(true);
    expect(hhmm(o.slots[0], TZ)).toBe("14:30");
  });

  it("hides full slots", () => {
    const at = atLocal(NOW, TZ, 14 * 60 + 30).toISOString();
    const s = stall({
      settings: { ...stall().settings, pickup: { ...pickupSettings(stall()), maxPerSlot: 2 } },
      reservations: [res({ pickupMode: "scheduled", pickupAt: at }), res({ pickupMode: "scheduled", pickupAt: at })],
    });
    expect(hhmm(pickupOptions(s, NOW).slots[0], TZ)).toBe("14:45");
  });
});

describe("resolvePickup", () => {
  it("asap is ready in asapMinutes and charged after the tolerance", () => {
    const r = resolvePickup(stall(), { mode: "asap" }, NOW);
    expect(r.ok && r.pickup.pickupAt.toISOString()).toBe("2026-11-04T20:32:00.000Z");
    expect(r.ok && r.pickup.pickupBy.toISOString()).toBe("2026-11-04T20:52:00.000Z");
  });

  it("accepts a free slot and rounds an off-grid time up", () => {
    const a = resolvePickup(stall(), { mode: "scheduled", time: "16:00" }, NOW);
    expect(a.ok && hhmm(a.pickup.pickupAt, TZ)).toBe("16:00");
    const b = resolvePickup(stall(), { mode: "scheduled", time: "16:10" }, NOW);
    expect(b.ok && hhmm(b.pickup.pickupAt, TZ)).toBe("16:15");
  });

  it("rejects times it can't take", () => {
    const why = (time: string, s = stall()) => {
      const r = resolvePickup(s, { mode: "scheduled", time }, NOW);
      return r.ok ? "ok" : r.reason;
    };
    expect(why("14:10")).toBe("too_soon");
    expect(why("19:00")).toBe("outside_hours");
    expect(why("8:30")).toBe("outside_hours");
    expect(why("25:00")).toBe("bad_time");
    expect(why("15:00", stall({ isOpen: false }))).toBe("closed");
  });
});

describe("kitchen stage", () => {
  const p = pickupSettings(stall());
  it("asap goes straight to prepare", () => {
    expect(kitchenStage(res({}), p, NOW)).toBe("to_prepare");
  });

  it("scheduled within the hour starts at pickup - notice, no confirmation", () => {
    const r = res({ pickupMode: "scheduled", pickupAt: "2026-11-04T21:00:00Z" });
    expect(needsConfirmation(r)).toBe(false);
    expect(kitchenStage(r, p, NOW)).toBe("scheduled");
    expect(kitchenStage(r, p, new Date("2026-11-04T20:40:00Z"))).toBe("to_prepare");
  });

  it("scheduled hours ahead asks to confirm 15 minutes before the kitchen starts", () => {
    const r = res({ pickupMode: "scheduled", pickupAt: "2026-11-04T23:00:00Z" }); // 3 h ahead
    expect(needsConfirmation(r)).toBe(true);
    expect(kitchenStage(r, p, new Date("2026-11-04T22:20:00Z"))).toBe("scheduled");
    expect(kitchenStage(r, p, new Date("2026-11-04T22:25:00Z"))).toBe("awaiting_confirmation");
    expect(kitchenStage({ ...r, confirmedAt: "2026-11-04T22:26:00Z" }, p, new Date("2026-11-04T22:30:00Z"))).toBe("scheduled");
    expect(kitchenStage({ ...r, confirmedAt: "2026-11-04T22:26:00Z" }, p, new Date("2026-11-04T22:40:00Z"))).toBe("to_prepare");
    expect(kitchenStage({ ...r, readyAt: "2026-11-04T22:55:00Z" }, p, NOW)).toBe("ready");
  });
});
