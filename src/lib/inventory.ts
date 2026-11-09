
/**
 * Pure inventory logic.
 * No I/O. Runs on the server, in agent tools and tests.
 */

export type Ingredient = {
  id: string;
  name: string;
  unit: string;
  /** Current stock, in unit. */
  stock: number;
};

export type RecipeItem = {
  ingredientId: string;
  qty: number;
};

export type Dish = {
  id: string;
  nameEs: string;
  nameEn: string;

  /**
   * Optional for compatibility with old demo data.
   * New dishes may store a Supabase Storage image URL.
   */
  imageUrl?: string | null;

  priceCents: number;
  soldOut: boolean;
  recipe: RecipeItem[];

  /** Sección del menú; null = "Otros". */
  sectionId?: string | null;
};

export type Availability = {
  dishId: string;

  /** Whole portions that can still be made. */
  portions: number;

  /** Ingredient that runs out first, if any. */
  limitingIngredientId: string | null;
};

/** RN-04: portions left per dish. */
export function availability(
  dish: Dish,
  stock: Map<string, number>,
): Availability {
  if (dish.soldOut || dish.recipe.length === 0) {
    return {
      dishId: dish.id,
      portions: 0,
      limitingIngredientId: null,
    };
  }

  let portions = Infinity;
  let limiting: string | null = null;

  for (const item of dish.recipe) {
    const left = stock.get(item.ingredientId) ?? 0;

    const n =
      item.qty > 0
        ? Math.floor(left / item.qty + 1e-9)
        : Infinity;

    if (n < portions) {
      portions = n;
      limiting = item.ingredientId;
    }
  }

  return {
    dishId: dish.id,
    portions: Number.isFinite(portions)
      ? Math.max(0, portions)
      : 0,
    limitingIngredientId: limiting,
  };
}

export function stockMap(
  ingredients: Ingredient[],
): Map<string, number> {
  return new Map(
    ingredients.map((ingredient) => [
      ingredient.id,
      ingredient.stock,
    ]),
  );
}

export function menuAvailability(
  dishes: Dish[],
  ingredients: Ingredient[],
): Availability[] {
  const stock = stockMap(ingredients);

  return dishes.map((dish) =>
    availability(dish, stock),
  );
}

export type OrderLine = {
  dishId: string;
  qty: number;
};

/**
 * Ingredient usage for a set of order lines,
 * summed per ingredient.
 */
export function usage(
  lines: OrderLine[],
  dishes: Dish[],
): Map<string, number> {
  const byId = new Map(
    dishes.map((dish) => [dish.id, dish]),
  );

  const total = new Map<string, number>();

  for (const line of lines) {
    const dish = byId.get(line.dishId);

    if (!dish) {
      throw new Error(`Unknown dish ${line.dishId}`);
    }

    for (const item of dish.recipe) {
      total.set(
        item.ingredientId,
        (total.get(item.ingredientId) ?? 0) +
          item.qty * line.qty,
      );
    }
  }

  return total;
}

/**
 * Checks that a counter sale or reservation fits
 * current stock. Shared ingredients are counted
 * across all order lines.
 */
export function canFulfill(
  lines: OrderLine[],
  dishes: Dish[],
  ingredients: Ingredient[],
):
  | { ok: true }
  | {
      ok: false;
      shortIngredientIds: string[];
    } {
  const byId = new Map(
    dishes.map((dish) => [dish.id, dish]),
  );

  if (
    lines.some(
      (line) => byId.get(line.dishId)?.soldOut,
    )
  ) {
    return {
      ok: false,
      shortIngredientIds: [],
    };
  }

  const stock = stockMap(ingredients);

  const short = [...usage(lines, dishes)]
    .filter(
      ([id, needed]) =>
        needed > (stock.get(id) ?? 0) + 1e-9,
    )
    .map(([id]) => id);

  return short.length
    ? {
        ok: false,
        shortIngredientIds: short,
      }
    : { ok: true };
}

/**
 * Stock after taking order lines out.
 * Negative results are clamped to zero.
 */
export function deduct(
  lines: OrderLine[],
  dishes: Dish[],
  ingredients: Ingredient[],
): Ingredient[] {
  const used = usage(lines, dishes);

  return ingredients.map((ingredient) => ({
    ...ingredient,
    stock: Math.max(
      0,
      ingredient.stock -
        (used.get(ingredient.id) ?? 0),
    ),
  }));
}

/** Restore stock from a voided or expired hold. */
export function restore(
  lines: OrderLine[],
  dishes: Dish[],
  ingredients: Ingredient[],
): Ingredient[] {
  const used = usage(lines, dishes);

  return ingredients.map((ingredient) => ({
    ...ingredient,
    stock:
      ingredient.stock +
      (used.get(ingredient.id) ?? 0),
  }));
}

export function orderTotalCents(
  lines: OrderLine[],
  dishes: Dish[],
): number {
  const byId = new Map(
    dishes.map((dish) => [dish.id, dish]),
  );

  return lines.reduce(
    (sum, line) =>
      sum +
      (byId.get(line.dishId)?.priceCents ?? 0) *
        line.qty,
    0,
  );
}
