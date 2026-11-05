import { describe, expect, it } from "vitest";
import { cashUp, ownerView, publicSnapshot } from "./stall";
import { memoryStore, seedDemo } from "./store/memory";

const SLUG = "birria-dona-lupe";

describe("public snapshot", () => {
  it("shows no portions while closed", () => {
    const s = { ...seedDemo(), isOpen: false };
    expect(publicSnapshot(s).dishes.every((d) => d.portions === 0)).toBe(true);
  });

  it("does not expose sales or ingredient stock", () => {
    const snap = publicSnapshot(seedDemo()) as Record<string, unknown>;
    expect(snap.sales).toBeUndefined();
    expect(snap.ingredients).toBeUndefined();
  });
});

describe("owner view", () => {
  it("forecasts sell-out times from the seeded morning", () => {
    const v = ownerView(seedDemo());
    expect(v.dishes.some((d) => d.soldOutAt !== null)).toBe(true);
  });
});

describe("cash-up", () => {
  it("adds up totals by method and by dish", () => {
    const s = seedDemo();
    const c = cashUp(s);
    expect(c.totalCents).toBe(s.sales.reduce((n, x) => n + x.totalCents, 0));
    expect(c.byMethod.cash + c.byMethod.card).toBe(c.totalCents);
    expect(c.byDish.reduce((n, d) => n + d.totalCents, 0)).toBe(c.totalCents);
    const meat = c.used.find((u) => u.ingredientId === "carne")!;
    expect(meat.used + meat.left).toBe(12_000);
  });
});

describe("memory store", () => {
  it("sells, refuses when short, closes and reopens with a fresh count", async () => {
    await memoryStore.reset(SLUG);
    const sold = await memoryStore.recordSale(SLUG, [{ dishId: "birria-plato", qty: 1 }], "cash");
    expect(sold.ok).toBe(true);

    const tooMany = await memoryStore.recordSale(SLUG, [{ dishId: "birria-plato", qty: 50 }], "cash");
    expect(tooMany).toMatchObject({ ok: false, reason: "short" });

    const { cashUp: c } = await memoryStore.close(SLUG);
    expect(c.salesCount).toBeGreaterThan(0);
    expect(await memoryStore.recordSale(SLUG, [{ dishId: "quesabirria", qty: 1 }], "cash")).toMatchObject({
      ok: false,
      reason: "closed",
    });

    const reopened = await memoryStore.open(SLUG, { carne: 5_000 });
    expect(reopened.isOpen).toBe(true);
    expect(reopened.sales).toHaveLength(0);
    expect(reopened.ingredients.find((i) => i.id === "carne")!.stock).toBe(5_000);
  });

  it("a dish marked sold out cannot be sold", async () => {
    await memoryStore.reset(SLUG);
    await memoryStore.setSoldOut(SLUG, "quesabirria", true);
    const r = await memoryStore.recordSale(SLUG, [{ dishId: "quesabirria", qty: 1 }], "cash");
    expect(r.ok).toBe(false);
  });
});
