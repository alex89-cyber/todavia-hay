"use client";

import { useMemo, useState } from "react";

import type { CashUpTables } from "@/lib/analytics";

// ==========================================
// TODAVÍA HAY · TABLERO DEL CORTE DE CAJA
// ==========================================
//
// Reemplaza AG Studio: mismas tablas de
// `cashUpTables` / `historicalCashUpTables`,
// gráficas propias (SVG y barras HTML), tablas,
// descarga en CSV y preguntas a la IA.
// No necesita licencia ni librerías de gráficas.
// ==========================================

type Lang = "es" | "en";

const TEXT = {
  es: {
    sold: "Vendido",
    sales: "Ventas",
    dishes: "Platillos",
    avg: "Ticket promedio",
    reservations: "Apartados",
    byDish: "Ventas por platillo",
    byDishSub: "Importe vendido de cada platillo",
    byHour: "Ventas por hora",
    byHourSub: "Importe vendido en cada hora del día",
    byMethod: "Formas de pago",
    byMethodSub: "Importe cobrado con cada forma de pago",
    stock: "Ingredientes usados",
    stockSub: "Porcentaje usado de lo que había al abrir",
    left: "quedan",
    ticket: "Ticket del corte",
    total: "Total",
    detail: "Detalle de ventas",
    resDetail: "Apartados",
    time: "Hora",
    dish: "Platillo",
    qty: "Cant.",
    amount: "Importe",
    method: "Pago",
    customer: "Cliente",
    status: "Estado",
    items: "Platillos",
    show: "Ver",
    hide: "Ocultar",
    rows: "filas",
    csv: "Descargar ventas (CSV)",
    csvRes: "Descargar apartados (CSV)",
    empty: "Todavía no hay ventas en este corte.",
    ask: "Pregúntale a tu corte",
    askHint: "Por ejemplo: ¿qué platillo dejó más dinero? ¿a qué hora vendí más?",
    askButton: "Preguntar",
    asking: "Pensando...",
    askError: "No pude contestar ahorita. Intenta otra vez.",
    askOff: "El asistente de IA no está configurado.",
    noData: "Sin datos",
  },
  en: {
    sold: "Sold",
    sales: "Sales",
    dishes: "Dishes",
    avg: "Average ticket",
    reservations: "Reservations",
    byDish: "Sales by dish",
    byDishSub: "Amount sold of each dish",
    byHour: "Sales by hour",
    byHourSub: "Amount sold in each hour of the day",
    byMethod: "Payment methods",
    byMethodSub: "Amount collected with each payment method",
    stock: "Ingredients used",
    stockSub: "Share used of what there was at opening",
    left: "left",
    ticket: "Cash-up ticket",
    total: "Total",
    detail: "Sales detail",
    resDetail: "Reservations",
    time: "Time",
    dish: "Dish",
    qty: "Qty",
    amount: "Amount",
    method: "Payment",
    customer: "Customer",
    status: "Status",
    items: "Dishes",
    show: "Show",
    hide: "Hide",
    rows: "rows",
    csv: "Download sales (CSV)",
    csvRes: "Download reservations (CSV)",
    empty: "No sales in this cash-up yet.",
    ask: "Ask your cash-up",
    askHint: "For example: which dish made the most? when did I sell the most?",
    askButton: "Ask",
    asking: "Thinking...",
    askError: "I couldn't answer right now. Try again.",
    askOff: "The AI assistant isn't set up.",
    noData: "No data",
  },
} as const;

type Pair = { label: string; value: number; note?: string };

function money(n: number, currency: string, lang: Lang) {
  return new Intl.NumberFormat(lang === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

function compact(n: number, lang: Lang) {
  return new Intl.NumberFormat(lang === "es" ? "es-MX" : "en-US", {
    notation: n >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 0,
  }).format(n);
}

function sumBy<T>(rows: T[], key: (r: T) => string, value: (r: T) => number): Pair[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + value(r));
  return [...m.entries()].map(([label, v]) => ({ label, value: v }));
}

function csvCell(v: unknown) {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(name: string, header: string[], rows: unknown[][]) {
  const body = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  // BOM para que Excel abra bien los acentos.
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ------------------------------------------
// Piezas
// ------------------------------------------

function Card({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5 ${className}`}>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/** Horizontal bars, one series: label, bar from a single baseline, value at the tip. */
function BarList({ rows, format, empty }: { rows: Pair[]; format: (n: number) => string; empty: string }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (!rows.length || max <= 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const pct = (r.value / max) * 100;
        return (
          <li
            key={r.label}
            className="group grid grid-cols-[minmax(0,6.5rem)_1fr_auto] items-center gap-3 sm:grid-cols-[minmax(0,9rem)_1fr_auto]"
            title={`${r.label}: ${format(r.value)}${r.note ? ` · ${r.note}` : ""}`}
          >
            <span className="truncate text-sm text-foreground">{r.label}</span>
            <span className="min-w-0">
              <span
                className="block h-5 min-w-1 rounded-r-[4px] bg-brand transition-opacity group-hover:opacity-80"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="text-right">
              <span className="block text-sm font-semibold tabular-nums text-foreground">{format(r.value)}</span>
              {r.note && <span className="block text-xs text-muted">{r.note}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Columns per hour with a hover tooltip. */
function HourColumns({ rows, format, lang, empty }: { rows: Pair[]; format: (n: number) => string; lang: Lang; empty: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (!rows.length || max <= 0) return <p className="text-sm text-muted">{empty}</p>;

  // Escala limpia: 0 y dos marcas redondas.
  const step = niceStep(max / 2);
  const top = Math.max(step * 2, step * Math.ceil(max / step));
  const W = 640;
  const H = 220;
  const pad = { l: 44, r: 8, t: 12, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const band = iw / rows.length;
  const bw = Math.min(24, band - 2);
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const ticks = [0, ...Array.from({ length: Math.round(top / step) }, (_, i) => (i + 1) * step)];
  const hovered = hover === null ? null : rows[hover];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={rows.map((r) => `${r.label}: ${format(r.value)}`).join(", ")}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">
              {compact(t, lang)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x = pad.l + i * band + (band - bw) / 2;
          const h = Math.max(0, y(0) - y(r.value));
          const rr = Math.min(4, h);
          return (
            <g key={r.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* Área de toque más grande que la columna. */}
              <rect x={pad.l + i * band} y={pad.t} width={band} height={ih} fill="transparent" />
              <path
                d={`M${x},${y(0)} V${y(0) - h + rr} Q${x},${y(0) - h} ${x + rr},${y(0) - h} H${x + bw - rr} Q${x + bw},${y(0) - h} ${x + bw},${y(0) - h + rr} V${y(0)} Z`}
                fill="var(--brand)"
                opacity={hover === null || hover === i ? 1 : 0.55}
              />
              {(rows.length <= 12 || i % 2 === 0) && (
                <text x={pad.l + i * band + band / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
                  {r.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md"
          style={{ left: `${((pad.l + (hover! + 0.5) * band) / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          <p className="font-semibold text-foreground">{hovered.label}</p>
          <p className="tabular-nums text-muted">{format(hovered.value)}</p>
        </div>
      )}
    </div>
  );
}

function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

// ------------------------------------------
// Preguntas a la IA
// ------------------------------------------

function AskBox({ slug, lang, facts }: { slug: string; lang: Lang; facts: string }) {
  const t = TEXT[lang];
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim() || busy) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch(`/api/stalls/${slug}/cashup-ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.trim(), facts, lang }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 503) throw new Error(t.askOff);
      if (!res.ok || !body?.answer) throw new Error(t.askError);
      setAnswer(body.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.askError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={t.ask} sub={t.askHint}>
      <form onSubmit={ask} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={300}
          className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-brand"
          placeholder={t.askHint}
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? t.asking : t.askButton}
        </button>
      </form>
      {answer && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">{answer}</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm text-bad">
          {error}
        </p>
      )}
    </Card>
  );
}

// ------------------------------------------
// Tablero
// ------------------------------------------

export function CashUpDashboard({
  tables,
  lang,
  slug,
  stallName,
  dateLabel,
}: {
  tables: CashUpTables;
  lang: Lang;
  slug: string;
  stallName: string;
  dateLabel: string;
}) {
  const t = TEXT[lang];
  const fmt = (n: number) => money(n, tables.currency, lang);
  const [showSales, setShowSales] = useState(false);
  const [showRes, setShowRes] = useState(false);

  const data = useMemo(() => {
    const v = tables.ventas;
    const total = v.reduce((s, r) => s + r.importe, 0);
    const saleCount = new Set(v.map((r) => r.venta)).size;
    const dishCount = v.reduce((s, r) => s + r.cantidad, 0);
    const byDish = sumBy(v, (r) => r.platillo, (r) => r.importe).sort((a, b) => b.value - a.value);
    const qtyByDish = new Map(sumBy(v, (r) => r.platillo, (r) => r.cantidad).map((p) => [p.label, p.value]));
    for (const d of byDish) d.note = `${qtyByDish.get(d.label) ?? 0} ${lang === "es" ? "vendidos" : "sold"}`;
    const byHour = sumBy(v, (r) => r.horaDelDia, (r) => r.importe).sort((a, b) => a.label.localeCompare(b.label));
    const byMethod = sumBy(v, (r) => r.metodo, (r) => r.importe).sort((a, b) => b.value - a.value);
    const stock = [...tables.inventario]
      .filter((r) => r.usado > 0)
      .sort((a, b) => b.usadoPct - a.usadoPct)
      .map((r) => ({ label: r.ingrediente, value: r.usadoPct, note: `${t.left} ${r.queda} ${r.unidad}` }));
    return { total, saleCount, dishCount, byDish, byHour, byMethod, stock };
  }, [tables, lang, t.left]);

  const facts = useMemo(() => {
    const lines = [
      `${stallName} · ${dateLabel}`,
      `${t.sold}: ${fmt(data.total)} · ${t.sales}: ${data.saleCount} · ${t.dishes}: ${data.dishCount} · ${t.reservations}: ${tables.apartados.length}`,
      `${t.byDish}: ${data.byDish.map((d) => `${d.label} ${fmt(d.value)} (${d.note})`).join("; ")}`,
      `${t.byHour}: ${data.byHour.map((d) => `${d.label} ${fmt(d.value)}`).join("; ")}`,
      `${t.byMethod}: ${data.byMethod.map((d) => `${d.label} ${fmt(d.value)}`).join("; ")}`,
      `${t.stock}: ${data.stock.map((d) => `${d.label} ${d.value}% (${d.note})`).join("; ")}`,
    ];
    return lines.join("\n").slice(0, 6000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, stallName, dateLabel, tables.apartados.length]);

  const fileBase = `corte-${slug}-${dateLabel.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}`;
  const timeFmt = new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tables.timezone,
  });
  const at = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : timeFmt.format(d);
  };

  return (
    <div className="flex flex-col gap-4 p-4 sm:gap-5 sm:p-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label={t.sold} value={fmt(data.total)} />
        <Kpi label={t.sales} value={String(data.saleCount)} />
        <Kpi label={t.dishes} value={String(data.dishCount)} />
        <Kpi label={t.avg} value={data.saleCount ? fmt(data.total / data.saleCount) : "—"} />
        <Kpi label={t.reservations} value={String(tables.apartados.length)} />
      </div>

      {tables.ventas.length === 0 && (
        <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">{t.empty}</p>
      )}

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <Card title={t.byDish} sub={t.byDishSub}>
          <BarList rows={data.byDish} format={fmt} empty={t.noData} />
        </Card>
        <Card title={t.byHour} sub={t.byHourSub}>
          <HourColumns rows={data.byHour} format={fmt} lang={lang} empty={t.noData} />
        </Card>
        <Card title={t.byMethod} sub={t.byMethodSub}>
          <BarList rows={data.byMethod} format={fmt} empty={t.noData} />
        </Card>
        <Card title={t.stock} sub={t.stockSub}>
          <BarList rows={data.stock} format={(n) => `${Math.round(n)}%`} empty={t.noData} />
        </Card>
      </div>

      <div className="grid items-start gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <AskBox slug={slug} lang={lang} facts={facts} />

        {/* Ticket del corte, como el papel que se imprime al cerrar (estilos .th-ticket en globals.css). */}
        <section className="th-ticket" aria-label={t.ticket}>
          <div className="th-ticket-paper">
            <p className="th-ticket-name">{stallName}</p>
            <p className="th-ticket-date">{dateLabel}</p>
            <p className="th-ticket-rule">{t.ticket.toUpperCase()}</p>
            <ul>
              {data.byDish.map((d) => (
                <li key={d.label}>
                  <span>{d.label}</span>
                  <i />
                  <b>{fmt(d.value)}</b>
                </li>
              ))}
            </ul>
            <p className="th-ticket-rule">{t.byMethod.toUpperCase()}</p>
            <ul>
              {data.byMethod.map((d) => (
                <li key={d.label}>
                  <span>{d.label}</span>
                  <i />
                  <b>{fmt(d.value)}</b>
                </li>
              ))}
            </ul>
            <p className="th-ticket-total">
              <span>{t.total.toUpperCase()}</span>
              <b>{fmt(data.total)}</b>
            </p>
            <p className="th-ticket-thanks">{lang === "es" ? "¡Gracias, buen día de venta!" : "Thanks, good selling day!"}</p>
          </div>
        </section>
      </div>

      {/* Datos en tabla y descarga. */}
      <Card title={t.detail} sub={`${tables.ventas.length} ${t.rows}`}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowSales((x) => !x)}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold"
            aria-expanded={showSales}
          >
            {showSales ? t.hide : t.show}
          </button>
          <button
            type="button"
            disabled={!tables.ventas.length}
            onClick={() =>
              download(
                `${fileBase}-ventas.csv`,
                [t.time, t.dish, t.qty, t.amount, t.method, "id"],
                tables.ventas.map((r) => [at(r.hora), r.platillo, r.cantidad, r.importe.toFixed(2), r.metodo, r.venta]),
              )
            }
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            ⬇ {t.csv}
          </button>
        </div>
        {showSales && (
          <div className="mt-4 max-h-96 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3 font-semibold">{t.time}</th>
                  <th className="py-2 pr-3 font-semibold">{t.dish}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t.qty}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t.amount}</th>
                  <th className="py-2 font-semibold">{t.method}</th>
                </tr>
              </thead>
              <tbody>
                {tables.ventas.map((r, i) => (
                  <tr key={`${r.venta}-${i}`} className="border-t border-line">
                    <td className="py-2 pr-3 tabular-nums">{at(r.hora)}</td>
                    <td className="py-2 pr-3">{r.platillo}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.cantidad}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmt(r.importe)}</td>
                    <td className="py-2">{r.metodo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {tables.apartados.length > 0 && (
        <Card title={t.resDetail} sub={`${tables.apartados.length} ${t.rows}`}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowRes((x) => !x)}
              className="rounded-full border border-line px-4 py-2 text-sm font-semibold"
              aria-expanded={showRes}
            >
              {showRes ? t.hide : t.show}
            </button>
            <button
              type="button"
              onClick={() =>
                download(
                  `${fileBase}-apartados.csv`,
                  [t.time, t.customer, t.status, t.items, t.amount],
                  tables.apartados.map((r) => [at(r.creado), r.cliente, r.estado, r.platillos, r.importe.toFixed(2)]),
                )
              }
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              ⬇ {t.csvRes}
            </button>
          </div>
          {showRes && (
            <div className="mt-4 max-h-96 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface text-xs text-muted">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">{t.time}</th>
                    <th className="py-2 pr-3 font-semibold">{t.customer}</th>
                    <th className="py-2 pr-3 font-semibold">{t.status}</th>
                    <th className="py-2 pr-3 font-semibold">{t.items}</th>
                    <th className="py-2 text-right font-semibold">{t.amount}</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.apartados.map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="py-2 pr-3 tabular-nums">{at(r.creado)}</td>
                      <td className="py-2 pr-3">{r.cliente}</td>
                      <td className="py-2 pr-3">{r.estado}</td>
                      <td className="py-2 pr-3">{r.platillos}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(r.importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
