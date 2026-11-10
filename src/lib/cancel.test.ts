import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { customerCanCancel, ASAP_CANCEL_MS } = await import("./holds");
const { store } = await import("./store");

const SLUG = "birria-dona-lupe";
const MIN = 60_000;

describe("el cliente cancela su apartado", () => {
  it("para ahorita: solo los primeros minutos", async () => {
    const s = (await store.get(SLUG))!;
    const created = new Date();
    const r = {
      ...s.reservations[0],
      id: "x",
      status: "authorized" as const,
      pickupMode: "asap" as const,
      pickupAt: created.toISOString(),
      createdAt: created.toISOString(),
      readyAt: null,
    };
    expect(customerCanCancel(s, r, new Date(created.getTime() + MIN))).toBe(true);
    expect(customerCanCancel(s, r, new Date(created.getTime() + ASAP_CANCEL_MS + MIN))).toBe(false);
    expect(customerCanCancel(s, { ...r, readyAt: created.toISOString() }, created)).toBe(false);
    expect(customerCanCancel(s, { ...r, status: "captured" }, created)).toBe(false);
  });

  it("programado: mientras no toca prepararlo", async () => {
    const s = (await store.get(SLUG))!;
    const now = new Date();
    const r = {
      ...s.reservations[0],
      id: "y",
      status: "authorized" as const,
      pickupMode: "scheduled" as const,
      pickupAt: new Date(now.getTime() + 3 * 60 * MIN).toISOString(),
      createdAt: new Date(now.getTime() - 30 * MIN).toISOString(),
      readyAt: null,
    };
    expect(customerCanCancel(s, r, now)).toBe(true);
  });
});

describe("anular venta rápida", () => {
  it("regresa el inventario y la quita del corte", async () => {
    let s = (await store.get(SLUG))!;
    if (!s.isOpen) s = await store.open(SLUG, Object.fromEntries(s.ingredients.map((i) => [i.id, i.stock])));
    const dish = s.dishes.find((d) => d.recipe.length && !d.soldOut)!;
    const before = s.ingredients.map((i) => i.stock);

    const sold = await store.recordSale(SLUG, [{ dishId: dish.id, qty: 1 }], "cash");
    expect(sold.ok).toBe(true);
    const sale = (await store.get(SLUG))!.sales.at(-1)!;

    expect(await store.voidSale(SLUG, sale.id)).toBe(true);
    const after = (await store.get(SLUG))!;
    expect(after.sales.find((x) => x.id === sale.id)).toBeUndefined();
    expect(after.ingredients.map((i) => i.stock)).toEqual(before);

    expect(await store.voidSale(SLUG, sale.id)).toBe(false);
  });
});
