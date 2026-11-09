
import "server-only";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";


import type { Dish, Ingredient } from "../inventory";

import {
  cashUp,
  paymentMethod,
  type Reservation,
  type ReservationStatus,
  type Sale,
  type StallState,
} from "../stall";

import type {
  RedeemResult,
  ReserveResult,
  SaleResult,
  StallStore,
  Watch,
} from "./types";

// ==========================================
// TODAVÍA HAY - SUPABASE
// ==========================================

// Los pedidos se confirman al apartar.
// Los pagos se registran cuando el negocio
// valida la entrega y selecciona un método.

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  return (client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  ));
}

function check<T>(
  r: {
    data: T;
    error: { message: string } | null;
  },
  what: string,
): T {
  if (r.error) {
    throw new Error(
      `Supabase ${what}: ${r.error.message}`,
    );
  }

  return r.data;
}

// ==========================================
// TIPOS DE BASE DE DATOS
// ==========================================

type BusinessRow = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  timezone: string;
  is_open: boolean;
  hold_minutes: number;
  stamps_per_reward: number;
  reward_dish_id: string | null;
  updated_at: string;
  settings: import("../stall").StallSettings | null;
};

type ReservationRow = {
  id: string;
  customer_name: string;
  total_cents: number;
  status: ReservationStatus;
  pickup_by: string;
  created_at: string;
  payer_id: string | null;
  pickup_code?: string | null;
  order_number?: number | null;
  pickup_mode?: "asap" | "scheduled";
  pickup_at?: string | null;
  confirmed_at?: string | null;
  ready_at?: string | null;
  no_show?: boolean;
  confirm_asked_at?: string | null;
  prep_alerted_at?: string | null;
  customer_id?: string | null;

  reservation_items: {
    dish_id: string;
    qty: number;
  }[];
};

// ==========================================
// COLUMNAS DE RESERVACIONES
// ==========================================

const RESERVATION_COLS_BASE =
  "id, customer_name, total_cents, status, pickup_by, created_at, payer_id, reservation_items(dish_id, qty)";

const RESERVATION_COLS = [
  `${RESERVATION_COLS_BASE}, pickup_code, order_number, pickup_mode, pickup_at, confirmed_at, ready_at, no_show, confirm_asked_at, prep_alerted_at, customer_id`,
  `${RESERVATION_COLS_BASE}, pickup_code, order_number, pickup_mode, pickup_at, confirmed_at, ready_at, no_show, confirm_asked_at, prep_alerted_at`,
  `${RESERVATION_COLS_BASE}, pickup_code, order_number`,
  `${RESERVATION_COLS_BASE}, pickup_code`,
  RESERVATION_COLS_BASE,
];

async function withPickupCode<
  R extends {
    error: { message: string } | null;
  },
>(
  query: (cols: string) => PromiseLike<R>,
): Promise<R> {
  let result = await query(RESERVATION_COLS[0]);

  for (const cols of RESERVATION_COLS.slice(1)) {
    const missing =
      /pickup_code|order_number|pickup_mode|pickup_at|confirmed_at|ready_at|no_show|confirm_asked_at|prep_alerted_at|customer_id/;

    if (!missing.test(result.error?.message ?? "")) {
      break;
    }

    result = await query(cols);
  }

  return result;
}

// ==========================================
// CONVERTIR RESERVACIONES
// ==========================================

const toReservation = (
  r: ReservationRow,
): Reservation => ({
  id: r.id,
  customerName: r.customer_name,
  totalCents: r.total_cents,
  status: r.status,

  pickupBy: new Date(r.pickup_by).toISOString(),
  createdAt: new Date(r.created_at).toISOString(),

  payerId: r.payer_id,

  pickupCode: r.pickup_code ?? null,
  orderNumber: r.order_number ?? null,
  pickupMode: r.pickup_mode ?? "asap",

  pickupAt: r.pickup_at
    ? new Date(r.pickup_at).toISOString()
    : null,

  confirmedAt: r.confirmed_at ?? null,
  readyAt: r.ready_at ?? null,
  noShow: r.no_show ?? false,
  confirmAskedAt: r.confirm_asked_at ?? null,
  prepAlertedAt: r.prep_alerted_at ?? null,
  customerId: r.customer_id ?? null,

  lines: r.reservation_items.map((line) => ({
    dishId: line.dish_id,
    qty: line.qty,
  })),
});

// ==========================================
// ERRORES DE INVENTARIO
// ==========================================

function stockError(error: {
  message: string;
  details?: string;
}):
  | {
      reason: "closed" | "short";
      short: string[];
    }
  | null {
  if (error.message.includes("closed")) {
    return {
      reason: "closed",
      short: [],
    };
  }

  if (error.message.includes("insufficient_stock")) {
    const detail = error.details ?? "";

    return {
      reason: "short",
      short:
        detail && detail !== "sold_out"
          ? detail.split(",")
          : [],
    };
  }

  return null;
}

// ==========================================
// BUSCAR NEGOCIO
// ==========================================

async function businessBySlug(
  slug: string,
): Promise<BusinessRow | null> {
  return check(
    await db()
      .from("businesses")
      .select("*")
      .eq("slug", slug)
      .maybeSingle(),
    "business",
  );
}

async function activeOnly<
  R extends {
    error: { message: string } | null;
  },
>(
  filtered: PromiseLike<R>,
  all: () => PromiseLike<R>,
): Promise<R> {
  const result = await filtered;

  return result.error?.message.includes("archived")
    ? all()
    : result;
}

// ==========================================
// CARGAR INFORMACIÓN DEL NEGOCIO
// ==========================================

async function load(
  b: BusinessRow,
): Promise<StallState> {
  const recent = new Date(
    Date.now() - 24 * 3600_000,
  ).toISOString();

  const ingredientsQ = () =>
    db()
      .from("ingredients")
      .select("id, name, unit, stock")
      .eq("business_id", b.id)
      .order("name");

  const dishesQ = () =>
    db()
      .from("dishes")
      .select(
        "id, name_es, name_en, image_url, price_cents, sold_out, sort, recipe_items(ingredient_id, qty)",
      )
      .eq("business_id", b.id)
      .order("sort");

  const [ingRes, dishRes, dayRes, resRes] =
    await Promise.all([
      activeOnly(
        ingredientsQ().eq("archived", false),
        ingredientsQ,
      ),

      activeOnly(
        dishesQ().eq("archived", false),
        dishesQ,
      ),

      db()
        .from("days")
        .select("id, opened_at, opening_count")
        .eq("business_id", b.id)
        .order("opened_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle(),

      withPickupCode((cols) =>
        db()
          .from("reservations")
          .select(cols)
          .eq("business_id", b.id)
          .gte("created_at", recent)
          .order("created_at"),
      ),
    ]);

  const reservations = (
    (check(resRes, "reservations") ??
      []) as unknown as ReservationRow[]
  ).map(toReservation);

  // ========================================
  // RECOMPENSAS
  // ========================================

  const payers = [
    ...new Set(
      reservations.flatMap((r) =>
        r.payerId ? [r.payerId] : [],
      ),
    ),
  ];

  const stamps: Record<string, number> =
    Object.fromEntries(
      payers.map((payer) => [payer, 0]),
    );

  type CardRow = {
    payer_id: string;
    label: string | null;
    stamps: number;
    updated_at: string;
  };

  const [recentRes, payerRes] =
    await Promise.all([
      db()
        .from("stamp_cards")
        .select(
          "payer_id, label, stamps, updated_at",
        )
        .eq("business_id", b.id)
        .order("updated_at", {
          ascending: false,
        })
        .limit(50),

      payers.length
        ? db()
            .from("stamp_cards")
            .select(
              "payer_id, label, stamps, updated_at",
            )
            .eq("business_id", b.id)
            .in("payer_id", payers)
        : Promise.resolve({
            data: [] as CardRow[],
            error: null,
          }),
    ]);

  const recentCards = (
    check(recentRes, "stamp cards") ?? []
  ) as CardRow[];

  const payerCards = (
    check(payerRes, "stamp cards") ?? []
  ) as CardRow[];

  for (const card of [
    ...recentCards,
    ...payerCards,
  ]) {
    if (card.payer_id in stamps) {
      stamps[card.payer_id] = card.stamps;
    }
  }

  const cards = recentCards.map((card) => ({
    id: card.payer_id,
    label: card.label,
    stamps: card.stamps,
    updatedAt: new Date(
      card.updated_at,
    ).toISOString(),
  }));

  // ========================================
  // INVENTARIO
  // ========================================

  const ingredients: Ingredient[] = (
    check(ingRes, "ingredients") ?? []
  ).map((ingredient) => ({
    id: ingredient.id,
    name: ingredient.name,
    unit: ingredient.unit,
    stock: Number(ingredient.stock),
  }));

  // ========================================
  // PLATILLOS
  // ========================================

  const dishes: Dish[] = (
    check(dishRes, "dishes") ?? []
  ).map((dish) => ({
    id: dish.id,
    nameEs: dish.name_es,
    nameEn: dish.name_en,
    imageUrl: dish.image_url ?? null,
    priceCents: dish.price_cents,
    soldOut: dish.sold_out,

    recipe: (
      dish.recipe_items as {
        ingredient_id: string;
        qty: number;
      }[]
    ).map((recipe) => ({
      ingredientId: recipe.ingredient_id,
      qty: Number(recipe.qty),
    })),
  }));

  // ========================================
  // JORNADA
  // ========================================

  const day = check(dayRes, "day") as {
    id: string;
    opened_at: string;
    opening_count: Record<string, number>;
  } | null;

  let sales: Sale[] = [];

  if (day) {
    const rows = check(
      await db()
        .from("sales")
        .select(
          "id, method, total_cents, created_at, reservation_id, table_tab_id, sale_items(dish_id, qty)",
        )
        .eq("day_id", day.id)
        .order("created_at"),
      "sales",
    );

    sales = (rows ?? []).map((sale) => ({
      id: sale.id,
      method: paymentMethod(sale.method),
      totalCents: sale.total_cents,
      at: new Date(sale.created_at).toISOString(),
      reservationId: sale.reservation_id,
      tableTabId: sale.table_tab_id,

      lines: (
        sale.sale_items as {
          dish_id: string;
          qty: number;
        }[]
      ).map((line) => ({
        dishId: line.dish_id,
        qty: line.qty,
      })),
    }));
  }

  // ========================================
  // ESTADO COMPLETO
  // ========================================

  return {
    slug: b.slug,
    name: b.name,
    settings: b.settings ?? undefined,
    currency: b.currency,
    timezone: b.timezone,
    isOpen: b.is_open,

    openedAt: day?.opened_at
      ? new Date(day.opened_at).toISOString()
      : null,

    updatedAt: new Date(
      b.updated_at,
    ).toISOString(),

    dishes,
    ingredients,

    openingCount: Object.fromEntries(
      Object.entries(
        day?.opening_count ?? {},
      ).map(([key, value]) => [
        key,
        Number(value),
      ]),
    ),

    sales,
    holdMinutes: b.hold_minutes,
    reservations,

    loyalty: {
      stampsPerReward: b.stamps_per_reward,
      rewardDishId: b.reward_dish_id,
      stamps,
      cards,
    },
  };
}

// ==========================================
// OBTENER NEGOCIO O LANZAR ERROR
// ==========================================

async function must(
  slug: string,
): Promise<BusinessRow> {
  const business = await businessBySlug(slug);

  if (!business) {
    throw new Error(`Unknown stall ${slug}`);
  }

  return business;
}

// ==========================================
// CONVERTIR PRODUCTOS A FORMATO SQL
// ==========================================

const toDbLines = (
  lines: {
    dishId: string;
    qty: number;
  }[],
) =>
  lines.map((line) => ({
    dish_id: line.dishId,
    qty: line.qty,
  }));

// ==========================================
// ALMACENAMIENTO PRINCIPAL
// ==========================================

export const supabaseStore: StallStore = {
  // ========================================
  // CONSULTAR NEGOCIO
  // ========================================

  async get(slug) {
    const business = await businessBySlug(slug);

    return business
      ? load(business)
      : null;
  },

  // ========================================
  // ABRIR JORNADA
  // ========================================

  async open(slug, counts) {
    const business = await must(slug);

    check(
      await db().rpc("open_day", {
        p_business: business.id,
        p_counts: counts,
      }),
      "open_day",
    );

    return load(await must(slug));
  },

  // ========================================
  // CERRAR JORNADA
  // ========================================

  async close(slug) {
    const business = await must(slug);

    const before = await load(business);
    const summary = cashUp(before);

    const snapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      summary,
      dishes: before.dishes,
      ingredients: before.ingredients,
      openingCount: before.openingCount,
    };

    const dayId = check(
      await db().rpc(
        "close_day_with_snapshot",
        {
          p_business: business.id,
          p_snapshot: snapshot,
        },
      ),
      "close_day_with_snapshot",
    ) as string;

    if (!dayId) {
      throw new Error(
        "No se pudo guardar el cierre",
      );
    }

    return {
      state: await load(await must(slug)),
      cashUp: summary,
    };
  },

  // ========================================
  // REGISTRAR VENTA DIRECTA
  // ========================================

  async recordSale(
    slug,
    lines,
    method,
  ): Promise<SaleResult> {
    const business = await must(slug);

    const result = await db().rpc(
      "record_sale",
      {
        p_business: business.id,
        p_lines: toDbLines(lines),
        p_method: method,
      },
    );

    if (result.error) {
      const error = stockError(result.error);

      if (error) {
        return {
          ok: false,
          ...error,
        };
      }

      throw new Error(
        `Supabase record_sale: ${result.error.message}`,
      );
    }

    return {
      ok: true,
      state: await load(await must(slug)),
    };
  },

  // ========================================
  // MARCAR PRODUCTO AGOTADO
  // ========================================

  async setSoldOut(
    slug,
    dishId,
    soldOut,
  ) {
    const business = await must(slug);

    check(
      await db()
        .from("dishes")
        .update({
          sold_out: soldOut,
        })
        .eq("id", dishId)
        .eq("business_id", business.id),
      "sold_out",
    );

    check(
      await db()
        .from("businesses")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", business.id),
      "touch",
    );

    return load(await must(slug));
  },

  // ========================================
  // REABASTECER INVENTARIO
  // ========================================

  async restock(slug, adds) {
    const business = await must(slug);

    const result = await db().rpc(
      "restock",
      {
        p_business: business.id,
        p_adds: adds,
      },
    );

    if (result.error) {
      if (
        result.error.message.includes("closed")
      ) {
        return {
          ok: false,
          reason: "closed",
        };
      }

      throw new Error(
        `Supabase restock: ${result.error.message}`,
      );
    }

    return {
      ok: true,
      state: await load(await must(slug)),
    };
  },

  // ========================================
  // GUARDAR MENÚ
  // ========================================

  async saveMenu(slug, menu) {
    const business = await must(slug);

    const result = await db().rpc(
      "save_menu",
      {
        p_business: business.id,
        p_ingredients: menu.ingredients,

        p_dishes: menu.dishes.map((dish) => ({
          id: dish.id,
          name_es: dish.nameEs,
          name_en: dish.nameEn,
          image_url:
            dish.imageUrl?.trim() || null,
          price_cents: dish.priceCents,
          recipe: dish.recipe,
        })),
      },
    );

    if (result.error) {
      throw new Error(
        `Supabase save_menu: ${result.error.message}`,
      );
    }

    return load(await must(slug));
  },

  // ========================================
  // GUARDAR CONFIGURACIÓN
  // ========================================

  async saveSettings(slug, input) {
    const business = await must(slug);

    const name = input.name.trim();

    if (!name || name.length > 120) {
      throw new Error("Invalid business name");
    }

    const updatedAt = new Date().toISOString();

    check(
      await db()
        .from("businesses")
        .update({
          name,
          settings: input.settings,
          updated_at: updatedAt,
        })
        .eq("id", business.id),
      "save business settings",
    );

    return load(await must(slug));
  },

  // ========================================
  // CREAR RESERVACIÓN
  // ========================================

  async reserve(
    slug,
    customerName,
    lines,
    pickupBy,
  ): Promise<ReserveResult> {
    const business = await must(slug);

    const result = await db().rpc(
      "reserve",
      {
        p_business: business.id,
        p_customer: customerName,
        p_lines: toDbLines(lines),
        p_pickup_by: pickupBy.toISOString(),
      },
    );

    if (result.error) {
      const error = stockError(result.error);

      if (error) {
        return {
          ok: false,
          ...error,
        };
      }

      throw new Error(
        `Supabase reserve: ${result.error.message}`,
      );
    }

    const created = await this.getReservation(
      slug,
      result.data as string,
    );

    if (!created) {
      throw new Error(
        "Supabase reserve: reservation not found after insert",
      );
    }

    return {
      ok: true,
      reservation: created,
    };
  },

  // ========================================
  // CONSULTAR RESERVACIÓN
  // ========================================

  async getReservation(slug, id) {
    const business = await must(slug);

    const row = check(
      await withPickupCode((cols) =>
        db()
          .from("reservations")
          .select(cols)
          .eq("id", id)
          .eq("business_id", business.id)
          .maybeSingle(),
      ),
      "reservation",
    ) as unknown as ReservationRow | null;

    return row
      ? toReservation(row)
      : null;
  },

  // ========================================
  // CONFIRMAR PEDIDO
  // ========================================

  async markAuthorized(
    slug,
    id,
    payerId,
  ) {
    const business = await must(slug);

    // El pedido pasa de held a authorized.
    // Esto NO significa que ya esté pagado.
    // payer_id es la tarjeta de sellos.

    const result = await db()
      .from("reservations")
      .update({
        status: "authorized",
        payer_id: payerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", business.id)
      .eq("status", "held")
      .select("id")
      .maybeSingle();

    check(result, "confirm reservation");

    if (!result.data) {
      throw new Error(
        "La reservación no está pendiente de confirmación.",
      );
    }
  },

  // ========================================
  // ENTREGAR PEDIDO Y REGISTRAR PAGO
  // ========================================

  async markDelivered(
    slug,
    id,
    method,
  ) {
    if (
      method !== "cash" &&
      method !== "card" &&
      method !== "transfer"
    ) {
      return false;
    }

    const business = await must(slug);

    // Comprobar que el pedido pertenece
    // al negocio y está confirmado.

    const current = check(
      await db()
        .from("reservations")
        .select("id, status")
        .eq("id", id)
        .eq("business_id", business.id)
        .maybeSingle(),
      "get delivery reservation",
    );

    if (
      !current ||
      current.status !== "authorized"
    ) {
      return false;
    }

    // El servidor debe haber validado el NIP
    // y los permisos antes de llamar al método.
    //
    // Registrar pago y entrega mediante
    // la función SQL transaccional.

    const saleId = check(
      await db().rpc(
        "deliver_reservation_with_method",
        {
          p_reservation: id,
          p_method: method,
        },
      ),
      "deliver",
    );

    return saleId != null;
  },

  // ========================================
  // CANCELAR RESERVACIÓN
  // ========================================

  async release(
    slug,
    id,
    status,
  ) {
    await must(slug);

    return Boolean(
      check(
        await db().rpc(
          "release_reservation",
          {
            p_reservation: id,
            p_status: status,
          },
        ),
        "release",
      ),
    );
  },

  // ========================================
  // CONSULTAR SELLOS
  // ========================================

  async stamps(
    slug,
    cardId,
  ) {
    const business = await must(slug);

    const card = check(
      await db()
        .from("stamp_cards")
        .select("stamps")
        .eq("business_id", business.id)
        .eq("payer_id", cardId)
        .maybeSingle(),
      "stamp card",
    ) as {
      stamps: number;
    } | null;

    return card?.stamps ?? 0;
  },

  // ========================================
  // AGREGAR SELLOS
  // ========================================

  async addStamp(
    slug,
    cardId,
    label,
  ) {
    const business = await must(slug);

    return check(
      await db().rpc(
        "add_stamp",
        {
          p_business: business.id,
          p_card: cardId,
          p_label: label ?? "",
        },
      ),
      "add_stamp",
    ) as number;
  },

  // ========================================
  // CANJEAR RECOMPENSA
  // ========================================

  async redeem(
    slug,
    cardId,
  ): Promise<RedeemResult> {
    const business = await must(slug);

    const result = await db().rpc(
      "redeem_reward",
      {
        p_business: business.id,
        p_payer: cardId,
      },
    );

    if (result.error) {
      if (
        result.error.message.includes(
          "not_enough_stamps",
        )
      ) {
        return {
          ok: false,
          reason: "not_enough",
        };
      }

      if (
        result.error.message.includes(
          "no_reward",
        )
      ) {
        return {
          ok: false,
          reason: "no_reward",
        };
      }

      const error = stockError(result.error);

      if (error) {
        return {
          ok: false,
          reason: error.reason,
        };
      }

      throw new Error(
        `Supabase redeem_reward: ${result.error.message}`,
      );
    }

    return {
      ok: true,
      stampsLeft: result.data as number,
    };
  },

  // ========================================
  // SUSCRIPCIONES DE NOTIFICACIONES
  // ========================================

  async addWatch(
    slug,
    watch,
  ) {
    const business = await must(slug);

    check(
      await db().rpc(
        "add_watch",
        {
          p_business: business.id,
          p_dish: watch.dishId,
          p_endpoint: watch.endpoint,
          p_p256dh: watch.p256dh,
          p_auth: watch.auth,
          p_lang: watch.lang,
        },
      ),
      "add_watch",
    );
  },

  // ========================================
  // AVISOS DE DISPONIBILIDAD
  // ========================================

  async claimWatches(
    slug,
    open,
    dishIds,
  ): Promise<Watch[]> {
    const business = await must(slug);

    const rows = check(
      await db().rpc(
        "claim_watches",
        {
          p_business: business.id,
          p_open: open,
          p_dishes: dishIds,
        },
      ),
      "claim_watches",
    ) as {
      dish_id: string | null;
      endpoint: string;
      p256dh: string;
      auth: string;
      lang: "es" | "en";
    }[];

    return (rows ?? []).map((watch) => ({
      dishId: watch.dish_id,
      endpoint: watch.endpoint,
      p256dh: watch.p256dh,
      auth: watch.auth,
      lang: watch.lang,
    }));
  },

  // ========================================
  // ACTUALIZAR DATOS DE RECOGIDA
  // ========================================

  async updatePickup(
    slug,
    id,
    patch,
  ) {
    const business = await must(slug);

    const cols: Record<string, unknown> = {};

    if (patch.pickupMode !== undefined) {
      cols.pickup_mode = patch.pickupMode;
    }

    if (patch.pickupAt !== undefined) {
      cols.pickup_at = patch.pickupAt;
    }

    if (patch.confirmedAt !== undefined) {
      cols.confirmed_at = patch.confirmedAt;
    }

    if (patch.readyAt !== undefined) {
      cols.ready_at = patch.readyAt;
    }

    if (patch.noShow !== undefined) {
      cols.no_show = patch.noShow;
    }

    if (patch.confirmAskedAt !== undefined) {
      cols.confirm_asked_at = patch.confirmAskedAt;
    }

    if (patch.prepAlertedAt !== undefined) {
      cols.prep_alerted_at = patch.prepAlertedAt;
    }

    if (patch.customerId !== undefined) {
      cols.customer_id = patch.customerId;
    }

    if (!Object.keys(cols).length) {
      return;
    }

    check(
      await db()
        .from("reservations")
        .update(cols)
        .eq("id", id)
        .eq("business_id", business.id),
      "update pickup",
    );
  },

  // ========================================
  // GUARDAR NOTIFICACIONES PUSH
  // ========================================

  async savePush(
    slug,
    target,
  ) {
    const business = await must(slug);

    check(
      await db()
        .from("pickup_push")
        .upsert(
          {
            business_id: business.id,
            reservation_id: target.reservationId,
            endpoint: target.endpoint,
            p256dh: target.p256dh,
            auth: target.auth,
            lang: target.lang,
          },
          {
            onConflict:
              "business_id,reservation_id,endpoint",
          },
        ),
      "save push",
    );
  },

  // ========================================
  // CONSULTAR NOTIFICACIONES PUSH
  // ========================================

  async pushTargets(
    slug,
    reservationId,
  ) {
    const business = await must(slug);

    let q = db()
      .from("pickup_push")
      .select(
        "reservation_id, endpoint, p256dh, auth, lang",
      )
      .eq("business_id", business.id);

    q = reservationId
      ? q.eq("reservation_id", reservationId)
      : q.is("reservation_id", null);

    const rows = check(
      await q,
      "push targets",
    ) as {
      reservation_id: string | null;
      endpoint: string;
      p256dh: string;
      auth: string;
      lang: "es" | "en";
    }[];

    return rows.map((r) => ({
      reservationId: r.reservation_id,
      endpoint: r.endpoint,
      p256dh: r.p256dh,
      auth: r.auth,
      lang: r.lang,
    }));
  },

  // ========================================
  // ELIMINAR SUSCRIPCIÓN PUSH
  // ========================================

  async dropPush(
    slug,
    endpoint,
  ) {
    const business = await must(slug);

    check(
      await db()
        .from("pickup_push")
        .delete()
        .eq("business_id", business.id)
        .eq("endpoint", endpoint),
      "drop push",
    );
  },
};
