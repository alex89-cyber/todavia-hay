import { describe, expect, it } from "vitest";
import { demoDishes, demoIngredients } from "./demo-data";
import { forecast } from "./forecast";
import {
  availability,
  canFulfill,
  deduct,
  menuAvailability,
  orderTotalCents,
  restore,
  stockMap,
} from "./inventory";

const dish = (id: string) => demoDishes.find((d) => d.id === id)!;
const portions = (ingredients = demoIngredients) =>
  Object.fromEntries(menuAvailability(demoDishes, ingredients).map((a) => [a.dishId, a.portions]));

describe("availability", () => {
  it("is limited by the scarcest ingredient", () => {
    // Plates: meat 12000/250 = 48, consomé 15000/300 = 50, tortilla 300/4 = 75.
    const a = availability(dish("birria-plato"), stockMap(demoIngredients));
    expect(a.portions).toBe(48);
    expect(a.limitingIngredientId).toBe("carne");
  });

  it("is zero when the dish is marked sold out", () => {
    const soldOut = { ...dish("quesabirria"), soldOut: true };
    expect(availability(soldOut, stockMap(demoIngredients)).portions).toBe(0);
  });
});

describe("shared ingredients", () => {
  it("selling quesabirrias lowers the tacos left too", () => {
    const before = portions();
    const after = portions(deduct([{ dishId: "quesabirria", qty: 30 }], demoDishes, demoIngredients));
    expect(after["quesabirria"]).toBeLessThan(before["quesabirria"]);
    expect(after["tacos-dorados"]).toBeLessThan(before["tacos-dorados"]);
  });

  it("rejects an order whose dishes together need more meat than is left", () => {
    const low = demoIngredients.map((i) => (i.id === "carne" ? { ...i, stock: 300 } : i));
    // Each fits on its own (250 g and 150 g) but not together (400 g).
    expect(canFulfill([{ dishId: "birria-plato", qty: 1 }], demoDishes, low)).toEqual({ ok: true });
    expect(canFulfill([{ dishId: "tacos-dorados", qty: 1 }], demoDishes, low)).toEqual({ ok: true });
    expect(
      canFulfill(
        [
          { dishId: "birria-plato", qty: 1 },
          { dishId: "tacos-dorados", qty: 1 },
        ],
        demoDishes,
        low,
      ),
    ).toEqual({ ok: false, shortIngredientIds: ["carne"] });
  });
});

describe("holds", () => {
  it("restoring a voided reservation gives the stock back exactly", () => {
    const lines = [{ dishId: "birria-plato", qty: 2 }];
    const held = deduct(lines, demoDishes, demoIngredients);
    expect(restore(lines, demoDishes, held)).toEqual(demoIngredients);
  });

  it("totals an order", () => {
    expect(
      orderTotalCents(
        [
          { dishId: "birria-plato", qty: 2 },
          { dishId: "quesabirria", qty: 1 },
        ],
        demoDishes,
      ),
    ).toBe(32_500);
  });
});

describe("forecast", () => {
  const now = new Date("2026-11-07T12:00:00-06:00");
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  it("gives no estimate with too few sales", () => {
    const f = forecast(demoDishes, demoIngredients, [{ dishId: "quesabirria", qty: 1, at: minutesAgo(5) }], now);
    expect(f.every((x) => x.soldOutAt === null)).toBe(true);
  });

  it("a quesabirria rush brings the plates' sell-out time forward", () => {
    // 60 quesabirrias in the last hour: 4800 g meat/hour = 80 g/min.
    const rush = Array.from({ length: 60 }, (_, i) => ({ dishId: "quesabirria", qty: 1, at: minutesAgo(i) }));
    const stock = deduct([{ dishId: "quesabirria", qty: 60 }], demoDishes, demoIngredients); // 7200 g left
    const plate = forecast(demoDishes, stock, rush, now).find((x) => x.dishId === "birria-plato")!;
    expect(plate.limitingIngredientId).toBe("carne");
    // (7200 - 250) / 80 ≈ 87 min.
    const minutes = (plate.soldOutAt!.getTime() - now.getTime()) / 60_000;
    expect(minutes).toBeGreaterThan(80);
    expect(minutes).toBeLessThan(95);
  });
});
