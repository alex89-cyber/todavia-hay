"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { OpenTab, TabsSnapshot } from "@/app/api/businesses/[slug]/table-tabs/route";

// ==========================================
// TODAVÍA HAY
// MESAS: ABRIR, PEDIR Y COBRAR
// ==========================================
//
// - Ver qué mesas están libres u ocupadas.
// - Abrir una mesa (cuántas personas).
// - Tomar el pedido desde el menú.
// - Cancelar un platillo o la cuenta.
// - Cobrar con efectivo, tarjeta o transferencia,
//   en uno o varios pagos.
// - Juntar y separar mesas libres.
//
// Crear o editar mesas sigue siendo del
// dueño, desde Configuración.
// ==========================================

type Props = {
  slug: string;
  lang: "es" | "en";
};

type Method = "cash" | "card" | "transfer";

type Place = {
  key: string;
  /** Mesa a la que se abre la cuenta. */
  tableId: string;
  label: string;
  capacity: number;
  active: boolean;
  groupId: string | null;
  tab: OpenTab | null;
};

const TEXT = {
  es: {
    free: "Libre",
    busy: "Ocupada",
    inactive: "Desactivada",
    people: (n: number) => `${n} ${n === 1 ? "persona" : "personas"}`,
    seats: (n: number) => `Para ${n}`,
    open: "Abrir mesa",
    howMany: "¿Cuántas personas?",
    cancel: "Cancelar",
    back: "← Mesas",
    order: "Agregar al pedido",
    send: (n: number) => `Enviar ${n} ${n === 1 ? "platillo" : "platillos"}`,
    noteFor: "Nota (opcional)",
    notePh: "Ej. sin cebolla",
    left: (n: number) => `quedan ${n}`,
    soldOut: "Agotado",
    items: "Cuenta",
    empty: "Todavía no hay platillos en esta cuenta.",
    remove: "Quitar",
    removeAsk: "¿Quitar este platillo? El inventario se regresa.",
    total: "Total",
    charge: (t: string) => `Cobrar ${t}`,
    howPay: "¿Cómo pagó?",
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
    paid: "Cuenta cobrada. La mesa quedó libre.",
    partPaid: (left: string) => `Pago registrado. Falta ${left}.`,
    paidSoFar: "Pagado",
    leftToPay: "Falta",
    amount: "Monto de este pago",
    all: "Todo",
    perPerson: (n: number) => `Entre ${n}`,
    badAmount: "Escribe un monto entre $1 y lo que falta.",
    cancelTab: "Cancelar cuenta",
    cancelTabAsk: "¿Cancelar toda la cuenta? Se regresa el inventario y la mesa queda libre.",
    cancelled: "Cuenta cancelada.",
    sent: "Pedido agregado.",
    closedDay: "El negocio está cerrado. Abre el día en el panel para tomar pedidos.",
    join: "Juntar mesas",
    joinPick: "Elige las mesas libres que quieres juntar.",
    joinDo: (n: number) => `Juntar ${n}`,
    separate: "Separar",
    joined: "Mesas juntas.",
    separated: "Mesas separadas.",
    refresh: "Actualizar",
    loading: "Cargando mesas…",
    noTables: "Todavía no hay mesas. El dueño las agrega en Configuración.",
    since: (m: number) => (m < 1 ? "recién abierta" : `hace ${m} min`),
    summary: (free: number, busy: number) => `${free} libres · ${busy} ocupadas`,
    error: "No se pudo completar. Intenta otra vez.",
  },
  en: {
    free: "Free",
    busy: "Busy",
    inactive: "Disabled",
    people: (n: number) => `${n} ${n === 1 ? "guest" : "guests"}`,
    seats: (n: number) => `Seats ${n}`,
    open: "Open table",
    howMany: "How many guests?",
    cancel: "Cancel",
    back: "← Tables",
    order: "Add to order",
    send: (n: number) => `Send ${n} ${n === 1 ? "dish" : "dishes"}`,
    noteFor: "Note (optional)",
    notePh: "e.g. no onion",
    left: (n: number) => `${n} left`,
    soldOut: "Sold out",
    items: "Bill",
    empty: "No dishes on this bill yet.",
    remove: "Remove",
    removeAsk: "Remove this dish? Its stock goes back.",
    total: "Total",
    charge: (t: string) => `Charge ${t}`,
    howPay: "How did they pay?",
    cash: "Cash",
    card: "Card",
    transfer: "Transfer",
    paid: "Bill paid. The table is free.",
    partPaid: (left: string) => `Payment saved. ${left} left.`,
    paidSoFar: "Paid",
    leftToPay: "Left",
    amount: "Amount for this payment",
    all: "All",
    perPerson: (n: number) => `Split ${n}`,
    badAmount: "Enter an amount between $1 and what's left.",
    cancelTab: "Cancel bill",
    cancelTabAsk: "Cancel the whole bill? Stock goes back and the table is freed.",
    cancelled: "Bill cancelled.",
    sent: "Order added.",
    closedDay: "The business is closed. Open the day in the panel to take orders.",
    join: "Join tables",
    joinPick: "Pick the free tables you want to join.",
    joinDo: (n: number) => `Join ${n}`,
    separate: "Separate",
    joined: "Tables joined.",
    separated: "Tables separated.",
    refresh: "Refresh",
    loading: "Loading tables…",
    noTables: "No tables yet. The owner adds them in Settings.",
    since: (m: number) => (m < 1 ? "just opened" : `${m} min ago`),
    summary: (free: number, busy: number) => `${free} free · ${busy} busy`,
    error: "Couldn't finish that. Try again.",
  },
};

export default function StaffTablesManager({ slug, lang }: Props) {
  const t = TEXT[lang];
  const es = lang === "es";
  const base = `/api/businesses/${encodeURIComponent(slug)}`;

  const [data, setData] = useState<TabsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Pantallas
  const [opening, setOpening] = useState<Place | null>(null);
  const [party, setParty] = useState(2);
  const [tabId, setTabId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  // Pedido en preparación (antes de enviarlo)
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState("");

  const money = useMemo(
    () =>
      new Intl.NumberFormat(es ? "es-MX" : "en-US", {
        style: "currency",
        currency: data?.currency ?? "MXN",
      }),
    [es, data?.currency],
  );
  const fmt = (cents: number) => money.format(cents / 100);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${base}/table-tabs`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? t.error);
      setData(result as TabsSnapshot);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setLoading(false);
    }
  }, [base, t.error]);

  // Carga inicial y cada 20 s (otros meseros también mueven las mesas).
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 20_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  async function send(
    endpoint: string,
    body: Record<string, unknown>,
    ok: string,
  ): Promise<TabsSnapshot | null> {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? t.error);
      if (ok) setNotice(ok);
      return result as TabsSnapshot;
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
      await load();
      return null;
    } finally {
      setBusy(false);
    }
  }

  const act = async (body: Record<string, unknown>, ok: string) => {
    const next = await send(`${base}/table-tabs`, body, ok);
    if (next) setData(next);
    return next;
  };

  // ----------------------------------------
  // Mesas y grupos como "lugares"
  // ----------------------------------------

  const places = useMemo<Place[]>(() => {
    if (!data) return [];
    const tabFor = (ids: string[]) => data.tabs.find((tab) => ids.includes(tab.tableId)) ?? null;
    const groups = new Map<string, TabsSnapshot["tables"]>();
    const out: Place[] = [];

    for (const table of data.tables) {
      if (table.group_id) {
        groups.set(table.group_id, [...(groups.get(table.group_id) ?? []), table]);
        continue;
      }
      out.push({
        key: table.id,
        tableId: table.id,
        label: table.name,
        capacity: table.capacity,
        active: table.active,
        groupId: null,
        tab: tabFor([table.id]),
      });
    }

    for (const [groupId, members] of groups) {
      const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      out.push({
        key: groupId,
        tableId: sorted[0].id,
        label: sorted.map((m) => m.name).join(" + "),
        capacity: sorted.reduce((sum, m) => sum + m.capacity, 0),
        active: sorted.every((m) => m.active),
        groupId,
        tab: tabFor(sorted.map((m) => m.id)),
      });
    }

    return out.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [data]);

  const tab = data?.tabs.find((x) => x.id === tabId) ?? null;
  const dishName = (id: string) => {
    const d = data?.menu.find((m) => m.id === id);
    return d ? (es ? d.nameEs : d.nameEn) : "—";
  };
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const freeCount = places.filter((p) => p.active && !p.tab).length;
  const busyCount = places.filter((p) => p.tab).length;

  function resetOrder() {
    setCart({});
    setNotes({});
    setPaying(false);
    setAmount("");
  }

  const leftCents = tab ? Math.max(0, tab.totalCents - tab.paidCents) : 0;
  const toAmount = (cents: number) => (cents / 100).toFixed(2);

  // ----------------------------------------
  // Acciones
  // ----------------------------------------

  async function openTable() {
    if (!opening) return;
    const next = await act({ action: "open", tableId: opening.tableId, partySize: party }, "");
    if (next) {
      const created = next.tabs.find((x) => x.tableId === opening.tableId);
      setOpening(null);
      resetOrder();
      if (created) setTabId(created.id);
    }
  }

  async function sendOrder() {
    if (!tab || cartCount === 0) return;
    const lines = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([dishId, qty]) => ({ dishId, qty, note: notes[dishId]?.trim() || undefined }));
    const next = await act({ action: "add", tabId: tab.id, lines }, t.sent);
    if (next) resetOrder();
  }

  async function removeItem(itemId: string) {
    if (!window.confirm(t.removeAsk)) return;
    await act({ action: "cancelItem", itemId }, "");
  }

  async function pay(method: Method) {
    if (!tab) return;
    const cents = Math.round(Number(amount.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 1 || cents > leftCents) {
      setError(t.badAmount);
      return;
    }
    const next = await act(
      { action: "pay", tabId: tab.id, method, ...(cents < leftCents ? { amountCents: cents } : {}) },
      "",
    );
    if (!next) return;
    const still = next.tabs.find((x) => x.id === tab.id);
    if (still) {
      const left = still.totalCents - still.paidCents;
      setNotice(t.partPaid(fmt(left)));
      setAmount(toAmount(left));
    } else {
      setNotice(t.paid);
      setTabId(null);
      resetOrder();
    }
  }

  async function cancelTab() {
    if (!tab || !window.confirm(t.cancelTabAsk)) return;
    const next = await act({ action: "cancelTab", tabId: tab.id }, t.cancelled);
    if (next) {
      setTabId(null);
      resetOrder();
    }
  }

  async function joinTables() {
    const next = await send(`${base}/staff-tables`, { action: "join", tableIds: picked }, t.joined);
    if (next) {
      setJoining(false);
      setPicked([]);
      await load();
    }
  }

  async function separate(groupId: string) {
    const next = await send(`${base}/staff-tables`, { action: "separate", groupId }, t.separated);
    if (next) await load();
  }

  const messages = (
    <>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-800">
          {notice}
        </p>
      )}
    </>
  );

  // ========================================
  // CUENTA DE UNA MESA
  // ========================================

  if (tab) {
    return (
      <div className="mt-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setTabId(null);
              resetOrder();
            }}
            className="text-sm font-bold text-[#a3341f]"
          >
            {t.back}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="rounded-xl border border-[#eaded3] bg-white px-3 py-2 text-xs font-bold disabled:opacity-50"
          >
            {t.refresh}
          </button>
        </div>

        <header className="rounded-2xl border-2 border-[#a3341f] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#a3341f]">{t.busy}</p>
          <h2 className="mt-1 text-2xl font-black text-[#302018]">{tab.tableLabel}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {t.people(tab.partySize)} · {t.since(minutesSince(tab.openedAt))}
          </p>
        </header>

        {messages}
        {data && !data.isOpen && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">{t.closedDay}</p>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_22rem] lg:items-start">
          {/* MENÚ */}
          <section className="rounded-2xl border border-[#eaded3] bg-white p-4">
            <h3 className="text-lg font-black text-[#302018]">{t.order}</h3>
            <ul className="mt-3 divide-y divide-[#f1e7dd]">
              {(data?.menu ?? []).map((dish) => {
                const qty = cart[dish.id] ?? 0;
                const out = dish.soldOut || dish.portions <= 0;
                const max = Math.min(99, dish.portions);
                return (
                  <li key={dish.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className={`font-bold ${out ? "text-gray-400" : "text-[#302018]"}`}>
                          {es ? dish.nameEs : dish.nameEn}
                        </p>
                        <p className="text-xs text-gray-500">
                          {fmt(dish.priceCents)} · {out ? t.soldOut : t.left(dish.portions)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`- ${es ? dish.nameEs : dish.nameEn}`}
                          disabled={qty === 0 || busy}
                          onClick={() => setCart((c) => ({ ...c, [dish.id]: Math.max(0, qty - 1) }))}
                          className="size-10 rounded-full border border-[#eaded3] text-lg font-bold disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-black tabular-nums">{qty}</span>
                        <button
                          type="button"
                          aria-label={`+ ${es ? dish.nameEs : dish.nameEn}`}
                          disabled={out || qty >= max || busy || !data?.isOpen}
                          onClick={() => setCart((c) => ({ ...c, [dish.id]: qty + 1 }))}
                          className="size-10 rounded-full bg-[#a3341f] text-lg font-bold text-white disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    {qty > 0 && (
                      <input
                        type="text"
                        maxLength={140}
                        value={notes[dish.id] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [dish.id]: e.target.value }))}
                        placeholder={t.notePh}
                        aria-label={t.noteFor}
                        className="mt-2 w-full rounded-lg border border-[#eaded3] px-3 py-2 text-sm"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => void sendOrder()}
              disabled={busy || cartCount === 0}
              className="sticky bottom-3 mt-3 w-full rounded-xl bg-[#a3341f] px-5 py-4 text-base font-black text-white shadow-lg disabled:opacity-40"
            >
              {t.send(cartCount)}
            </button>
          </section>

          {/* CUENTA */}
          <section className="rounded-2xl border border-[#eaded3] bg-white p-4">
            <h3 className="text-lg font-black text-[#302018]">{t.items}</h3>
            {tab.items.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">{t.empty}</p>
            ) : (
              <ul className="mt-3 divide-y divide-[#f1e7dd]">
                {tab.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 py-2 text-sm">
                    <span className="w-6 font-black tabular-nums">{item.qty}×</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{dishName(item.dishId)}</p>
                      {item.note && <p className="text-xs text-gray-500">“{item.note}”</p>}
                    </div>
                    <span className="tabular-nums">{fmt(item.qty * item.priceCents)}</span>
                    <button
                      type="button"
                      onClick={() => void removeItem(item.id)}
                      disabled={busy}
                      aria-label={`${t.remove} ${dishName(item.dishId)}`}
                      className="rounded-full px-2 text-gray-400 hover:text-red-700 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex items-baseline justify-between border-t border-[#eaded3] pt-3">
              <span className="text-sm font-bold text-gray-600">{t.total}</span>
              <span className="text-2xl font-black tabular-nums text-[#302018]">{fmt(tab.totalCents)}</span>
            </div>

            {tab.paidCents > 0 && (
              <div className="mt-3 rounded-xl bg-[#fff7ef] p-3 text-sm">
                <ul className="space-y-1">
                  {tab.payments.map((p) => (
                    <li key={p.id} className="flex justify-between text-gray-700">
                      <span>✓ {t[p.method]}</span>
                      <span className="tabular-nums">{fmt(p.amountCents)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex justify-between border-t border-[#eaded3] pt-2 font-black text-[#302018]">
                  <span>{t.leftToPay}</span>
                  <span className="tabular-nums">{fmt(leftCents)}</span>
                </p>
              </div>
            )}

            {!paying ? (
              <button
                type="button"
                onClick={() => {
                  setAmount(toAmount(leftCents));
                  setPaying(true);
                }}
                disabled={busy || tab.items.length === 0 || leftCents === 0}
                className="mt-4 w-full rounded-xl bg-[#244D38] px-5 py-4 text-base font-black text-white disabled:opacity-40"
              >
                {t.charge(fmt(leftCents))}
              </button>
            ) : (
              <div className="mt-4 rounded-xl bg-[#EDF4E9] p-3">
                <label className="block text-sm font-bold text-[#244D38]" htmlFor="pay-amount">
                  {t.amount}
                </label>
                <input
                  id="pay-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                  className="mt-1 w-full rounded-lg border border-[#cfe0c6] bg-white px-3 py-2 text-lg font-black tabular-nums"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAmount(toAmount(leftCents))}
                    className="rounded-full border border-[#244D38] px-3 py-1 text-xs font-bold text-[#244D38]"
                  >
                    {t.all}
                  </button>
                  {tab.partySize > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setAmount(toAmount(Math.min(leftCents, Math.ceil(tab.totalCents / tab.partySize))))
                      }
                      className="rounded-full border border-[#244D38] px-3 py-1 text-xs font-bold text-[#244D38]"
                    >
                      {t.perPerson(tab.partySize)}
                    </button>
                  )}
                </div>
                <p className="mt-3 text-sm font-bold text-[#244D38]">{t.howPay}</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["cash", "card", "transfer"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => void pay(m)}
                      disabled={busy}
                      className="min-w-0 rounded-lg bg-[#244D38] px-1 py-3 text-xs font-bold leading-tight text-white [overflow-wrap:anywhere] disabled:opacity-40 sm:text-sm"
                    >
                      {t[m]}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPaying(false)}
                  className="mt-2 w-full text-xs font-bold text-gray-600"
                >
                  {t.cancel}
                </button>
              </div>
            )}

            {tab.paidCents === 0 && (
            <button
              type="button"
              onClick={() => void cancelTab()}
              disabled={busy}
              className="mt-4 w-full text-xs font-bold text-red-700 disabled:opacity-40"
            >
              {t.cancelTab}
            </button>
            )}
          </section>
        </div>
      </div>
    );
  }

  // ========================================
  // TODAS LAS MESAS
  // ========================================

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-600">{data ? t.summary(freeCount, busyCount) : ""}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setJoining((j) => !j);
              setPicked([]);
            }}
            disabled={busy}
            className={`rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50 ${
              joining ? "bg-[#302018] text-white" : "border border-[#eaded3] bg-white"
            }`}
          >
            {joining ? t.cancel : t.join}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="rounded-xl border border-[#eaded3] bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            {t.refresh}
          </button>
        </div>
      </div>

      {messages}
      {data && !data.isOpen && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">{t.closedDay}</p>
      )}

      {joining && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fff7ef] p-3">
          <p className="text-sm font-semibold text-[#806b5d]">{t.joinPick}</p>
          <button
            type="button"
            onClick={() => void joinTables()}
            disabled={busy || picked.length < 2}
            className="rounded-xl bg-[#a3341f] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {t.joinDo(picked.length)}
          </button>
        </div>
      )}

      {loading && !data ? (
        <p className="text-sm text-gray-600">{t.loading}</p>
      ) : places.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#eaded3] bg-white p-6 text-center text-sm text-gray-600">
          {t.noTables}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {places.map((place) => {
            const isPicked = picked.includes(place.tableId);
            const canPick = joining && !place.tab && place.active && !place.groupId;
            const state = !place.active ? t.inactive : place.tab ? t.busy : t.free;

            const onTap = () => {
              if (joining) {
                if (canPick)
                  setPicked((p) => (isPicked ? p.filter((x) => x !== place.tableId) : [...p, place.tableId]));
                return;
              }
              if (!place.active) return;
              setError("");
              setNotice("");
              if (place.tab) {
                resetOrder();
                setTabId(place.tab.id);
              } else {
                setParty(Math.min(place.capacity, 50) || 2);
                setOpening(place);
              }
            };

            return (
              <div
                key={place.key}
                className={`flex flex-col rounded-2xl border-2 bg-white p-4 text-left ${
                  isPicked
                    ? "border-[#302018]"
                    : place.tab
                      ? "border-[#a3341f]"
                      : "border-[#eaded3]"
                } ${!place.active || (joining && !canPick) ? "opacity-50" : ""}`}
              >
                <button
                  type="button"
                  onClick={onTap}
                  disabled={busy || !place.active || (joining && !canPick)}
                  className="flex-1 text-left"
                >
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      place.tab
                        ? "bg-[#a3341f] text-white"
                        : place.active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {joining && canPick ? (isPicked ? "✓" : "○") : state}
                  </span>
                  <span className="mt-2 block text-lg font-black leading-tight text-[#302018]">{place.label}</span>
                  {place.tab ? (
                    <>
                      <span className="mt-1 block text-xs text-gray-600">
                        {t.people(place.tab.partySize)} · {t.since(minutesSince(place.tab.openedAt))}
                      </span>
                      <span className="mt-2 block text-xl font-black tabular-nums text-[#a3341f]">
                        {fmt(place.tab.totalCents)}
                      </span>
                    </>
                  ) : (
                    <span className="mt-1 block text-xs text-gray-600">{t.seats(place.capacity)}</span>
                  )}
                </button>
                {place.groupId && !place.tab && !joining && (
                  <button
                    type="button"
                    onClick={() => void separate(place.groupId!)}
                    disabled={busy}
                    className="mt-3 rounded-lg border border-[#a3341f] px-3 py-1.5 text-xs font-bold text-[#a3341f] disabled:opacity-40"
                  >
                    {t.separate}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ABRIR MESA */}
      {opening && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="open-table-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setOpening(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-bold uppercase tracking-widest text-[#a3341f]">{t.open}</p>
            <h2 id="open-table-title" className="mt-1 text-2xl font-black text-[#302018]">
              {opening.label}
            </h2>
            <p className="mt-4 text-sm font-bold text-gray-700">{t.howMany}</p>
            <div className="mt-2 flex items-center justify-center gap-5">
              <button
                type="button"
                onClick={() => setParty((p) => Math.max(1, p - 1))}
                className="size-12 rounded-full border border-[#eaded3] text-2xl font-bold"
                aria-label="−"
              >
                −
              </button>
              <span className="w-12 text-center text-4xl font-black tabular-nums">{party}</span>
              <button
                type="button"
                onClick={() => setParty((p) => Math.min(50, p + 1))}
                className="size-12 rounded-full border border-[#eaded3] text-2xl font-bold"
                aria-label="+"
              >
                +
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOpening(null)}
                className="rounded-xl border border-[#eaded3] px-4 py-3 text-sm font-bold"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => void openTable()}
                disabled={busy}
                className="rounded-xl bg-[#a3341f] px-4 py-3 text-sm font-black text-white disabled:opacity-40"
              >
                {t.open}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function minutesSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}
