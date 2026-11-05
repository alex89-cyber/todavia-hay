import { type Dish, type Ingredient, usage } from "./inventory";

export type SaleEvent = { dishId: string; qty: number; at: Date };

export type Forecast = {
  dishId: string;
  /** Estimated time the dish runs out, or null when sales are too slow to tell. */
  soldOutAt: Date | null;
  /** Ingredient that runs out first at the current pace. */
  limitingIngredientId: string | null;
};

const DEFAULT_WINDOW_MIN = 60;
/** Below this many portions sold in the window, a pace estimate is mostly noise. */
const MIN_PORTIONS_IN_WINDOW = 3;

/**
 * Sell-out forecast per dish. Pace is measured per ingredient, not per dish:
 * quesabirrias and tacos dorados both drain birria meat, so a rush on one
 * brings the other's sell-out time forward too.
 */
export function forecast(
  dishes: Dish[],
  ingredients: Ingredient[],
  sales: SaleEvent[],
  now: Date,
  windowMin = DEFAULT_WINDOW_MIN,
): Forecast[] {
  const since = now.getTime() - windowMin * 60_000;
  const recent = sales.filter((s) => s.at.getTime() >= since && s.at.getTime() <= now.getTime());
  const portionsSold = recent.reduce((n, s) => n + s.qty, 0);

  // Use the real span when the day started less than a window ago.
  const firstAt = recent.length ? Math.min(...recent.map((s) => s.at.getTime())) : now.getTime();
  const spanMin = Math.max(15, (now.getTime() - firstAt) / 60_000);

  const usedPerMin = new Map<string, number>();
  if (portionsSold >= MIN_PORTIONS_IN_WINDOW) {
    for (const [id, qty] of usage(recent, dishes)) usedPerMin.set(id, qty / spanMin);
  }
  const stock = new Map(ingredients.map((i) => [i.id, i.stock]));

  return dishes.map((dish) => {
    let soonestMin = Infinity;
    let limiting: string | null = null;
    for (const item of dish.recipe) {
      const rate = usedPerMin.get(item.ingredientId) ?? 0;
      if (rate <= 0) continue;
      // Minutes until there is not enough left for one more portion.
      const usable = Math.max(0, (stock.get(item.ingredientId) ?? 0) - item.qty);
      const minutes = usable / rate;
      if (minutes < soonestMin) {
        soonestMin = minutes;
        limiting = item.ingredientId;
      }
    }
    return {
      dishId: dish.id,
      soldOutAt: Number.isFinite(soonestMin) ? new Date(now.getTime() + soonestMin * 60_000) : null,
      limitingIngredientId: limiting,
    };
  });
}
