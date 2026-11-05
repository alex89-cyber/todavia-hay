import type { AgDataSourcesDefinition, AgReportState } from "ag-studio";
import type { CashUpTables } from "@/lib/analytics";

// What the cash-up page opens with: the day's tables as AG Studio data sources,
// and a ready-made dashboard over them. The owner (or Studio's agent) can then
// change any widget.

type Lang = "es" | "en";

const L = {
  es: {
    ventas: "Ventas",
    inventario: "Inventario",
    apartados: "Apartados",
    venta: "Venta",
    hora: "Hora exacta",
    horaDelDia: "Hora",
    metodo: "Forma de pago",
    platillo: "Platillo",
    cantidad: "Cantidad",
    importe: "Importe",
    apartado: "Apartado con PayPal",
    ingrediente: "Ingrediente",
    unidad: "Unidad",
    inicial: "Al abrir",
    usado: "Usado",
    queda: "Queda",
    usadoPct: "% usado",
    yes: "Sí",
    no: "No",
    cliente: "Cliente",
    estado: "Estado",
    platillos: "Platillos",
    creado: "Apartado a las",
    kSold: "Vendido hoy",
    kSales: "Ventas",
    kDishes: "Platillos servidos",
    kHeld: "Apartados",
    byDish: "¿Qué platillo me deja más?",
    byDishSub: "Importe vendido por platillo",
    byHour: "¿A qué hora vendo más?",
    byMethod: "Forma de pago",
    stock: "Inventario del día",
    stockSub: "Cuánto llevo usado de cada ingrediente",
    ticket: "Ticket del corte",
    sales: "Detalle de ventas",
    describe:
      "Corte de caja del día de un puesto de comida mexicana: ventas por platillo y forma de pago, inventario usado y apartados pagados con PayPal.",
  },
  en: {
    ventas: "Sales",
    inventario: "Inventory",
    apartados: "Reservations",
    venta: "Sale",
    hora: "Exact time",
    horaDelDia: "Hour",
    metodo: "Payment method",
    platillo: "Dish",
    cantidad: "Quantity",
    importe: "Amount",
    apartado: "Reserved with PayPal",
    ingrediente: "Ingredient",
    unidad: "Unit",
    inicial: "At opening",
    usado: "Used",
    queda: "Left",
    usadoPct: "% used",
    yes: "Yes",
    no: "No",
    cliente: "Customer",
    estado: "Status",
    platillos: "Dishes",
    creado: "Reserved at",
    kSold: "Sold today",
    kSales: "Sales",
    kDishes: "Dishes served",
    kHeld: "Reservations",
    byDish: "Which dish earns the most?",
    byDishSub: "Amount sold per dish",
    byHour: "When do I sell the most?",
    byMethod: "Payment method",
    stock: "Today's inventory",
    stockSub: "How much of each ingredient is used up",
    ticket: "Cash-up receipt",
    sales: "Sales detail",
    describe:
      "Daily cash-up of a Mexican food stall: sales per dish and payment method, ingredients used and reservations paid with PayPal.",
  },
};

export function dataSources(t: CashUpTables, lang: Lang): AgDataSourcesDefinition {
  const l = L[lang];
  const locale = lang === "es" ? "es-MX" : "en-US";
  const money = { format: new Intl.NumberFormat(locale, { style: "currency", currency: t.currency, maximumFractionDigits: 0 }) };
  const time = { format: new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: t.timezone }) };
  return {
    description: l.describe,
    sources: [
      {
        id: "ventas",
        name: l.ventas,
        description: "One row per dish in each sale. importe = price × cantidad, in MXN.",
        data: t.ventas.map((r) => ({ ...r, hora: new Date(r.hora) })),
        fields: [
          { id: "venta", name: l.venta, format: "textFormat", cardinality: "high" },
          { id: "hora", name: l.hora, format: "dateTimeFormat", formatOptions: time },
          { id: "horaDelDia", name: l.horaDelDia, format: "textFormat", cardinality: "low" },
          { id: "metodo", name: l.metodo, format: "textFormat", cardinality: "low" },
          { id: "platillo", name: l.platillo, format: "textFormat", cardinality: "low" },
          { id: "cantidad", name: l.cantidad, format: "integerFormat" },
          { id: "importe", name: l.importe, format: "currencyFormat", formatOptions: money },
          {
            id: "apartado",
            name: l.apartado,
            format: "booleanFormat",
            createValueFormatter: () => (v: unknown) => (v ? l.yes : l.no),
          },
        ],
      },
      {
        id: "inventario",
        name: l.inventario,
        description: "Ingredient stock for the day: at opening (inicial), used (usado) and left (queda), in the given unit.",
        data: t.inventario,
        fields: [
          { id: "ingrediente", name: l.ingrediente, format: "textFormat", cardinality: "low" },
          { id: "unidad", name: l.unidad, format: "textFormat", cardinality: "low" },
          { id: "inicial", name: l.inicial, format: "decimalFormat" },
          { id: "usado", name: l.usado, format: "decimalFormat" },
          { id: "queda", name: l.queda, format: "decimalFormat" },
          {
            id: "usadoPct",
            name: l.usadoPct,
            // Whole numbers (0-100) so chart axes read 20, 40… instead of 0.2.
            format: "integerFormat",
            createValueFormatter: () => (v: unknown) => `${Math.round(Number(v ?? 0))}%`,
          },
        ],
      },
      {
        id: "apartados",
        name: l.apartados,
        description: "Orders customers reserved through the chat agent; PayPal holds the money until pickup.",
        data: t.apartados.map((r) => ({ ...r, creado: new Date(r.creado) })),
        fields: [
          { id: "cliente", name: l.cliente, format: "textFormat" },
          { id: "estado", name: l.estado, format: "textFormat", cardinality: "low" },
          { id: "platillos", name: l.platillos, format: "textFormat" },
          { id: "importe", name: l.importe, format: "currencyFormat", formatOptions: money },
          { id: "creado", name: l.creado, format: "dateTimeFormat", formatOptions: time },
        ],
      },
    ],
  };
}

const BRAND = "#a3341f";
const title = (text: string, subtitle?: string) => ({
  title: { enabled: true, text },
  ...(subtitle ? { subtitle: { enabled: true, text: subtitle } } : {}),
});
const kpi = (text: string) => ({
  ...title(text),
  style: { typography: { fontSize: 34, fontWeight: "bold" as const }, color: BRAND, verticalAlign: "center" as const },
});

export function initialReport(lang: Lang): AgReportState {
  const l = L[lang];
  const importe = { id: "ventas.importe", aggregation: "sum" as const };
  const widgets = {
    sold: {
      type: "value",
      format: { ...kpi(l.kSold), style: { ...kpi(l.kSold).style, sparkline: { type: "bar" } } },
      dataMapping: { value: [importe], sparklineX: [{ id: "ventas.horaDelDia" }] },
    },
    sales: { type: "value", format: kpi(l.kSales), dataMapping: { value: [{ id: "ventas.venta", aggregation: "countd" }] } },
    dishes: { type: "value", format: kpi(l.kDishes), dataMapping: { value: [{ id: "ventas.cantidad", aggregation: "sum" }] } },
    held: { type: "value", format: kpi(l.kHeld), dataMapping: { value: [{ id: "apartados.cliente", aggregation: "count" }] } },
    byDish: {
      type: "column-chart-grouped",
      format: title(l.byDish, l.byDishSub),
      dataMapping: { categoryKey: [{ id: "ventas.platillo" }], valueKey: [importe], tooltipKey: [{ id: "ventas.cantidad", aggregation: "sum" }] },
      sort: [{ field: importe, direction: "desc" }],
    },
    ticket: {
      type: "cashup-ticket",
      format: title(l.ticket),
      dataMapping: { concepto: [{ id: "ventas.metodo" }], importe: [importe] },
      sort: [{ field: importe, direction: "desc" }],
    },
    byHour: {
      type: "line-chart",
      format: title(l.byHour),
      dataMapping: { categoryKey: [{ id: "ventas.horaDelDia" }], valueKey: [importe] },
      sort: [{ field: { id: "ventas.horaDelDia" }, direction: "asc" }],
    },
    byMethod: {
      type: "donut-chart",
      format: title(l.byMethod),
      dataMapping: { categoryKey: [{ id: "ventas.metodo" }], valueKey: [importe] },
    },
    stock: {
      // As a share used: grams, millilitres and pieces don't fit one axis.
      type: "bar-chart-grouped",
      format: title(l.stock, l.stockSub),
      dataMapping: {
        categoryKey: [{ id: "inventario.ingrediente" }],
        valueKey: [{ id: "inventario.usadoPct", aggregation: "sum" }],
        tooltipKey: [
          { id: "inventario.usado", aggregation: "sum" },
          { id: "inventario.queda", aggregation: "sum" },
        ],
      },
      sort: [{ field: { id: "inventario.usadoPct", aggregation: "sum" }, direction: "desc" }],
    },
    detail: {
      type: "grid",
      format: title(l.sales),
      dataMapping: {
        cols: [
          { id: "ventas.hora" },
          { id: "ventas.platillo" },
          { id: "ventas.cantidad" },
          { id: "ventas.importe" },
          { id: "ventas.metodo" },
          { id: "ventas.apartado" },
        ],
      },
      sort: [{ field: { id: "ventas.hora" }, direction: "desc" }],
    },
  };
  // 24 columns, 16 px rows.
  const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number) => ({ xTrack, yTrack, xSpan, ySpan });
  const widgetLayout = {
    sold: at(0, 0, 6, 10),
    sales: at(6, 0, 6, 10),
    dishes: at(12, 0, 6, 10),
    held: at(18, 0, 6, 10),
    byDish: at(0, 10, 16, 18),
    ticket: at(16, 10, 8, 18),
    byHour: at(0, 28, 16, 18),
    byMethod: at(16, 28, 8, 18),
    stock: at(0, 46, 24, 16),
    detail: at(0, 62, 24, 22),
  };
  return {
    pages: [{ id: "corte", widgets, widgetLayout }],
    // Open on the board and the assistant; the editing panels are one click away.
    panels: { filters: { collapsed: true }, edit: { collapsed: true }, data: { collapsed: true }, ai: { width: 340 } },
    selectedPageId: "corte",
    version: "3.0.0",
  } as unknown as AgReportState;
}

/**
 * The day's numbers in a few lines, sent with every assistant turn so the
 * model can answer simple questions at once instead of querying the data
 * step by step (slow, and small models get the grouping wrong).
 */
export function cashUpFacts(t: CashUpTables): string {
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")} ${t.currency}`;
  const group = (key: "platillo" | "metodo" | "horaDelDia") => {
    const m = new Map<string, { importe: number; cantidad: number }>();
    for (const r of t.ventas) {
      const g = m.get(r[key]) ?? { importe: 0, cantidad: 0 };
      g.importe += r.importe;
      g.cantidad += r.cantidad;
      m.set(r[key], g);
    }
    return [...m].sort((a, b) => b[1].importe - a[1].importe);
  };
  const total = t.ventas.reduce((s, r) => s + r.importe, 0);
  const sales = new Set(t.ventas.map((r) => r.venta)).size;
  const lines = [
    `Total sold: ${money(total)} in ${sales} sales (${t.ventas.reduce((s, r) => s + r.cantidad, 0)} dishes).`,
    `Per dish (highest first): ${group("platillo").map(([k, v]) => `${k} ${money(v.importe)} (${v.cantidad} sold)`).join("; ") || "none"}.`,
    `Per payment method: ${group("metodo").map(([k, v]) => `${k} ${money(v.importe)}`).join("; ") || "none"}. PayPal means reservations paid ahead.`,
    `Per hour: ${group("horaDelDia").sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k} ${money(v.importe)}`).join("; ") || "none"}.`,
    `Ingredients left (lowest share first): ${[...t.inventario]
      .sort((a, b) => b.usadoPct - a.usadoPct)
      .map((r) => `${r.ingrediente} ${r.queda} ${r.unidad} left of ${r.inicial} (${r.usadoPct}% used)`)
      .join("; ") || "none"}.`,
    `Reservations: ${t.apartados.length ? t.apartados.map((r) => `${r.cliente} ${r.estado} ${money(r.importe)}`).join("; ") : "none today"}.`,
  ];
  return lines.join("\n").slice(0, 6000);
}
