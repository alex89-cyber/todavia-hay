
import { forecast, type SaleEvent } from "./forecast";
import type { GalleryPhoto } from "./gallery";

import {
  type Dish,
  type Ingredient,
  type OrderLine,
  menuAvailability,
} from "./inventory";

// ==========================================
// VENTAS Y RESERVACIONES
// ==========================================

// Métodos de pago aceptados.
export type PaymentMethod =
  | "cash"
  | "card"
  | "transfer";

/** Lee el método guardado; un valor desconocido cuenta como tarjeta. */
export function paymentMethod(
  value: string,
): PaymentMethod {
  return value === "cash" || value === "transfer"
    ? value
    : "card";
}

export type Sale = {
  id: string;
  lines: OrderLine[];
  method: PaymentMethod;
  totalCents: number;
  at: string;
  /** Pedido apartado del que viene la venta, si lo hay. */
  reservationId?: string | null;
  /** Cuenta de mesa de la que viene la venta, si la hay. */
  tableTabId?: string | null;
};

export type ReservationStatus =
  | "held"
  | "authorized"
  | "captured"
  | "voided"
  | "expired";

export type Reservation = {
  id: string;
  customerName: string;
  lines: OrderLine[];
  totalCents: number;
  status: ReservationStatus;
  pickupBy: string;
  createdAt: string;

  /** Tarjeta de sellos del cliente (cuenta o teléfono). */
  payerId: string | null;

  /** Código de cuatro dígitos para recoger. */
  pickupCode: string | null;

  /** Número público del pedido. */
  orderNumber: number | null;

  /** Modalidad de recogida. */
  pickupMode: "asap" | "scheduled";

  /** Hora estimada o programada. */
  pickupAt: string | null;

  /** Confirmación del cliente. */
  confirmedAt: string | null;

  /** Hora en que el pedido quedó listo. */
  readyAt: string | null;

  /** Indica si el cliente no recogió. */
  noShow: boolean;

  /** Notificaciones enviadas. */
  confirmAskedAt: string | null;
  prepAlertedAt: string | null;

  /** Cuenta del cliente que reservó. */
  customerId: string | null;

  /** Comer aquí: aparta comida y lugar (sin mesa fija). */
  dineIn?: boolean;
  partySize?: number | null;

  /** Cuenta de mesa a la que se pasó al llegar. */
  tableTabId?: string | null;
};

// ==========================================
// NIP Y DATOS DEL CLIENTE
// ==========================================

export const HIDDEN_CODE = "****";

const plain = (x: string) =>
  x
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();

// Mostrar nombre abreviado.
export function shortName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);

  return rest.length
    ? `${first} ${rest[0][0].toUpperCase()}.`
    : (first ?? "");
}

// Comparar apellido del cliente.
export function lastNameMatches(
  name: string,
  typed: string,
) {
  const words = name.trim().split(/\s+/);

  const last = plain(
    (words.length > 1 ? words.slice(1) : words).join(" "),
  );

  const t = plain(typed);

  return (
    t.length > 1 &&
    (last === t || last.split(/\s+/).includes(t))
  );
}

// Generar número consecutivo del pedido.
export function nextOrderNumber(
  reservations: Reservation[],
  openedAt: string | null,
) {
  const since = openedAt ?? "";

  return (
    1 +
    Math.max(
      0,
      ...reservations
        .filter((r) => r.createdAt >= since)
        .map((r) => r.orderNumber ?? 0),
    )
  );
}

// Estados de reservaciones activas.
export const isActive = (r: Reservation) =>
  r.status === "held" || r.status === "authorized";

// Generar NIP de cuatro dígitos.
export function newPickupCode(
  reservations: Reservation[],
) {
  const taken = new Set(
    reservations
      .filter(isActive)
      .map((r) => r.pickupCode),
  );

  for (;;) {
    const code = String(
      Math.floor(Math.random() * 10_000),
    ).padStart(4, "0");

    if (!taken.has(code)) return code;
  }
}

// Cookies utilizadas por el sistema.
export const HOLDS_COOKIE = "th_holds";
export const PAYER_COOKIE = "th_payer";

// ==========================================
// TARJETAS DE RECOMPENSAS
// ==========================================

export type StampCard = {
  id: string;
  label: string | null;
  stamps: number;
  updatedAt: string;
};

export type Loyalty = {
  stampsPerReward: number;
  rewardDishId: string | null;
  stamps: Record<string, number>;
  cards: StampCard[];
};

// Identificar tarjeta por teléfono.
export function phoneCardId(
  phone: string,
): string | null {
  const digits = phone.replace(/\D/g, "");

  return digits.length >= 10
    ? `tel:${digits.slice(-10)}`
    : null;
}

// Mostrar identificación de tarjeta.
export function cardLabel(c: {
  id: string;
  label: string | null;
}): string {
  if (c.label) return c.label;

  const d = c.id.startsWith("tel:")
    ? c.id.slice(4)
    : "";

  return d
    ? `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`
    : "Cliente";
}

// ==========================================
// PERSONALIZACIÓN DEL NEGOCIO
// ==========================================

export type StallTypography =
  | "modern"
  | "classic"
  | "rounded"
  | "elegant";

export type StallLayout =
  | "classic"
  | "grid"
  | "compact";

export type StallCoverPosition =
  | "right"
  | "background";

export type StallTheme = {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;

  typography?: StallTypography;
  layout?: StallLayout;

  roundedCards?: boolean;
  roundedButtons?: boolean;

  /** Fondo del cuadro informativo. */
  headerBackgroundColor?: string;

  /** Texto del cuadro informativo. */
  headerTextColor?: string;

  /** Ubicación de la portada. */
  coverPosition?: StallCoverPosition;
};

// ==========================================
// CONFIGURACIÓN DE RECOGIDA
// ==========================================

export type PickupSettings = {
  /** Tiempo estimado para pedidos inmediatos. */
  asapMinutes: number;

  /** Aviso anticipado al negocio. */
  noticeMinutes: number;

  /** Intervalo entre horarios disponibles. */
  slotMinutes: number;

  /** Máximo de pedidos por horario. */
  maxPerSlot: number | null;

  /** Tolerancia después de la hora programada. */
  toleranceMinutes: number;

  /** Aceptar apartados para comer aquí (apagado por default). */
  dineIn: boolean;

  /** Comer aquí: cuánto se espera al cliente antes de marcar "No llegó". */
  dineInToleranceMinutes: number;
};

export type StallOpeningHour = {
  day: number;
  enabled: boolean;
  open: string;
  close: string;
};

// ==========================================
// CONFIGURACIÓN COMPLETA DEL NEGOCIO
// ==========================================

export type StallSettings = {
  // IDENTIDAD E IMÁGENES

  logoUrl?: string | null;
  coverUrl?: string | null;
  galleryUrls?: string[];

  // GALERÍA CON PIES DE FOTO

  galleryPhotos?: GalleryPhoto[];

  // ORDEN Y VISIBILIDAD DE SECCIONES

  sectionOrder?: {
    id:
      | "menu"
      | "chat"
      | "rewards"
      | "hours"
      | "location"
      | "social"
      | "gallery";
    visible: boolean;
  }[];

  // DESCRIPCIONES

  descriptionEs?: string;
  descriptionEn?: string;

  taglineEs?: string;
  taglineEn?: string;

  welcomeMessageEs?: string;
  welcomeMessageEn?: string;

  // UBICACIÓN

  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;

  googleMapsUrl?: string;
  latitude?: number | null;
  longitude?: number | null;

  // CONTACTO

  phone?: string;
  whatsapp?: string;
  email?: string;

  instagram?: string;
  facebook?: string;
  tiktok?: string;
  website?: string;

  // HORARIOS

  openingHours?: StallOpeningHour[];

  // RECOGER

  pickup?: PickupSettings;

  // APARIENCIA

  theme?: StallTheme;

  // VISIBILIDAD ORIGINAL

  showCover?: boolean;
  showDescription?: boolean;
  showLocation?: boolean;
  showOpeningHours?: boolean;
  showSocialLinks?: boolean;
  showGallery?: boolean;
};

// ==========================================
// CONFIGURACIÓN PREDETERMINADA
// ==========================================

export function defaultStallSettings(): StallSettings {
  return {
    logoUrl: null,
    coverUrl: null,

    galleryUrls: [],
    galleryPhotos: [],

    sectionOrder: [
      { id: "menu", visible: true },
      { id: "chat", visible: true },
      { id: "rewards", visible: true },
      { id: "hours", visible: true },
      { id: "location", visible: true },
      { id: "social", visible: true },
      { id: "gallery", visible: true },
    ],

    descriptionEs: "",
    descriptionEn: "",

    taglineEs: "",
    taglineEn: "",

    welcomeMessageEs: "",
    welcomeMessageEn: "",

    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "México",

    googleMapsUrl: "",
    latitude: null,
    longitude: null,

    phone: "",
    whatsapp: "",
    email: "",

    instagram: "",
    facebook: "",
    tiktok: "",
    website: "",

    openingHours: [],

    theme: {
      primaryColor: "#244D38",
      secondaryColor: "#E68B5C",
      backgroundColor: "#FAF9F6",
      textColor: "#24372C",
      buttonColor: "#244D38",

      typography: "modern",
      layout: "classic",

      roundedCards: true,
      roundedButtons: true,

      coverPosition: "right",
      headerBackgroundColor: "#FFFFFF",
      headerTextColor: "#2E1B14",
    },

    showCover: true,
    showDescription: true,
    showLocation: true,
    showOpeningHours: true,
    showSocialLinks: true,
    showGallery: true,
  };
}

// ==========================================
// SECCIONES DEL MENÚ
// ==========================================

export type MenuSection = {
  id: string;
  name: string;
  /** Sus platillos pasan por cocina (plan Plus). */
  toKitchen: boolean;
};

// ==========================================
// ESTADO COMPLETO DEL NEGOCIO
// ==========================================

export type StallState = {
  slug: string;
  name: string;
  currency: string;
  timezone: string;

  isOpen: boolean;
  openedAt: string | null;
  updatedAt: string;

  dishes: Dish[];
  ingredients: Ingredient[];

  /** En orden. Opcional para datos viejos. */
  sections?: MenuSection[];

  openingCount: Record<string, number>;
  sales: Sale[];

  holdMinutes: number;
  reservations: Reservation[];

  loyalty: Loyalty;

  settings?: StallSettings;
};

// ==========================================
// VISTA PÚBLICA
// ==========================================

export type PublicDish = {
  id: string;
  nameEs: string;
  nameEn: string;
  imageUrl: string | null;
  priceCents: number;
  portions: number;
  sectionId: string | null;
};

export type PublicSnapshot = {
  slug: string;
  name: string;
  currency: string;

  isOpen: boolean;
  updatedAt: string;

  dishes: PublicDish[];
  sections: MenuSection[];
  settings?: StallSettings;
};

export function publicSnapshot(
  s: StallState,
): PublicSnapshot {
  const left = new Map(
    menuAvailability(
      s.dishes,
      s.ingredients,
    ).map((a) => [
      a.dishId,
      a.portions,
    ]),
  );

  return {
    slug: s.slug,
    name: s.name,
    currency: s.currency,

    isOpen: s.isOpen,
    updatedAt: s.updatedAt,

    settings: s.settings,

    dishes: s.dishes.map((d) => ({
      id: d.id,
      nameEs: d.nameEs,
      nameEn: d.nameEn,

      imageUrl: d.imageUrl ?? null,
      priceCents: d.priceCents,

      portions: s.isOpen
        ? (left.get(d.id) ?? 0)
        : 0,

      sectionId: d.sectionId ?? null,
    })),

    sections: s.sections ?? [],
  };
}

// ==========================================
// VISTA DEL DUEÑO
// ==========================================

export type OwnerDish = PublicDish & {
  recipe: Dish["recipe"];
  soldOut: boolean;
  soldOutAt: string | null;
  limitingIngredient: string | null;
};

export type OwnerView = {
  slug: string;
  name: string;
  currency: string;

  isOpen: boolean;
  openedAt: string | null;
  updatedAt: string;

  dishes: OwnerDish[];
  ingredients: Ingredient[];
  sections: MenuSection[];

  today: CashUp;
  reservations: Reservation[];
  loyalty: Loyalty;

  settings?: StallSettings;
};

export function ownerView(
  s: StallState,
  now = new Date(),
): OwnerView {
  const avail = new Map(
    menuAvailability(
      s.dishes,
      s.ingredients,
    ).map((a) => [
      a.dishId,
      a,
    ]),
  );

  const events: SaleEvent[] =
    s.sales.flatMap((sale) =>
      sale.lines.map((l) => ({
        dishId: l.dishId,
        qty: l.qty,
        at: new Date(sale.at),
      })),
    );

  const fc = new Map(
    forecast(
      s.dishes,
      s.ingredients,
      events,
      now,
    ).map((f) => [
      f.dishId,
      f,
    ]),
  );

  const ingName = new Map(
    s.ingredients.map((i) => [
      i.id,
      i.name,
    ]),
  );

  return {
    slug: s.slug,
    name: s.name,
    currency: s.currency,

    isOpen: s.isOpen,
    openedAt: s.openedAt,
    updatedAt: s.updatedAt,

    settings: s.settings,

    ingredients: s.ingredients,
    sections: s.sections ?? [],

    today: cashUp(s),
    loyalty: s.loyalty,

    reservations: [...s.reservations]
      .sort(
        (a, b) =>
          Number(isActive(b)) -
            Number(isActive(a)) ||
          a.pickupBy.localeCompare(b.pickupBy),
      )
      .map((r) => ({
        ...r,

        customerName: shortName(
          r.customerName,
        ),

        pickupCode: r.pickupCode
          ? HIDDEN_CODE
          : null,
      })),

    dishes: s.dishes.map((d) => {
      const a = avail.get(d.id);
      const f = fc.get(d.id);

      const portions = a?.portions ?? 0;

      return {
        id: d.id,
        nameEs: d.nameEs,
        nameEn: d.nameEn,

        imageUrl: d.imageUrl ?? null,
        priceCents: d.priceCents,

        portions,
        sectionId: d.sectionId ?? null,

        recipe: d.recipe,
        soldOut: d.soldOut,

        soldOutAt:
          portions > 0 && f?.soldOutAt
            ? f.soldOutAt.toISOString()
            : null,

        limitingIngredient:
          a?.limitingIngredientId
            ? (
                ingName.get(
                  a.limitingIngredientId,
                ) ?? null
              )
            : null,
      };
    }),
  };
}

// ==========================================
// CORTE DE CAJA
// ==========================================

export type CashUp = {
  salesCount: number;
  totalCents: number;

  byMethod: Record<PaymentMethod, number>;

  byDish: {
    dishId: string;
    nameEs: string;
    nameEn: string;
    qty: number;
    totalCents: number;
  }[];

  used: {
    ingredientId: string;
    name: string;
    unit: string;
    used: number;
    left: number;
  }[];
};

// ==========================================
// RESUMEN DE VENTAS
// ==========================================

export function cashUp(
  s: StallState,
): CashUp {
  // Inicializar los métodos de pago.
  const byMethod: Record<
    PaymentMethod,
    number
  > = {
    cash: 0,
    card: 0,
    transfer: 0,
  };

  const perDish = new Map<
    string,
    {
      qty: number;
      totalCents: number;
    }
  >();

  const price = new Map(
    s.dishes.map((d) => [
      d.id,
      d.priceCents,
    ]),
  );

  // Recorrer todas las ventas.
  for (const sale of s.sales) {
    byMethod[sale.method] +=
      sale.totalCents;

    for (const l of sale.lines) {
      const cur =
        perDish.get(l.dishId) ?? {
          qty: 0,
          totalCents: 0,
        };

      cur.qty += l.qty;

      cur.totalCents +=
        (price.get(l.dishId) ?? 0) *
        l.qty;

      perDish.set(
        l.dishId,
        cur,
      );
    }
  }

  // Calcular el total de todos los pagos.
  const totalCents =
    byMethod.cash +
    byMethod.card +
    byMethod.transfer;

  return {
    salesCount: s.sales.length,

    totalCents,

    byMethod,

    byDish: s.dishes
      .filter((d) =>
        perDish.has(d.id),
      )
      .map((d) => ({
        dishId: d.id,
        nameEs: d.nameEs,
        nameEn: d.nameEn,

        ...perDish.get(d.id)!,
      }))
      .sort(
        (a, b) =>
          b.totalCents -
          a.totalCents,
      ),

    used: s.ingredients.map(
      (i) => ({
        ingredientId: i.id,
        name: i.name,
        unit: i.unit,

        used: Math.max(
          0,
          (s.openingCount[i.id] ??
            i.stock) - i.stock,
        ),

        left: i.stock,
      }),
    ),
  };
}
