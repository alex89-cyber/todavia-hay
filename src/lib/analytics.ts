
import {
  cashUp,
  type PaymentMethod,
  type ReservationStatus,
  shortName,
  type StallState,
} from "./stall";

export type SaleLineRow = {
  venta: string;
  hora: string;
  horaDelDia: string;
  metodo: string;
  platillo: string;
  cantidad: number;
  importe: number;
  apartado: boolean;
};

export type StockRow = {
  ingrediente: string;
  unidad: string;
  inicial: number;
  usado: number;
  queda: number;
  usadoPct: number;
};

export type ReservationRow = {
  cliente: string;
  estado: string;
  platillos: string;
  importe: number;
  creado: string;
};

export type CashUpTables = {
  currency: string;
  timezone: string;
  openedAt: string | null;
  ventas: SaleLineRow[];
  inventario: StockRow[];
  apartados: ReservationRow[];
};

export type HistoricalSaleRow = {
  id: string;
  day_id: string | null;
  method: PaymentMethod;
  total_cents: number;
  created_at: string;
  sale_items: {
    dish_id: string;
    qty: number;
    price_cents: number;
    dishes: {
      name_es: string;
      name_en: string;
    } | null;
  }[];
};

export type HistoricalInventoryRow = {
  ingredientId: string;
  name: string;
  unit: string;
  used: number;
  left: number;
};

const METHOD: Record<
  "es" | "en",
  Record<PaymentMethod, string>
> = {
  es: {
    cash: "Efectivo",
    card: "Tarjeta",
    paypal: "PayPal",
  },
  en: {
    cash: "Cash",
    card: "Card",
    paypal: "PayPal",
  },
};

const STATUS: Record<
  "es" | "en",
  Record<ReservationStatus, string>
> = {
  es: {
    held: "Esperando pago",
    authorized: "Pagado, por recoger",
    captured: "Entregado",
    voided: "Cancelado",
    expired: "Vencido",
  },
  en: {
    held: "Awaiting payment",
    authorized: "Paid, to pick up",
    captured: "Delivered",
    voided: "Cancelled",
    expired: "Expired",
  },
};

function hourFormatter(timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  });
}

function makeHour(
  date: string,
  formatter: Intl.DateTimeFormat,
) {
  return `${formatter.format(new Date(date))}:00`;
}

function inventoryTables(
  rows: HistoricalInventoryRow[],
): StockRow[] {
  return rows.map((item) => {
    const inicial = item.used + item.left;

    return {
      ingrediente: item.name,
      unidad: item.unit,
      inicial,
      usado: item.used,
      queda: item.left,
      usadoPct:
        inicial > 0
          ? Math.round((item.used / inicial) * 100)
          : 0,
    };
  });
}

/**
 * Jornada actual.
 * Se conserva el comportamiento actual de AG Studio.
 */
export function cashUpTables(
  s: StallState,
  lang: "es" | "en",
): CashUpTables {
  const dish = new Map(
    s.dishes.map((d) => [d.id, d]),
  );

  const dishName = (id: string) => {
    const d = dish.get(id);

    return d
      ? lang === "es"
        ? d.nameEs
        : d.nameEn
      : id;
  };

  const hour = hourFormatter(s.timezone);

  const fromReservation = new Set(
    s.sales
      .filter((sale) => sale.method === "paypal")
      .map((sale) => sale.id),
  );

  const ventas: SaleLineRow[] = s.sales.flatMap(
    (sale) =>
      sale.lines.map((line) => ({
        venta: sale.id,
        hora: sale.at,
        horaDelDia: makeHour(sale.at, hour),
        metodo: METHOD[lang][sale.method],
        platillo: dishName(line.dishId),
        cantidad: line.qty,
        importe:
          ((dish.get(line.dishId)?.priceCents ?? 0) *
            line.qty) /
          100,
        apartado: fromReservation.has(sale.id),
      })),
  );

  const inventario = inventoryTables(
    cashUp(s).used.map((item) => ({
      ingredientId: item.ingredientId,
      name: item.name,
      unit: item.unit,
      used: item.used,
      left: item.left,
    })),
  );

  const apartados: ReservationRow[] =
    s.reservations.map((reservation) => ({
      cliente: shortName(reservation.customerName),
      estado: STATUS[lang][reservation.status],
      platillos: reservation.lines
        .map(
          (line) =>
            `${line.qty} × ${dishName(line.dishId)}`,
        )
        .join(", "),
      importe: reservation.totalCents / 100,
      creado: reservation.createdAt,
    }));

  return {
    currency: s.currency,
    timezone: s.timezone,
    openedAt: s.openedAt,
    ventas,
    inventario,
    apartados,
  };
}

/**
 * Reportes históricos y resumen general.
 *
 * Los importes se calculan con el precio real
 * registrado en sale_items, no el precio actual.
 */
export function historicalCashUpTables({
  sales,
  currency,
  timezone,
  openedAt,
  lang,
  inventory = [],
}: {
  sales: HistoricalSaleRow[];
  currency: string;
  timezone: string;
  openedAt: string | null;
  lang: "es" | "en";
  inventory?: HistoricalInventoryRow[];
}): CashUpTables {
  const hour = hourFormatter(timezone);

  const ventas: SaleLineRow[] = sales.flatMap(
    (sale) =>
      (sale.sale_items ?? []).map((item) => {
        const dish = item.dishes;

        const dishName = dish
          ? lang === "es"
            ? dish.name_es
            : dish.name_en
          : lang === "es"
            ? "Platillo anterior"
            : "Previous dish";

        return {
          venta: sale.id,
          hora: sale.created_at,
          horaDelDia: makeHour(
            sale.created_at,
            hour,
          ),
          metodo: METHOD[lang][sale.method],
          platillo: dishName,
          cantidad: item.qty,
          importe:
            (item.price_cents * item.qty) / 100,
          apartado: sale.method === "paypal",
        };
      }),
  );

  return {
    currency,
    timezone,
    openedAt,
    ventas,
    inventario: inventoryTables(inventory),
    // Historical reservations need a separate
    // attribution query. Do not invent them.
    apartados: [],
  };
}
