
import {
  cashUp,
  type PaymentMethod,
  type ReservationStatus,
  shortName,
  type StallState,
} from "./stall";

// ==========================================
// TODAVÍA HAY - ANALÍTICA Y REPORTES
// ==========================================

// Una fila por producto vendido.
export type SaleLineRow = {
  venta: string;
  hora: string;
  horaDelDia: string;
  metodo: string;
  platillo: string;
  cantidad: number;
  importe: number;
  apartado: boolean;
  /** De dónde vino la venta. */
  origen: SaleOrigin;
};

export type SaleOrigin = "mostrador" | "apartado" | "mesa";

function origin(
  reservationId: string | null | undefined,
  tableTabId: string | null | undefined,
): SaleOrigin {
  return tableTabId ? "mesa" : reservationId ? "apartado" : "mostrador";
}

// Información del inventario.
export type StockRow = {
  ingrediente: string;
  unidad: string;
  inicial: number;
  usado: number;
  queda: number;
  usadoPct: number;
};

// Información de las reservaciones.
export type ReservationRow = {
  cliente: string;
  estado: string;
  platillos: string;
  importe: number;
  creado: string;
};

// Datos completos del corte de caja.
export type CashUpTables = {
  currency: string;
  timezone: string;
  openedAt: string | null;
  ventas: SaleLineRow[];
  inventario: StockRow[];
  apartados: ReservationRow[];
};

// Ventas históricas guardadas en Supabase.
export type HistoricalSaleRow = {
  id: string;
  day_id: string | null;
  method: PaymentMethod;
  total_cents: number;
  created_at: string;
  reservation_id?: string | null;
  table_tab_id?: string | null;
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

// Inventario histórico.
export type HistoricalInventoryRow = {
  ingredientId: string;
  name: string;
  unit: string;
  used: number;
  left: number;
};

// ==========================================
// MÉTODOS DE PAGO
// ==========================================

const METHOD: Record<
  "es" | "en",
  Record<PaymentMethod, string>
> = {
  es: {
    cash: "Efectivo",
    card: "Terminal bancaria",
    transfer: "Transferencia",
  },
  en: {
    cash: "Cash",
    card: "Card terminal",
    transfer: "Bank transfer",
  },
};

// ==========================================
// ESTADOS DE LOS PEDIDOS
// ==========================================

// Los pedidos nuevos se confirman sin pagar.
// El negocio registra el pago al entregar.

const STATUS: Record<
  "es" | "en",
  Record<ReservationStatus, string>
> = {
  es: {
    held: "Pendiente de confirmación",
    authorized: "Confirmado, por recoger",
    captured: "Entregado y pagado",
    voided: "Cancelado",
    expired: "Vencido",
  },
  en: {
    held: "Awaiting confirmation",
    authorized: "Confirmed, awaiting pickup",
    captured: "Delivered and paid",
    voided: "Cancelled",
    expired: "Expired",
  },
};

// ==========================================
// FORMATO DE HORARIOS
// ==========================================

function hourFormatter(
  timezone: string,
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    },
  );
}

function makeHour(
  date: string,
  formatter: Intl.DateTimeFormat,
) {
  return `${formatter.format(
    new Date(date),
  )}:00`;
}

// ==========================================
// TABLAS DE INVENTARIO
// ==========================================

function inventoryTables(
  rows: HistoricalInventoryRow[],
): StockRow[] {
  return rows.map((item) => {
    const inicial =
      item.used + item.left;

    return {
      ingrediente: item.name,
      unidad: item.unit,
      inicial,
      usado: item.used,
      queda: item.left,

      usadoPct:
        inicial > 0
          ? Math.round(
              (item.used / inicial) * 100,
            )
          : 0,
    };
  });
}

// ==========================================
// CORTE DE CAJA ACTUAL
// ==========================================

export function cashUpTables(
  s: StallState,
  lang: "es" | "en",
): CashUpTables {
  const dish = new Map(
    s.dishes.map((d) => [
      d.id,
      d,
    ]),
  );

  // Obtener nombre del producto.
  const dishName = (
    id: string,
  ) => {
    const d = dish.get(id);

    return d
      ? lang === "es"
        ? d.nameEs
        : d.nameEn
      : id;
  };

  const hour = hourFormatter(
    s.timezone,
  );

  // Construir detalle de ventas.
  const ventas: SaleLineRow[] =
    s.sales.flatMap((sale) =>
      sale.lines.map((line) => ({
        venta: sale.id,

        hora: sale.at,

        horaDelDia: makeHour(
          sale.at,
          hour,
        ),

        metodo:
          METHOD[lang][sale.method],

        platillo: dishName(
          line.dishId,
        ),

        cantidad: line.qty,

        importe:
          ((
            dish.get(line.dishId)
              ?.priceCents ?? 0
          ) * line.qty) / 100,

        apartado: Boolean(
          sale.reservationId,
        ),

        origen: origin(
          sale.reservationId,
          sale.tableTabId,
        ),
      })),
    );

  // Inventario consumido.
  const inventario =
    inventoryTables(
      cashUp(s).used.map(
        (item) => ({
          ingredientId:
            item.ingredientId,
          name: item.name,
          unit: item.unit,
          used: item.used,
          left: item.left,
        }),
      ),
    );

  // Reservaciones del negocio.
  const apartados: ReservationRow[] =
    s.reservations.map(
      (reservation) => ({
        cliente: shortName(
          reservation.customerName,
        ),

        estado:
          STATUS[lang][
            reservation.status
          ],

        platillos:
          reservation.lines
            .map(
              (line) =>
                `${line.qty} × ${dishName(
                  line.dishId,
                )}`,
            )
            .join(", "),

        importe:
          reservation.totalCents /
          100,

        creado:
          reservation.createdAt,
      }),
    );

  return {
    currency: s.currency,
    timezone: s.timezone,
    openedAt: s.openedAt,
    ventas,
    inventario,
    apartados,
  };
}

// ==========================================
// REPORTES HISTÓRICOS
// ==========================================

// Utilizar los precios registrados
// originalmente en sale_items.
// No sustituir por precios actuales.

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
  const hour = hourFormatter(
    timezone,
  );

  const ventas: SaleLineRow[] =
    sales.flatMap((sale) =>
      (
        sale.sale_items ?? []
      ).map((item) => {
        const dish =
          item.dishes;

        const dishName = dish
          ? lang === "es"
            ? dish.name_es
            : dish.name_en
          : lang === "es"
            ? "Platillo anterior"
            : "Previous dish";

        return {
          venta: sale.id,

          hora:
            sale.created_at,

          horaDelDia:
            makeHour(
              sale.created_at,
              hour,
            ),

          metodo:
            METHOD[lang][
              sale.method
            ],

          platillo: dishName,

          cantidad:
            item.qty,

          importe:
            (
              item.price_cents *
              item.qty
            ) / 100,

          apartado: Boolean(
            sale.reservation_id,
          ),

          origen: origin(
            sale.reservation_id,
            sale.table_tab_id,
          ),
        };
      }),
    );

  return {
    currency,
    timezone,
    openedAt,
    ventas,

    inventario:
      inventoryTables(
        inventory,
      ),

    // Para reconstruir reservaciones
    // históricas se necesita otra consulta.
    apartados: [],
  };
}
