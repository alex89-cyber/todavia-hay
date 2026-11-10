import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mergeLines } = await import("./reservations");
const { store } = await import("./store");

const SLUG = "birria-dona-lupe";

describe("indicaciones por platillo", () => {
  it("junta cantidades y notas del mismo platillo", () => {
    expect(
      mergeLines([
        { dishId: "a", qty: 1, note: "sin cebolla" },
        { dishId: "a", qty: 2 },
        { dishId: "b", qty: 1, note: "  " },
      ]),
    ).toEqual([
      { dishId: "a", qty: 3, note: "sin cebolla" },
      { dishId: "b", qty: 1 },
    ]);
  });

  it("guarda la nota en el apartado sin tocar cantidades", async () => {
    const s = (await store.get(SLUG))!;
    const dish = s.dishes[0];
    const res = await store.reserve(SLUG, "Ana Ramírez", [{ dishId: dish.id, qty: 2 }], new Date(Date.now() + 3600_000));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    await store.setLineNotes(SLUG, res.reservation.id, [{ dishId: dish.id, qty: 2, note: "sin cilantro" }]);

    const after = (await store.get(SLUG))!.reservations.find((r) => r.id === res.reservation.id)!;
    expect(after.lines).toEqual([{ dishId: dish.id, qty: 2, note: "sin cilantro" }]);
  });
});
