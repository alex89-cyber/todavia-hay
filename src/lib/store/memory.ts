
import {
  DEMO_OPENED_MINUTES_AGO,
  demoDishes,
  demoIngredients,
  demoSeedSales,
} from "../demo-data";

import {
  canFulfill,
  deduct,
  orderTotalCents,
  restore,
} from "../inventory";

import {
  cashUp,
  isActive,
  newPickupCode,
  nextOrderNumber,
  type Reservation,
  type Sale,
  type StallState,
  type StampCard,
} from "../stall";

import type {
  StallStore,
  Watch,
  PushTarget,
} from "./types";

// ==========================================
// TODAVÍA HAY - ALMACENAMIENTO EN MEMORIA
// ==========================================

// Este almacenamiento sirve para demostraciones
// y para ejecutar el proyecto sin Supabase.
// Los datos se reinician al reiniciar el servidor.

const DEMO_SLUG = "birria-dona-lupe";

// ==========================================
// CREAR DATOS DE DEMOSTRACIÓN
// ==========================================

export function seedDemo(now = new Date()): StallState {
  const openedAt = new Date(
    now.getTime() - DEMO_OPENED_MINUTES_AGO * 60_000
  );

  const sales: Sale[] = [];

  let ingredients = demoIngredients.map((i) => ({
    ...i,
  }));

  demoSeedSales().forEach((seed, k) => {
    const lines = [
      {
        dishId: seed.dishId,
        qty: seed.qty,
      },
    ];

    ingredients = deduct(
      lines,
      demoDishes,
      ingredients
    );

    sales.push({
      id: `seed-${k}`,
      lines,
      method: seed.method,
      totalCents: orderTotalCents(
        lines,
        demoDishes
      ),
      at: new Date(
        now.getTime() - seed.minutesAgo * 60_000
      ).toISOString(),
    });
  });

  return {
    slug: DEMO_SLUG,
    name: "Birria Doña Lupe",
    currency: "MXN",
    timezone: "America/Mexico_City",

    isOpen: true,
    openedAt: openedAt.toISOString(),
    updatedAt: sales.at(-1)!.at,

    dishes: demoDishes.map((d) => ({
      ...d,
      recipe: d.recipe.map((r) => ({
        ...r,
      })),
    })),

    ingredients,

    openingCount: Object.fromEntries(
      demoIngredients.map((i) => [
        i.id,
        i.stock,
      ])
    ),

    sales,
    holdMinutes: 45,
    reservations: [],

    loyalty: {
      stampsPerReward: 10,
      rewardDishId: "quesabirria",
      stamps: {},
      cards: [],
    },

    settings: undefined,
  };
}

// ==========================================
// ALMACENAMIENTO GLOBAL
// ==========================================

const g = globalThis as unknown as {
  __stalls?: Map<string, StallState>;
  __cards?: Map<
    string,
    StampCard & { slug: string }
  >;
  __watches?: Map<string, Watch[]>;
  __pushes?: Map<string, PushTarget[]>;
};

const stalls = (
  g.__stalls ??= new Map([
    [DEMO_SLUG, seedDemo()],
  ])
);

const cards = (
  g.__cards ??= new Map<
    string,
    StampCard & { slug: string }
  >()
);

const watches = (
  g.__watches ??= new Map<string, Watch[]>()
);

const pushes = (
  g.__pushes ??= new Map<string, PushTarget[]>()
);

// ==========================================
// TARJETAS DE RECOMPENSAS
// ==========================================

const cardKey = (
  slug: string,
  payerId: string
) => `${slug}\u0000${payerId}`;

const stampsOf = (
  slug: string,
  id: string
) =>
  cards.get(
    cardKey(slug, id)
  )?.stamps ?? 0;

function stamp(
  slug: string,
  id: string,
  label: string | null,
  delta: number
): number {
  const cur = cards.get(
    cardKey(slug, id)
  );

  const next = {
    slug,
    id,
    label: label || cur?.label || null,
    stamps: (cur?.stamps ?? 0) + delta,
    updatedAt: new Date().toISOString(),
  };

  cards.set(
    cardKey(slug, id),
    next
  );

  return next.stamps;
}

// ==========================================
// CONSULTAR TARJETAS
// ==========================================

function withStamps(
  s: StallState
): StallState {
  const stamps: Record<string, number> = {};

  for (const r of s.reservations) {
    if (r.payerId) {
      stamps[r.payerId] = stampsOf(
        s.slug,
        r.payerId
      );
    }
  }

  const recent = [
    ...cards.values(),
  ]
    .filter((c) => c.slug === s.slug)
    .sort((a, b) =>
      b.updatedAt.localeCompare(
        a.updatedAt
      )
    )
    .slice(0, 50)
    .map(({
      id,
      label,
      stamps,
      updatedAt,
    }) => ({
      id,
      label,
      stamps,
      updatedAt,
    }));

  s.loyalty = {
    ...s.loyalty,
    stamps,
    cards: recent,
  };

  return s;
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function must(slug: string): StallState {
  const s = stalls.get(slug);

  if (!s) {
    throw new Error(
      `Unknown stall ${slug}`
    );
  }

  return s;
}

function reservation(
  s: StallState,
  id: string
): Reservation | undefined {
  return s.reservations.find(
    (r) => r.id === id
  );
}

function save(s: StallState): StallState {
  s.updatedAt = new Date().toISOString();

  stalls.set(s.slug, s);

  return s;
}

// ==========================================
// ALMACENAMIENTO PRINCIPAL
// ==========================================

/** Local dev and tests only: `reset` brings the demo stall back to a seeded day. */
export const memoryStore: StallStore & { reset(slug: string): Promise<StallState> } = {

  // ========================================
  // OBTENER NEGOCIO
  // ========================================

  async get(slug) {
    const s = stalls.get(slug);

    return s ? withStamps(s) : null;
  },

  // ========================================
  // ABRIR JORNADA
  // ========================================

  async open(slug, counts) {
    const s = must(slug);

    s.ingredients = s.ingredients.map(
      (i) => ({
        ...i,
        stock: Math.max(
          0,
          counts[i.id] ?? i.stock
        ),
      })
    );

    s.openingCount = Object.fromEntries(
      s.ingredients.map((i) => [
        i.id,
        i.stock,
      ])
    );

    s.dishes = s.dishes.map((d) => ({
      ...d,
      soldOut: false,
    }));

    s.sales = [];
    s.isOpen = true;
    s.openedAt = new Date().toISOString();

    return save(s);
  },

  // ========================================
  // CERRAR JORNADA
  // ========================================

  async close(slug) {
    const s = must(slug);

    const summary = cashUp(s);

    s.isOpen = false;

    return {
      state: save(s),
      cashUp: summary,
    };
  },

  // ========================================
  // REGISTRAR VENTA DIRECTA
  // ========================================

  async recordSale(
    slug,
    lines,
    method
  ) {
    const s = must(slug);

    if (!s.isOpen) {
      return {
        ok: false,
        reason: "closed",
      };
    }

    const check = canFulfill(
      lines,
      s.dishes,
      s.ingredients
    );

    if (!check.ok) {
      return {
        ok: false,
        reason: "short",
        short: check.shortIngredientIds,
      };
    }

    s.ingredients = deduct(
      lines,
      s.dishes,
      s.ingredients
    );

    s.sales.push({
      id: crypto.randomUUID(),
      lines,
      method,
      totalCents: orderTotalCents(
        lines,
        s.dishes
      ),
      at: new Date().toISOString(),
    });

    return {
      ok: true,
      state: save(s),
    };
  },

  // ========================================
  // MARCAR PRODUCTO AGOTADO
  // ========================================

  async setSoldOut(
    slug,
    dishId,
    soldOut
  ) {
    const s = must(slug);

    s.dishes = s.dishes.map((d) =>
      d.id === dishId
        ? { ...d, soldOut }
        : d
    );

    return save(s);
  },

  // ========================================
  // REABASTECER INVENTARIO
  // ========================================

  async restock(slug, adds) {
    const s = must(slug);

    if (!s.isOpen) {
      return {
        ok: false,
        reason: "closed",
      };
    }

    const added = new Set(
      Object.entries(adds)
        .filter(([, n]) => n > 0)
        .map(([id]) => id)
    );

    s.ingredients = s.ingredients.map((i) =>
      added.has(i.id)
        ? {
            ...i,
            stock: i.stock + adds[i.id],
          }
        : i
    );

    for (const id of added) {
      s.openingCount[id] =
        (s.openingCount[id] ?? 0) +
        adds[id];
    }

    s.dishes = s.dishes.map((d) =>
      d.recipe.some((r) =>
        added.has(r.ingredientId)
      )
        ? { ...d, soldOut: false }
        : d
    );

    return {
      ok: true,
      state: withStamps(save(s)),
    };
  },

  // ========================================
  // GUARDAR MENÚ
  // ========================================

  async saveMenu(slug, menu) {
    const s = must(slug);

    const ids = new Map<string, string>();

    const stock = new Map(
      s.ingredients.map((i) => [
        i.id,
        i,
      ])
    );

    s.ingredients = menu.ingredients.map(
      (i) => {
        const id = stock.has(i.key)
          ? i.key
          : crypto.randomUUID();

        ids.set(i.key, id);

        return {
          id,
          name: i.name,
          unit: i.unit,
          stock: stock.get(i.key)?.stock ?? 0,
        };
      }
    );

    const old = new Map(
      s.dishes.map((d) => [
        d.id,
        d,
      ])
    );

    const sectionIds = new Map<string, string>();
    if (menu.sections) {
      const oldSections = new Set((s.sections ?? []).map((x) => x.id));
      s.sections = menu.sections.map((x) => {
        const id = oldSections.has(x.key) ? x.key : crypto.randomUUID();
        sectionIds.set(x.key, id);
        return { id, name: x.name, toKitchen: x.toKitchen };
      });
    }

    s.dishes = menu.dishes.map((d) => ({
      sectionId: menu.sections
        ? d.section
          ? (sectionIds.get(d.section) ?? null)
          : null
        : (d.id ? (old.get(d.id)?.sectionId ?? null) : null),

      id:
        d.id && old.has(d.id)
          ? d.id
          : crypto.randomUUID(),

      nameEs: d.nameEs,
      nameEn: d.nameEn,
      imageUrl: d.imageUrl,
      priceCents: d.priceCents,

      soldOut:
        (d.id && old.get(d.id)?.soldOut) ||
        false,

      recipe: d.recipe.flatMap((r) =>
        ids.has(r.ingredient)
          ? [
              {
                ingredientId:
                  ids.get(r.ingredient)!,
                qty: r.qty,
              },
            ]
          : []
      ),
    }));

    return withStamps(save(s));
  },

  // ========================================
  // GUARDAR CONFIGURACIÓN
  // ========================================

  async saveSettings(slug, input) {
    const s = must(slug);

    s.name = input.name;

    s.settings = structuredClone(
      input.settings
    );

    return withStamps(save(s));
  },

  // ========================================
  // REINICIAR DEMOSTRACIÓN
  // ========================================

  async reset(slug) {
    if (slug !== DEMO_SLUG) {
      return must(slug);
    }

    const current = must(slug);
    const fresh = seedDemo();

    fresh.name = current.name;

    fresh.settings = current.settings
      ? structuredClone(current.settings)
      : undefined;

    return save(fresh);
  },

  // ========================================
  // CREAR RESERVACIÓN
  // ========================================

  async reserve(
    slug,
    customerName,
    lines,
    pickupBy
  ) {
    const s = must(slug);

    if (!s.isOpen) {
      return {
        ok: false,
        reason: "closed",
      };
    }

    const check = canFulfill(
      lines,
      s.dishes,
      s.ingredients
    );

    if (!check.ok) {
      return {
        ok: false,
        reason: "short",
        short: check.shortIngredientIds,
      };
    }

    s.ingredients = deduct(
      lines,
      s.dishes,
      s.ingredients
    );

    const r: Reservation = {
      id: crypto.randomUUID(),
      customerName,

      pickupCode: newPickupCode(
        s.reservations
      ),

      pickupMode: "asap",
      pickupAt: null,
      confirmedAt: null,
      readyAt: null,
      noShow: false,
      confirmAskedAt: null,
      prepAlertedAt: null,
      customerId: null,

      orderNumber: nextOrderNumber(
        s.reservations,
        s.openedAt
      ),

      lines,

      totalCents: orderTotalCents(
        lines,
        s.dishes
      ),

      status: "held",
      pickupBy: pickupBy.toISOString(),
      createdAt: new Date().toISOString(),

      payerId: null,
    };

    s.reservations.push(r);

    save(s);

    return {
      ok: true,
      reservation: { ...r },
    };
  },

  // ========================================
  // OBTENER RESERVACIÓN
  // ========================================

  async getReservation(slug, id) {
    const r = reservation(
      must(slug),
      id
    );

    return r ? { ...r } : null;
  },

  // ========================================
  // CONFIRMAR PEDIDO SIN COBRAR
  // ========================================

  async markAuthorized(
    slug,
    id,
    payerId
  ) {
    const s = must(slug);
    const r = reservation(s, id);

    if (r?.status !== "held") {
      return;
    }

    // Authorized significa pedido confirmado.
    // No significa que ya esté pagado.
    r.status = "authorized";

    r.payerId = payerId;

    save(s);
  },

  // ========================================
  // ENTREGAR PEDIDO Y REGISTRAR PAGO
  // ========================================

  async markDelivered(
    slug,
    id,
    method
  ) {
    const s = must(slug);
    const r = reservation(s, id);

    // Solo entregar pedidos confirmados.
    if (!r || r.status !== "authorized") {
      return false;
    }

    // Métodos permitidos.
    if (
      method !== "cash" &&
      method !== "card" &&
      method !== "transfer"
    ) {
      return false;
    }

    // Marcar el pedido como entregado.
    r.status = "captured";

    // Registrar venta con el método real.
    s.sales.push({
      id: crypto.randomUUID(),
      lines: r.lines,
      method,
      totalCents: r.totalCents,
      at: new Date().toISOString(),
      reservationId: r.id,
    });

    // Mantener recompensas del cliente.
    if (r.payerId) {
      stamp(
        slug,
        r.payerId,
        r.customerName,
        1
      );
    }

    save(s);

    return true;
  },

  // ========================================
  // CANCELAR PEDIDO
  // ========================================

  async release(
    slug,
    id,
    status
  ) {
    const s = must(slug);
    const r = reservation(s, id);

    if (!r || !isActive(r)) {
      return false;
    }

    r.status = status;

    // Devolver inventario reservado.
    s.ingredients = restore(
      r.lines,
      s.dishes,
      s.ingredients
    );

    save(s);

    return true;
  },

  async setLineNotes(slug, id, lines) {
    const s = must(slug);
    const r = reservation(s, id);
    if (!r) return;
    const notes = new Map(lines.map((l) => [l.dishId, l.note?.trim() || null]));
    r.lines = r.lines.map((l) =>
      notes.has(l.dishId) ? { ...l, note: notes.get(l.dishId) } : l,
    );
    save(s);
  },

  async noShow(slug, id) {
    const s = must(slug);
    const r = reservation(s, id);

    if (!r || r.status !== "authorized") {
      return false;
    }

    r.status = "expired";
    r.noShow = true;
    save(s);

    return true;
  },

  // ========================================
  // CONSULTAR SELLOS
  // ========================================

  async stamps(
    slug,
    cardId
  ) {
    return stampsOf(slug, cardId);
  },

  // ========================================
  // AGREGAR SELLO
  // ========================================

  async addStamp(
    slug,
    cardId,
    label
  ) {
    must(slug);

    const n = stamp(
      slug,
      cardId,
      label,
      1
    );

    save(must(slug));

    return n;
  },

  // ========================================
  // CANJEAR RECOMPENSAS
  // ========================================

  async redeem(
    slug,
    cardId
  ) {
    const s = must(slug);

    const {
      stampsPerReward,
      rewardDishId,
    } = s.loyalty;

    if (!s.isOpen) {
      return {
        ok: false,
        reason: "closed",
      };
    }

    if (!rewardDishId) {
      return {
        ok: false,
        reason: "no_reward",
      };
    }

    const have = stampsOf(
      slug,
      cardId
    );

    if (have < stampsPerReward) {
      return {
        ok: false,
        reason: "not_enough",
      };
    }

    const lines = [
      {
        dishId: rewardDishId,
        qty: 1,
      },
    ];

    if (
      s.dishes.find(
        (d) => d.id === rewardDishId
      )?.soldOut ||
      !canFulfill(
        lines,
        s.dishes,
        s.ingredients
      ).ok
    ) {
      return {
        ok: false,
        reason: "short",
      };
    }

    s.ingredients = deduct(
      lines,
      s.dishes,
      s.ingredients
    );

    stamp(
      slug,
      cardId,
      null,
      -stampsPerReward
    );

    save(s);

    return {
      ok: true,
      stampsLeft:
        have - stampsPerReward,
    };
  },

  // ========================================
  // SUSCRIPCIONES PUSH
  // ========================================

  async addWatch(slug, watch) {
    must(slug);

    const list = (
      watches.get(slug) ?? []
    ).filter(
      (w) =>
        !(
          w.endpoint === watch.endpoint &&
          w.dishId === watch.dishId
        )
    );

    watches.set(slug, [
      ...list,
      watch,
    ]);
  },

  // ========================================
  // NOTIFICAR DISPONIBILIDAD
  // ========================================

  async claimWatches(
    slug,
    open,
    dishIds
  ) {
    const due = (w: Watch) =>
      w.dishId === null
        ? open
        : dishIds.includes(w.dishId);

    const list = watches.get(slug) ?? [];

    watches.set(
      slug,
      list.filter((w) => !due(w))
    );

    return list.filter(due);
  },

  // ========================================
  // ACTUALIZAR ESTADO DE RECOGIDA
  // ========================================

  async updatePickup(
    slug,
    id,
    patch
  ) {
    const s = must(slug);
    const r = reservation(s, id);

    if (!r) return;

    Object.assign(r, patch);

    save(s);
  },

  // ========================================
  // GUARDAR SUSCRIPCIÓN PUSH
  // ========================================

  async savePush(slug, target) {
    must(slug);

    const list = (
      pushes.get(slug) ?? []
    ).filter(
      (p) =>
        !(
          p.endpoint === target.endpoint &&
          p.reservationId === target.reservationId
        )
    );

    pushes.set(slug, [
      ...list,
      { ...target },
    ]);
  },

  // ========================================
  // CONSULTAR SUSCRIPCIONES PUSH
  // ========================================

  async pushTargets(
    slug,
    reservationId
  ) {
    return (
      pushes.get(slug) ?? []
    )
      .filter(
        (p) =>
          p.reservationId === reservationId
      )
      .map((p) => ({ ...p }));
  },

  // ========================================
  // ELIMINAR SUSCRIPCIÓN PUSH
  // ========================================

  async dropPush(slug, endpoint) {
    pushes.set(
      slug,
      (pushes.get(slug) ?? []).filter(
        (p) => p.endpoint !== endpoint
      )
    );
  },
};
