
import "server-only";

import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { CashUpDashboard } from "@/components/cashup/CashUpDashboard";
import FinanceOverview from "@/components/cashup/FinanceOverview";
import { RefreshButton } from "@/components/cashup/RefreshButton";
import { PanelNoAccess } from "@/components/PanelNoAccess";
import { getDictionary, hasLocale } from "@/dictionaries";
import { isOwner } from "@/lib/owner-auth";
import {
  cashUpTables,
  historicalCashUpTables,
  type CashUpTables,
  type HistoricalSaleRow,
  type HistoricalInventoryRow,
} from "@/lib/analytics";
import { loadStall } from "@/lib/reservations";
import { paymentMethod } from "@/lib/stall";

type DayRow = {
  id: string;
  opened_at: string;
  closed_at: string | null;
  cash_up: unknown;
};

type Mode = "current" | "general" | "date" | "session";

type History = {
  days: DayRow[];
  sales: HistoricalSaleRow[];
};

const PAGE_SIZE = 500;

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function localDate(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateLabel(
  iso: string,
  lang: string,
  timezone: string,
) {
  return new Intl.DateTimeFormat(
    lang === "es" ? "es-MX" : "en-US",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: timezone,
    },
  ).format(new Date(iso));
}

function dayLabel(date: string, lang: string) {
  return new Intl.DateTimeFormat(
    lang === "es" ? "es-MX" : "en-US",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(new Date(`${date}T12:00:00Z`));
}

function timeLabel(
  iso: string,
  lang: string,
  timezone: string,
) {
  return new Intl.DateTimeFormat(
    lang === "es" ? "es-MX" : "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    },
  ).format(new Date(iso));
}

function formatMoney(
  cents: number,
  currency: string,
  lang: string,
) {
  return new Intl.NumberFormat(
    lang === "es" ? "es-MX" : "en-US",
    {
      style: "currency",
      currency,
    },
  ).format(cents / 100);
}

function snapshotInventory(
  cashUp: unknown,
): HistoricalInventoryRow[] {
  if (!cashUp || typeof cashUp !== "object") {
    return [];
  }

  const snapshot = cashUp as {
    summary?: {
      used?: HistoricalInventoryRow[];
    };
  };

  return Array.isArray(snapshot.summary?.used)
    ? snapshot.summary.used
    : [];
}

/**
 * Pone el nombre del mesero en cada cobro de mesa: el que abrió la cuenta.
 * Si falla, el corte se muestra igual, sin la sección de meseros.
 */
async function attachWaiters(tables: CashUpTables) {
  const tabIds = [
    ...new Set(
      tables.pagos.filter((p) => p.origen === "mesa").map((p) => p.cuenta),
    ),
  ];
  const db = getDb();
  if (!db || tabIds.length === 0) return;

  try {
    const { data: tabs, error } = await db
      .from("table_tabs")
      .select("id, opened_by")
      .in("id", tabIds);
    if (error) throw error;

    const userIds = [
      ...new Set(
        (tabs ?? [])
          .map((tab) => tab.opened_by as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const names = new Map<string, string>();
    if (userIds.length) {
      const { data: profiles, error: profilesError } = await db
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);
      if (profilesError) throw profilesError;
      for (const p of profiles ?? []) {
        const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
        if (name) names.set(p.id as string, name);
      }
      // Sin nombre en el perfil: se usa el correo.
      for (const id of userIds.filter((id) => !names.has(id))) {
        const { data } = await db.auth.admin.getUserById(id);
        if (data.user?.email) names.set(id, data.user.email);
      }
    }

    const waiterByTab = new Map(
      (tabs ?? []).map((tab) => [
        tab.id as string,
        tab.opened_by ? (names.get(tab.opened_by as string) ?? null) : null,
      ]),
    );
    for (const p of tables.pagos) {
      if (p.origen === "mesa") p.mesero = waiterByTab.get(p.cuenta) ?? null;
    }
  } catch (error) {
    console.error("corte meseros:", error);
  }
}

async function fetchHistory(
  slug: string,
  mode: Mode,
  date: string | undefined,
  sessionId: string | undefined,
  timezone: string,
): Promise<History | null> {
  const db = getDb();

  if (!db) return null;

  const { data: business, error: businessError } =
    await db
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

  if (businessError) {
    throw new Error(businessError.message);
  }

  if (!business) return null;

  const days: DayRow[] = [];

  // Load all sessions, including older ones.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await db
      .from("days")
      .select("id, opened_at, closed_at, cash_up")
      .eq("business_id", business.id)
      .order("opened_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const batch = (data ?? []) as DayRow[];
    days.push(...batch);

    if (batch.length < PAGE_SIZE) break;
  }

  if (mode === "current") {
    return { days, sales: [] };
  }

  let selectedIds: string[] | null = null;

  if (mode === "session") {
    // The selected day must belong to this business.
    const session = days.find(
      (day) => day.id === sessionId,
    );

    if (!session) return { days, sales: [] };

    selectedIds = [session.id];
  }

  if (mode === "date") {
    selectedIds = days
      .filter(
        (day) =>
          localDate(day.opened_at, timezone) === date,
      )
      .map((day) => day.id);
  }

  if (selectedIds !== null && selectedIds.length === 0) {
    return { days, sales: [] };
  }

  const sales: HistoricalSaleRow[] = [];

  // Page through transactions instead of stopping
  // at Supabase's default row limit.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let request = db
      .from("sales")
      .select(
        "id, day_id, method, total_cents, created_at, reservation_id, table_tab_id, sale_items(dish_id, qty, price_cents, dishes(name_es, name_en))",
      )
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (selectedIds !== null) {
      request = request.in("day_id", selectedIds);
    }

    const { data, error } = await request.range(
      offset,
      offset + PAGE_SIZE - 1,
    );

    if (error) throw new Error(error.message);

    // Un método viejo o desconocido se muestra como tarjeta.
    const batch = (
      (data ?? []) as unknown as HistoricalSaleRow[]
    ).map((sale) => ({
      ...sale,
      method: paymentMethod(sale.method),
    }));

    sales.push(...batch);

    if (batch.length < PAGE_SIZE) break;
  }

  return { days, sales };
}

export default function CashUpPage({
  params,
  searchParams,
}: PageProps<"/[lang]/panel/[slug]/corte">) {
  return (
    <main className="flex h-dvh w-full flex-col">
      <Suspense
        fallback={
          <div className="p-6 text-sm text-muted">
            Cargando reporte...
          </div>
        }
      >
        <Report
          params={params}
          searchParams={searchParams}
        />
      </Suspense>
    </main>
  );
}

async function Report({
  params,
  searchParams,
}: {
  params: PageProps<"/[lang]/panel/[slug]/corte">["params"];
  searchParams: PageProps<"/[lang]/panel/[slug]/corte">["searchParams"];
}) {
  const { lang, slug } = await params;

  if (!hasLocale(lang)) notFound();

  await connection();

  const state = await loadStall(slug);

  if (!state) notFound();

  const t = await getDictionary(lang);

  // Never load private sales until owner authentication
  // has been verified.
  if (!(await isOwner(slug))) {
    return <PanelNoAccess lang={lang} stallName={state.name} back={`/${lang}/panel/${slug}/corte`} />;
  }

  const es = lang === "es";
  const query = await searchParams;

  const selectedDate =
    typeof query.fecha === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(query.fecha)
      ? query.fecha
      : undefined;

  const selectedSession =
    typeof query.dia === "string" &&
    /^[0-9a-f-]{36}$/i.test(query.dia)
      ? query.dia
      : undefined;

  const mode: Mode = selectedSession
    ? "session"
    : selectedDate
      ? "date"
      : query.vista === "general"
        ? "general"
        : "current";

  const basePath = `/${lang}/panel/${slug}/corte`;

  const history = await fetchHistory(
    slug,
    mode,
    selectedDate,
    selectedSession,
    state.timezone,
  );

  const days = history?.days ?? [];
  const sales = history?.sales ?? [];

  const selectedDay = days.find(
    (day) => day.id === selectedSession,
  );

  const dates = [
    ...new Set(
      days.map((day) =>
        localDate(day.opened_at, state.timezone),
      ),
    ),
  ].sort((a, b) => b.localeCompare(a));

  const daysOnDate = selectedDate
    ? days.filter(
        (day) =>
          localDate(day.opened_at, state.timezone) ===
          selectedDate,
      )
    : [];

  const selectedDateExists =
    selectedDate ? dates.includes(selectedDate) : true;

  const selectedSessionExists =
    selectedSession ? Boolean(selectedDay) : true;

  const valid =
    selectedDateExists && selectedSessionExists;

  const selectedDateForSession = selectedDay
    ? localDate(selectedDay.opened_at, state.timezone)
    : null;

  const currentLabel = dateLabel(
    state.openedAt ?? new Date().toISOString(),
    lang,
    state.timezone,
  );

  const reportLabel =
    mode === "general"
      ? es
        ? "Todas las ventas"
        : "All sales"
      : mode === "date" && selectedDate
        ? dayLabel(selectedDate, lang)
        : mode === "session" && selectedDay
          ? `${dateLabel(
              selectedDay.opened_at,
              lang,
              state.timezone,
            )} · ${timeLabel(
              selectedDay.opened_at,
              lang,
              state.timezone,
            )}`
          : currentLabel;

  const tables =
    mode === "current"
      ? cashUpTables(state, lang)
      : historicalCashUpTables({
          sales,
          currency: state.currency,
          timezone: state.timezone,
          openedAt:
            selectedDay?.opened_at ??
            (mode === "date"
              ? daysOnDate[daysOnDate.length - 1]
                  ?.opened_at ?? null
              : days[days.length - 1]?.opened_at ??
                null),
          lang,
          inventory:
            mode === "session"
              ? snapshotInventory(selectedDay?.cash_up)
              : [],
        });

  await attachWaiters(tables);

  const totalCents = sales.reduce(
    (sum, sale) => sum + sale.total_cents,
    0,
  );

  const totalDishes = sales.reduce(
    (sum, sale) =>
      sum +
      (sale.sale_items ?? []).reduce(
        (n, item) => n + item.qty,
        0,
      ),
    0,
  );

  const fmt = (cents: number) =>
    formatMoney(cents, state.currency, lang);

  const salesForDay = (id: string) =>
    sales.filter((sale) => sale.day_id === id);

  const getDayTotal = (id: string) =>
    salesForDay(id).reduce(
      (sum, sale) => sum + sale.total_cents,
      0,
    );

  return (
    <>
      {/* MAIN HEADER */}
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <Link
          href={`/${lang}/panel/${slug}`}
          className="text-sm font-semibold text-brand"
        >
          {t.studio.back}
        </Link>

        <h1 className="text-lg font-bold">
          {t.studio.title} · {state.name}
        </h1>

        <span className="flex-1" />

        <RefreshButton label={t.studio.refresh} />
      </header>

      {/* REPORT NAVIGATION */}
      <nav className="border-b border-line bg-background px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={basePath}
            className={`rounded-xl border px-4 py-3 text-sm font-bold ${
              mode === "current"
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-brand"
            }`}
          >
            {es ? "Jornada actual" : "Current day"}
          </Link>

          <Link
            href={`${basePath}?vista=general`}
            className={`rounded-xl border px-4 py-3 text-sm font-bold ${
              mode === "general"
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-brand"
            }`}
          >
            {es ? "Resumen general" : "Overall summary"}
          </Link>

          <details className="relative">
            <summary className="cursor-pointer list-none rounded-xl border border-line bg-surface px-4 py-3 text-sm font-bold text-brand">
              {es
                ? "Historial por día"
                : "History by date"}{" "}
              ▾
            </summary>

            <div className="absolute left-0 top-full z-30 mt-2 max-h-80 w-[min(90vw,360px)] overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-xl">
              {dates.map((date) => {
                const count = days.filter(
                  (day) =>
                    localDate(
                      day.opened_at,
                      state.timezone,
                    ) === date,
                ).length;

                return (
                  <Link
                    key={date}
                    href={`${basePath}?fecha=${date}`}
                    className={`block rounded-xl px-3 py-3 text-sm hover:bg-brand-soft ${
                      date === selectedDate
                        ? "bg-brand-soft font-bold text-brand"
                        : ""
                    }`}
                  >
                    <span className="font-semibold">
                      {dayLabel(date, lang)}
                    </span>

                    <span className="mt-1 block text-xs text-muted">
                      {count}{" "}
                      {es
                        ? count === 1
                          ? "jornada"
                          : "jornadas"
                        : count === 1
                          ? "session"
                          : "sessions"}
                    </span>
                  </Link>
                );
              })}

              {dates.length === 0 && (
                <p className="p-3 text-sm text-muted">
                  {es
                    ? "No hay fechas registradas."
                    : "No dates recorded."}
                </p>
              )}
            </div>
          </details>
        </div>
      </nav>

      {!valid && (
        <div className="p-6">
          <p className="rounded-xl border border-line bg-surface p-5 text-muted">
            {es
              ? "No encontramos el cierre seleccionado."
              : "Selected closing not found."}
          </p>
        </div>
      )}

      {valid && (
        <>
          {/* DATE / REPORT CONTEXT */}
          <section className="border-b border-line bg-surface px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                  {mode === "general"
                    ? es
                      ? "Resumen general del negocio"
                      : "Business overview"
                    : mode === "date"
                      ? es
                        ? "Resumen del día"
                        : "Daily report"
                      : mode === "session"
                        ? es
                          ? "Corte individual"
                          : "Individual cash-up"
                        : es
                          ? "Jornada actual"
                          : "Current day"}
                </p>

                <p className="mt-1 text-sm font-semibold">
                  {reportLabel}
                </p>
              </div>

              {mode === "session" &&
                selectedDateForSession && (
                  <Link
                    href={`${basePath}?fecha=${selectedDateForSession}`}
                    className="text-sm font-bold text-brand underline"
                  >
                    {es
                      ? "Volver al día"
                      : "Back to date"}
                  </Link>
                )}

              {mode === "date" && (
                <Link
                  href={`${basePath}?vista=general`}
                  className="text-sm font-bold text-brand underline"
                >
                  {es
                    ? "Ver resumen general"
                    : "View overall summary"}
                </Link>
              )}
            </div>
          </section>

       

          {/* INDIVIDUAL SESSIONS FOR SELECTED DATE */}
          {mode === "date" &&
            daysOnDate.length > 0 && (
              <section className="border-b border-line bg-background px-4 py-4">
                <h2 className="text-base font-bold">
                  {es
                    ? "Cortes de esta fecha"
                    : "Closings on this date"}
                </h2>

                <p className="mt-1 text-xs text-muted">
                  {es
                    ? "Selecciona una jornada para ver sus propios gráficos."
                    : "Choose a session to view its charts."}
                </p>

                <div className="mt-3 flex flex-wrap gap-3">
                  {daysOnDate.map((day, index) => (
                    <Link
                      key={day.id}
                      href={`${basePath}?dia=${day.id}`}
                      className="rounded-xl border border-line bg-surface px-4 py-3 text-sm transition hover:border-brand hover:bg-brand-soft"
                    >
                      <span className="block font-bold">
                        {es ? "Jornada" : "Session"}{" "}
                        {daysOnDate.length - index}
                      </span>

                      <span className="mt-1 block text-muted">
                        {timeLabel(
                          day.opened_at,
                          lang,
                          state.timezone,
                        )}
                        {" – "}
                        {day.closed_at
                          ? timeLabel(
                              day.closed_at,
                              lang,
                              state.timezone,
                            )
                          : es
                            ? "En curso"
                            : "In progress"}
                      </span>

                      <span className="mt-1 block font-bold text-brand">
                        {fmt(getDayTotal(day.id))}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

          {/* TABLERO DEL CORTE + FINANZAS */}
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">

            {/* COMPRAS Y GASTOS DEL RESTAURANTE */}
            <FinanceOverview
              slug={slug}
              lang={es ? "es" : "en"}
              date={
                mode === "general"
                  ? undefined
                  : mode === "date"
                    ? selectedDate
                    : mode === "session" && selectedDay
                      ? localDate(
                          selectedDay.opened_at,
                          state.timezone,
                        )
                      : localDate(
                          new Date().toISOString(),
                          state.timezone,
                        )
              }
            />

            {/* GRÁFICAS, TABLAS, CSV Y PREGUNTAS A LA IA */}
            <CashUpDashboard
              key={`${mode}-${selectedDate ?? ""}-${selectedSession ?? ""}`}
              tables={tables}
              lang={es ? "es" : "en"}
              slug={slug}
              stallName={state.name}
              dateLabel={reportLabel}
            />
          </div>


          {mode !== "current" && (
            <p className="border-t border-line bg-surface px-4 py-2 text-xs text-muted">
              {es
                ? "Los ingresos históricos se calculan con las ventas registradas. El inventario y los apartados históricos solo estarán completos cuando contemos con sus registros de cierre correspondientes."
                : "Historical revenue comes from recorded sales. Historical inventory and reservation charts require their corresponding archived records."}
            </p>
          )}
        </>
      )}
    </>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-xs font-semibold text-muted">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black tabular-nums text-brand">
        {value}
      </p>
    </div>
  );
}
