import type { Dish, Ingredient } from "./inventory";

// "Birria Doña Lupe": the fictional stall used in the demo. Birria meat and
// consomé are shared across dishes on purpose, to show recipe-based deduction.

export const demoIngredients: Ingredient[] = [
  { id: "carne", name: "Carne de birria", unit: "g", stock: 12_000 },
  { id: "consome", name: "Consomé", unit: "ml", stock: 15_000 },
  { id: "tortilla", name: "Tortilla", unit: "pz", stock: 300 },
  { id: "queso", name: "Queso Oaxaca", unit: "g", stock: 2_500 },
  { id: "cebolla-cilantro", name: "Cebolla y cilantro", unit: "g", stock: 3_000 },
];

export const demoDishes: Dish[] = [
  {
    id: "birria-plato",
    nameEs: "Plato de birria",
    nameEn: "Birria plate",
    priceCents: 14_000,
    soldOut: false,
    recipe: [
      { ingredientId: "carne", qty: 250 },
      { ingredientId: "consome", qty: 300 },
      { ingredientId: "tortilla", qty: 4 },
      { ingredientId: "cebolla-cilantro", qty: 30 },
    ],
  },
  {
    id: "tacos-dorados",
    nameEs: "Orden de tacos dorados (3)",
    nameEn: "Crispy tacos (3)",
    priceCents: 9_000,
    soldOut: false,
    recipe: [
      { ingredientId: "carne", qty: 150 },
      { ingredientId: "tortilla", qty: 3 },
      { ingredientId: "consome", qty: 100 },
      { ingredientId: "cebolla-cilantro", qty: 20 },
    ],
  },
  {
    id: "quesabirria",
    nameEs: "Quesabirria",
    nameEn: "Quesabirria",
    priceCents: 4_500,
    soldOut: false,
    recipe: [
      { ingredientId: "carne", qty: 80 },
      { ingredientId: "queso", qty: 50 },
      { ingredientId: "tortilla", qty: 1 },
      { ingredientId: "consome", qty: 60 },
    ],
  },
  {
    id: "consome-vaso",
    nameEs: "Vaso de consomé",
    nameEn: "Cup of consomé",
    priceCents: 3_000,
    soldOut: false,
    recipe: [{ ingredientId: "consome", qty: 350 }],
  },
];

/** Row ids of the demo stall in Supabase (supabase/migrations/0002_server_access_and_demo.sql). */
export const demoDbIds = {
  business: "b0000000-0000-4000-8000-000000000001",
  ingredients: {
    carne: "10000000-0000-4000-8000-000000000001",
    consome: "10000000-0000-4000-8000-000000000002",
    tortilla: "10000000-0000-4000-8000-000000000003",
    queso: "10000000-0000-4000-8000-000000000004",
    "cebolla-cilantro": "10000000-0000-4000-8000-000000000005",
  } as Record<string, string>,
  dishes: {
    "birria-plato": "20000000-0000-4000-8000-000000000001",
    "tacos-dorados": "20000000-0000-4000-8000-000000000002",
    quesabirria: "20000000-0000-4000-8000-000000000003",
    "consome-vaso": "20000000-0000-4000-8000-000000000004",
  } as Record<string, string>,
};

export type SeedSale = { dishId: string; qty: number; method: "cash" | "card"; minutesAgo: number };

/** The demo day opened this long ago, so the seeded sales span lunch. */
export const DEMO_OPENED_MINUTES_AGO = 245;

/**
 * A day of sales for the demo: slow late morning, a lunch rush (an order every
 * ~4 minutes), then calmer again. Heavier on quesabirrias.
 */
export function demoSeedSales(): SeedSale[] {
  const pattern = ["quesabirria", "birria-plato", "quesabirria", "tacos-dorados", "consome-vaso", "quesabirria"];
  const out: SeedSale[] = [];
  for (let m = DEMO_OPENED_MINUTES_AGO - 5, k = 0; m > 0; m -= m > 150 ? 11 : m > 60 ? 4 : 8, k++) {
    out.push({
      dishId: pattern[k % pattern.length],
      qty: k % 4 === 0 ? 2 : 1,
      method: k % 3 === 0 ? "card" : "cash",
      minutesAgo: m,
    });
  }
  return out;
}
