
"use client";

import Image from "next/image";
import { OwnerOperationsPanel } from "@/components/OwnerOperationsPanel";
import OwnerRewardPinCard from "@/components/OwnerRewardPinCard";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Dictionary } from "@/dictionaries";
import { clock, fill, money, qty } from "@/lib/format";
import { menuAvailability } from "@/lib/inventory";


import {
  type CashUp,
  cardLabel,
  type OwnerView,
  phoneCardId,
  type Reservation,
} from "@/lib/stall";

type Ticket = Record<string, number>;
type Toast = { kind: "ok" | "bad"; text: string } | null;

const POLL_MS = 10_000;

export function OwnerPanel({
  initial,
  lang,
  timezone,
  t,
  demo,
  canSignOut,
}: {
  initial: OwnerView;
  lang: string;
  timezone: string;
  t: Dictionary;
  demo: boolean;
  canSignOut: boolean;
}) {
  const o = t.owner;
  const es = lang === "es";

  const [view, setView] = useState(initial);
  const [ticket, setTicket] = useState<Ticket>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [opening, setOpening] = useState(false);
  const [cashUp, setCashUp] = useState<CashUp | null>(null);
  const [restocking, setRestocking] = useState(false);
  const [phone, setPhone] = useState("");
  const [logoFailed, setLogoFailed] = useState(false);

  const name = useCallback(
    (d: { nameEs: string; nameEn: string }) =>
      es ? d.nameEs : d.nameEn,
    [es],
  );

  const fmt = useCallback(
    (c: number) => money(c, view.currency, lang),
    [view.currency, lang],
  );

  useEffect(() => {
    const id = setInterval(async () => {
      if (busy) return;

      const res = await fetch(
        `/api/stalls/${view.slug}?view=owner`,
        { cache: "no-store" },
      ).catch(() => null);

      if (res?.ok) setView(await res.json());
    }, POLL_MS);

    return () => clearInterval(id);
  }, [view.slug, busy]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  type ActResult = OwnerView & {
    closedCashUp?: CashUp;
    error?: string;
    short?: string[];
    stamped?: { cardId: string; stamps: number };
  };

  async function act(body: object): Promise<ActResult | null> {
    setBusy(true);

    try {
      const res = await fetch(`/api/stalls/${view.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        window.location.reload();
        return null;
      }

      const json = await res.json();
      if (res.ok) setView(json);
      return json;
    } catch {
      setToast({
        kind: "bad",
        text: "Error de conexión / Connection error",
      });
      return null;
    } finally {
      setBusy(false);
    }
  }

  const lines = useMemo(() => {
    const left = new Map(
      view.dishes.map((d) => [d.id, d.portions]),
    );

    return Object.entries(ticket)
      .map(([dishId, n]) => ({
        dishId,
        qty: Math.min(n, left.get(dishId) ?? 0),
      }))
      .filter((l) => l.qty > 0);
  }, [ticket, view.dishes]);

  const ticketTotal = lines.reduce(
    (sum, l) =>
      sum +
      (view.dishes.find((d) => d.id === l.dishId)?.priceCents ??
        0) *
        l.qty,
    0,
  );

  function add(dishId: string, delta: number) {
    const left =
      view.dishes.find((d) => d.id === dishId)?.portions ?? 0;

    setTicket((cur) => ({
      ...cur,
      [dishId]: Math.max(
        0,
        Math.min(cur[dishId] ?? 0, left) + delta,
      ),
    }));
  }

  const rewardName = useMemo(() => {
    const d = view.dishes.find(
      (x) => x.id === view.loyalty.rewardDishId,
    );
    return d ? name(d).toLowerCase() : "";
  }, [view.dishes, view.loyalty.rewardDishId, name]);

  const stampNote = (stamps: number) =>
    stamps >= view.loyalty.stampsPerReward
      ? fill(o.stampFull, { reward: rewardName })
      : fill(o.stampsLine, {
          have: stamps,
          n: view.loyalty.stampsPerReward,
        });

  async function charge(method: "cash" | "card") {
    if (!lines.length || busy) return;

    if (phone.trim() && !phoneCardId(phone)) {
      setToast({ kind: "bad", text: o.badPhone });
      return;
    }

    const r = await act({
      action: "sale",
      lines,
      method,
      customerPhone: phone.trim() || undefined,
    });

    if (!r) return;

    if (r.error === "short") {
      const names = (r.short ?? [])
        .map(
          (id) =>
            view.ingredients.find((i) => i.id === id)?.name ?? id,
        )
        .join(", ");

      setToast({
        kind: "bad",
        text: names
          ? fill(o.short, { items: names })
          : o.shortSoldOut,
      });
    } else if (r.error === "closed") {
      setToast({ kind: "bad", text: o.closedError });
    } else if (r.error) {
      setToast({ kind: "bad", text: r.error });
    } else {
      const sold = fill(o.sold, {
        total: fmt(ticketTotal),
      });

      setToast({
        kind: "ok",
        text: r.stamped
          ? `${sold} · ${stampNote(r.stamped.stamps)}`
          : sold,
      });

      setTicket({});
      setPhone("");
    }
  }

  async function close() {
    const r = await act({ action: "close" });
    if (r?.closedCashUp) {
      setCashUp(r.closedCashUp);
      setTicket({});
    }
  }

  const pendingReservations = view.reservations.filter(
    (r) =>
      r.status === "held" || r.status === "authorized",
  ).length;

  return (
    <div className="flex min-w-0 flex-1 flex-col pb-48">
      {/* ENCABEZADO */}
      <header className="border-b border-[#eaded3] bg-[#fffaf4] px-4 pb-6 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-4 sm:gap-6">
              <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#ead4bc] bg-[#fff4e4] shadow-sm sm:size-28">
                {logoFailed ? (
                  <span className="text-2xl font-black text-brand">
                    BDL
                  </span>
                ) : (
                  <Image
                    src={view.settings?.logoUrl || "/logo-birria-dona-lupe.png"}
                    alt={`Logo de ${view.name}`}
                    fill
                    sizes="(min-width: 640px) 112px, 80px"
                    className="object-contain p-1"
                    onError={() => setLogoFailed(true)}
                    unoptimized={Boolean(view.settings?.logoUrl)}
                  />
                )}
              </div>

              <div className="min-w-0">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#a63822]">
                  {o.title}
                </p>

                <h1 className="break-words text-3xl font-black leading-tight tracking-tight text-[#302018] sm:text-4xl">
                  {view.name}
                </h1>

                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-bold">
                  <span
                    className={`size-2.5 rounded-full ${
                      view.isOpen ? "bg-ok" : "bg-bad"
                    }`}
                  />
                  <span
                    className={
                      view.isOpen ? "text-ok" : "text-bad"
                    }
                  >
                    {view.isOpen ? t.open : t.closed}
                  </span>
                </div>
              </div>
            </div>

            {/* TARJETAS DE RESUMEN */}
            <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
              <div className="rounded-2xl border border-[#eaded3] bg-white px-4 py-5 shadow-sm">
                <p className="text-xs font-semibold text-muted">
                  {o.todaySales}
                </p>
                <p className="mt-2 break-words text-2xl font-black tabular-nums text-[#a63822] sm:text-3xl">
                  {fmt(view.today.totalCents)}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {fill(o.salesCount, {
                    n: view.today.salesCount,
                  })}
                </p>
              </div>

              <div className="rounded-2xl border border-[#eaded3] bg-white px-4 py-5 shadow-sm">
                <p className="text-xs font-semibold text-muted">
                  {o.reservations}
                </p>
                <p className="mt-2 text-3xl font-black tabular-nums text-[#302018]">
                  {pendingReservations}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {es ? "Pendientes" : "Pending"}
                </p>
              </div>
            </div>
          </div>

          {/* NAVEGACIÓN Y ACCIONES */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/${es ? "en" : "es"}/panel/${view.slug}`}
              className="inline-flex items-center gap-2 rounded-xl border border-[#eaded3] bg-white px-4 py-3 text-sm font-semibold text-[#4b3024] shadow-sm transition hover:border-brand hover:text-brand"
              title={es ? "Switch to English" : "Cambiar a español"}
            >
              {es ? "English" : "Español"}
            </Link>

            <Link
              href={`/${lang}/${view.slug}`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl border border-[#eaded3] bg-white px-4 py-3 text-sm font-semibold text-[#4b3024] shadow-sm transition hover:border-brand hover:text-brand"
            >
              {o.publicPage}
            </Link>

            <Link
              href={`/${lang}/panel/${view.slug}/corte`}
              className="inline-flex items-center gap-2 rounded-xl border border-[#eaded3] bg-white px-4 py-3 text-sm font-semibold text-[#4b3024] shadow-sm transition hover:border-brand hover:text-brand"
            >
              {o.studioLink}
            </Link>

            <Link
              href={`/${lang}/panel/${view.slug}/menu`}
              className="inline-flex items-center gap-2 rounded-xl border border-[#eaded3] bg-white px-4 py-3 text-sm font-semibold text-[#4b3024] shadow-sm transition hover:border-brand hover:text-brand"
            >
              {t.menu.link}
            </Link>

            {/* NUEVO: CONFIGURACIÓN DEL NEGOCIO */}
            <Link
              href={`/${lang}/panel/${view.slug}/configuracion`}
              className="inline-flex items-center gap-2 rounded-xl border border-[#eaded3] bg-white px-4 py-3 text-sm font-semibold text-[#4b3024] shadow-sm transition hover:border-brand hover:text-brand"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                <circle cx="12" cy="12" r="8" />
              </svg>
              {es ? "Configuración" : "Settings"}
            </Link>

            <div className="hidden flex-1 lg:block" />

            {view.isOpen && (
              <button
                type="button"
                onClick={() => setRestocking(true)}
                disabled={busy}
                className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                {o.restock}
              </button>
            )}

            {view.isOpen ? (
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="rounded-xl border border-[#eaded3] bg-white px-5 py-3 text-sm font-bold text-[#422c20] transition hover:border-brand active:scale-95 disabled:opacity-50"
              >
                {o.closeDay}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setOpening(true)}
                disabled={busy}
                className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white active:scale-95 disabled:opacity-50"
              >
                {o.openDay}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* GUÍA */}
      <details className="mx-4 mt-5 rounded-2xl border border-[#edd9cc] bg-[#fff4e9] px-5 py-4 text-sm sm:mx-6 lg:mx-8">
        <summary className="cursor-pointer font-bold text-brand">
          {o.guideTitle}
        </summary>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 leading-relaxed">
          {o.guide.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>

      {/* APARTADOS Y PIN EN DOS COLUMNAS */}
      <OwnerOperationsPanel
        lang={lang}
        hasReservations={view.reservations.length > 0}
        pin={<OwnerRewardPinCard slug={view.slug} lang={lang} />}
        reservations={
          <Reservations
        view={view}
        t={t}
        lang={lang}
        timezone={timezone}
        fmt={fmt}
        busy={busy}
        onDeliver={async (id, proof) => {
          const r = await act({
            action: "deliver",
            reservationId: id,
            ...proof,
          });

          // A wrong code or last name stays in the dialog for another try.
          if (r?.error === "wrong_code" || r?.error === "wrong_last_name") return r.error;
          if (r?.error) {
            setToast({
              kind: "bad",
              text: o.paypalError,
            });
          } else if (r) {
            setToast({
              kind: "ok",
              text: o.delivered,
            });
          }
          return null;
        }}
        onCancel={async (id) => {
          const r = await act({
            action: "cancelReservation",
            reservationId: id,
          });

          if (r?.error) {
            setToast({
              kind: "bad",
              text: o.paypalError,
            });
          } else if (r) {
            setToast({
              kind: "ok",
              text: o.reservationCancelled,
            });
          }
        }}
        onRedeem={async (id, reward) => {
          const r = await act({
            action: "redeem",
            reservationId: id,
          });

          if (!r) return;

          if (!r.error) {
            setToast({
              kind: "ok",
              text: fill(o.redeemed, { reward }),
            });
          } else {
            setToast({
              kind: "bad",
              text:
                r.error === "closed"
                  ? o.closedError
                  : r.error === "short"
                    ? o.redeemShort
                    : o.redeemNotEnough,
            });
          }
        }}
          />
        }
      />

      {/* PUNTO DE VENTA */}
      <div className="px-4 pt-8 sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
          {es ? "Punto de venta" : "Point of sale"}
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-[#302018] sm:text-3xl">
          {o.sell}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {o.sellHint}
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 lg:px-8 2xl:grid-cols-4">
        {view.dishes.map((d) => {
          const out = d.portions === 0;

          const inTicket =
            lines.find((l) => l.dishId === d.id)?.qty ?? 0;

          return (
            <div
              key={d.id}
              className={`relative flex flex-col overflow-hidden rounded-2xl border-2 bg-surface shadow-sm transition hover:shadow-md ${
                inTicket
                  ? "border-brand bg-brand-soft/20"
                  : "border-[#e9ddd3]"
              } ${out ? "opacity-60" : ""}`}
            >
              <button
                type="button"
                onClick={() => add(d.id, 1)}
                disabled={
                  !view.isOpen ||
                  out ||
                  inTicket >= d.portions ||
                  busy
                }
                className="flex min-h-44 flex-1 flex-col items-start gap-2 p-5 text-left active:scale-[0.98] disabled:active:scale-100"
              >
                <span className="pr-8 text-lg font-extrabold leading-tight text-[#302018] sm:text-xl">
                  {name(d)}
                </span>

                <span className="text-2xl font-black tabular-nums text-brand">
                  {fmt(d.priceCents)}
                </span>

                <span className="flex-1" />

                <span
                  className={`text-sm font-semibold ${
                    out
                      ? "text-bad"
                      : d.portions <= 5
                        ? "text-warn"
                        : "text-ok"
                  }`}
                >
                  {out
                    ? t.soldOut
                    : fill(t.left, { n: d.portions })}
                </span>

                {d.soldOutAt && (
                  <span className="text-xs text-warn">
                    {fill(o.runsOutAt, {
                      time: clock(
                        d.soldOutAt,
                        timezone,
                        lang,
                      ),
                    })}
                    {d.limitingIngredient
                      ? ` ${fill(o.limitedBy, {
                          ingredient: d.limitingIngredient,
                        })}`
                      : ""}
                  </span>
                )}
              </button>

              {inTicket > 0 && (
                <span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {inTicket}
                </span>
              )}

              {view.isOpen &&
                (out && !d.soldOut ? (
                  <button
                    type="button"
                    onClick={() => setRestocking(true)}
                    disabled={busy}
                    className="border-t border-line px-3 py-3 text-sm font-semibold text-brand active:bg-brand-soft"
                  >
                    {o.restockDish}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      act({
                        action: "soldOut",
                        dishId: d.id,
                        soldOut: !d.soldOut,
                      })
                    }
                    disabled={busy}
                    className="border-t border-line px-3 py-3 text-sm font-semibold text-muted active:bg-brand-soft"
                  >
                    {d.soldOut
                      ? o.unmarkSoldOut
                      : o.markSoldOut}
                  </button>
                ))}
            </div>
          );
        })}
      </section>

      {/* CLIENTES Y SELLOS */}
      {view.loyalty.rewardDishId && (
        <Customers
          view={view}
          t={t}
          busy={busy}
          reward={rewardName}
          onStamp={async (body) => {
            const r = await act({
              action: "stamp",
              ...body,
            });

            if (r?.stamped) {
              setToast({
                kind: "ok",
                text: stampNote(r.stamped.stamps),
              });
            } else if (r?.error) {
              setToast({
                kind: "bad",
                text: o.badPhone,
              });
            }
          }}
          onRedeem={async (cardId) => {
            const r = await act({
              action: "redeem",
              cardId,
            });

            if (!r) return;

            if (!r.error) {
              setToast({
                kind: "ok",
                text: fill(o.redeemed, {
                  reward: rewardName,
                }),
              });
            } else {
              setToast({
                kind: "bad",
                text:
                  r.error === "closed"
                    ? o.closedError
                    : r.error === "short"
                      ? o.redeemShort
                      : o.redeemNotEnough,
              });
            }
          }}
        />
      )}

      {/* ACCIONES DE SESIÓN */}
      {(demo || canSignOut) && (
        <footer className="mt-8 flex flex-col items-center gap-3 px-4 text-center text-xs text-muted">
          {demo && (
            <>
              <p>{o.demoNote}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  act({ action: "reset" })
                }
                className="underline"
              >
                {o.reset}
              </button>
            </>
          )}

          {canSignOut && (
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/owner/login", {
                  method: "DELETE",
                }).catch(() => null);

                window.location.reload();
              }}
              className="underline"
            >
              {o.signOut}
            </button>
          )}
        </footer>
      )}

      {/* TICKET FIJO */}
      {view.isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md">
          <div className="mx-auto w-full max-w-md sm:max-w-xl lg:max-w-3xl">
            {lines.length === 0 ? (
              <p className="py-3 text-center text-muted">
                {o.empty}
              </p>
            ) : (
              <>
                <ul className="mb-3 flex max-h-28 flex-col gap-1 overflow-y-auto">
                  {lines.map((l) => {
                    const d = view.dishes.find(
                      (x) => x.id === l.dishId,
                    )!;

                    return (
                      <li
                        key={l.dishId}
                        className="flex items-center gap-2 text-sm"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            add(l.dishId, -1)
                          }
                          className="flex size-7 items-center justify-center rounded-full bg-brand-soft font-bold text-brand"
                          aria-label="-1"
                        >
                          −
                        </button>

                        <span className="w-6 text-center font-semibold tabular-nums">
                          {l.qty}
                        </span>

                        <span className="flex-1 truncate">
                          {name(d)}
                        </span>

                        <span className="tabular-nums">
                          {fmt(
                            d.priceCents * l.qty,
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {view.loyalty.rewardDishId && (
                  <label className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-background px-3 py-2">
                    <span aria-hidden="true">
                      ⭐
                    </span>

                    <input
                      value={phone}
                      onChange={(e) =>
                        setPhone(
                          e.target.value.replace(
                            /[^\d +()-]/g,
                            "",
                          ),
                        )
                      }
                      inputMode="tel"
                      autoComplete="off"
                      placeholder={o.customerPhone}
                      aria-label={o.customerPhone}
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    />
                  </label>
                )}

                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTicket({});
                      setPhone("");
                    }}
                    className="text-sm text-muted underline"
                  >
                    {o.clear}
                  </button>

                  <span className="text-2xl font-black tabular-nums">
                    {fmt(ticketTotal)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => charge("cash")}
                    disabled={busy}
                    className="rounded-2xl bg-brand py-4 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50"
                  >
                    {o.cash}
                  </button>

                  <button
                    type="button"
                    onClick={() => charge("card")}
                    disabled={busy}
                    className="rounded-2xl bg-brand-strong py-4 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50"
                  >
                    {o.card}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MENSAJES */}
      {toast && (
        <div
          role="status"
          className={`fixed inset-x-4 top-4 z-40 mx-auto max-w-md rounded-2xl px-4 py-3 text-center font-semibold shadow-lg ${
            toast.kind === "ok"
              ? "bg-ok text-white"
              : "bg-bad text-white"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* MODALES */}
      {opening && (
        <OpenDialog
          view={view}
          t={t}
          lang={lang}
          busy={busy}
          onCancel={() =>
            setOpening(false)
          }
          onOpen={async (counts) => {
            const r = await act({
              action: "open",
              counts,
            });

            if (r && !r.error) {
              setOpening(false);
            }
          }}
        />
      )}

      {restocking && (
        <RestockDialog
          view={view}
          t={t}
          lang={lang}
          busy={busy}
          onCancel={() =>
            setRestocking(false)
          }
          onRestock={async (adds) => {
            const r = await act({
              action: "restock",
              adds,
            });

            if (r?.error === "closed") {
              setToast({
                kind: "bad",
                text: o.closedError,
              });
            } else if (r && !r.error) {
              setRestocking(false);
              setToast({
                kind: "ok",
                text: o.restocked,
              });
            }
          }}
        />
      )}

      {cashUp && (
        <CashUpDialog
          cashUp={cashUp}
          t={t}
          lang={lang}
          slug={view.slug}
          fmt={fmt}
          onDone={() => setCashUp(null)}
        />
      )}
    </div>
  );
}

/* ========================================
   CONTENEDOR DE MODALES
======================================== */

function Sheet({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-2xl sm:rounded-3xl">
        {children}
      </div>
    </div>
  );
}

/* ========================================
   ABRIR JORNADA
======================================== */

function OpenDialog({
  view,
  t,
  lang,
  busy,
  onCancel,
  onOpen,
}: {
  view: OwnerView;
  t: Dictionary;
  lang: string;
  busy: boolean;
  onCancel: () => void;
  onOpen: (counts: Record<string, number>) => void;
}) {
  const [counts, setCounts] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      view.ingredients.map((i) => [
        i.id,
        String(Math.round(i.stock)),
      ]),
    ),
  );

  const parse = (v: string | undefined) =>
    Math.max(0, Number(v) || 0);

  const ing = new Map(
    view.ingredients.map((i) => [i.id, i]),
  );

  const yields = menuAvailability(
    view.dishes.map((d) => ({
      ...d,
      soldOut: false,
    })),
    view.ingredients.map((i) => ({
      ...i,
      stock: parse(counts[i.id]),
    })),
  );

  return (
    <Sheet>
      <h2 className="text-2xl font-black">
        {t.owner.openTitle}
      </h2>

      <p className="mt-2 text-sm text-muted">
        {t.owner.openHint}
      </p>

      <form
        className="mt-5 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();

          onOpen(
            Object.fromEntries(
              Object.entries(counts).map(
                ([k, v]) => [k, parse(v)],
              ),
            ),
          );
        }}
      >
        {view.ingredients.map((i) => (
          <label
            key={i.id}
            className="flex items-center gap-3"
          >
            <span className="min-w-0 flex-1 font-semibold">
              {i.name}
            </span>

            <input
              inputMode="decimal"
              className="w-28 rounded-xl border border-line bg-background px-3 py-2 text-right text-lg tabular-nums"
              value={counts[i.id]}
              onChange={(e) =>
                setCounts((c) => ({
                  ...c,
                  [i.id]:
                    e.target.value.replace(
                      /[^\d.]/g,
                      "",
                    ),
                }))
              }
              aria-label={`${i.name} (${i.unit})`}
            />

            <span className="w-8 text-sm text-muted">
              {i.unit}
            </span>
          </label>
        ))}

        <div className="mt-2 rounded-2xl bg-brand-soft p-4 text-sm">
          <p className="font-bold">
            {t.owner.openYields}:
          </p>

          <ul className="mt-3 flex flex-col gap-3">
            {view.dishes.map((d) => {
              const n =
                yields.find(
                  (y) => y.dishId === d.id,
                )?.portions ?? 0;

              const recipe = d.recipe
                .map((r) => {
                  const i = ing.get(
                    r.ingredientId,
                  );

                  return i
                    ? `${qty(
                        r.qty,
                        i.unit,
                        lang,
                      )} ${i.name}`
                    : null;
                })
                .filter(Boolean)
                .join(", ");

              return (
                <li key={d.id}>
                  <span className="flex justify-between gap-3">
                    <span className="font-semibold">
                      {lang === "es"
                        ? d.nameEs
                        : d.nameEn}
                    </span>

                    <b
                      className={`tabular-nums ${
                        n === 0
                          ? "text-bad"
                          : ""
                      }`}
                    >
                      ~{n}
                    </b>
                  </span>

                  {recipe && (
                    <span className="mt-1 block text-xs text-muted">
                      {t.owner.openRecipe}:{" "}
                      {recipe}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-line py-3 font-semibold"
          >
            {t.owner.cancel}
          </button>

          <button
            type="submit"
            disabled={busy}
            className="rounded-2xl bg-brand py-3 font-bold text-white disabled:opacity-50"
          >
            {t.owner.openConfirm}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/* ========================================
   CORTE DE CAJA
======================================== */

function CashUpDialog({
  cashUp,
  t,
  lang,
  slug,
  fmt,
  onDone,
}: {
  cashUp: CashUp;
  t: Dictionary;
  lang: string;
  slug: string;
  fmt: (c: number) => string;
  onDone: () => void;
}) {
  const o = t.owner;

  return (
    <Sheet>
      <h2 className="text-2xl font-black">
        {o.cashUpTitle}
      </h2>

      <div className="mt-5 rounded-2xl bg-brand-soft p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold">
            {o.total}
          </span>

          <span className="text-3xl font-black tabular-nums">
            {fmt(cashUp.totalCents)}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm">
          <span>
            {o.cash}:{" "}
            <b>
              {fmt(
                cashUp.byMethod.cash,
              )}
            </b>
          </span>

          <span>
            {o.card}:{" "}
            <b>
              {fmt(
                cashUp.byMethod.card,
              )}
            </b>
          </span>

          {cashUp.byMethod.paypal > 0 && (
            <span>
              PayPal:{" "}
              <b>
                {fmt(
                  cashUp.byMethod.paypal,
                )}
              </b>
            </span>
          )}
        </div>

        <p className="mt-3 text-sm text-muted">
          {fill(o.salesCount, {
            n: cashUp.salesCount,
          })}
        </p>
      </div>

      <h3 className="mt-6 text-lg font-bold">
        {o.byDish}
      </h3>

      <ul className="mt-3 flex flex-col gap-3 text-sm">
        {cashUp.byDish.map((d) => (
          <li
            key={d.dishId}
            className="flex justify-between gap-3"
          >
            <span>
              {d.qty} ×{" "}
              {lang === "es"
                ? d.nameEs
                : d.nameEn}
            </span>

            <span className="shrink-0 font-semibold tabular-nums">
              {fmt(d.totalCents)}
            </span>
          </li>
        ))}
      </ul>

      <h3 className="mt-6 text-lg font-bold">
        {o.used}
      </h3>

      <ul className="mt-3 flex flex-col gap-3 text-sm">
        {cashUp.used.map((u) => (
          <li
            key={u.ingredientId}
            className="flex justify-between gap-3"
          >
            <span>{u.name}</span>

            <span className="text-right tabular-nums text-muted">
              {qty(
                u.used,
                u.unit,
                lang,
              )}{" "}
              ·{" "}
              {fill(o.leftOver, {
                n: qty(
                  u.left,
                  u.unit,
                  lang,
                ),
              })}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={`/${lang}/panel/${slug}/corte`}
        className="mt-7 block w-full rounded-2xl border-2 border-brand py-3 text-center font-bold text-brand"
      >
        {o.studioOpen}
      </Link>

      <button
        type="button"
        onClick={onDone}
        className="mt-3 w-full rounded-2xl bg-brand py-3 font-bold text-white"
      >
        {o.done}
      </button>
    </Sheet>
  );
}

/* ========================================
   RESERVACIONES
======================================== */

function Reservations({
  view,
  t,
  lang,
  timezone,
  fmt,
  busy,
  onDeliver,
  onCancel,
  onRedeem,
}: {
  view: OwnerView;
  t: Dictionary;
  lang: string;
  timezone: string;
  fmt: (c: number) => string;
  busy: boolean;
  onDeliver: (
    id: string,
    proof: { code?: string; lastName?: string },
  ) => Promise<string | null>;
  onCancel: (id: string) => void;
  onRedeem: (
    id: string,
    reward: string,
  ) => void;
}) {
  const o = t.owner;
  // The reservation whose code is being asked for at the counter.
  const [handing, setHanding] = useState<Reservation | null>(null);

  const active = view.reservations.filter(
    (r) =>
      r.status === "held" ||
      r.status === "authorized",
  );

  const deliver = (r: Reservation) => {
    if (r.pickupCode) setHanding(r);
    else void onDeliver(r.id, {});
  };

  const done = view.reservations
    .filter(
      (r) =>
        r.status !== "held" &&
        r.status !== "authorized",
    )
    .slice(-3)
    .reverse();

  if (
    active.length === 0 &&
    done.length === 0
  ) {
    return null;
  }

  const dish = new Map(
    view.dishes.map((d) => [
      d.id,
      lang === "es"
        ? d.nameEs
        : d.nameEn,
    ]),
  );

  const items = (r: Reservation) =>
    r.lines
      .map(
        (l) =>
          `${l.qty} × ${
            dish.get(l.dishId) ??
            l.dishId
          }`,
      )
      .join(", ");

  const {
    stampsPerReward: per,
    rewardDishId,
  } = view.loyalty;

  const reward = rewardDishId
    ? (
        dish.get(rewardDishId) ??
        ""
      ).toLowerCase()
    : "";

  const stamps = (
    r: Reservation,
    compact = false,
  ) => {
    if (
      !r.payerId ||
      !rewardDishId
    ) {
      return null;
    }

    const have =
      view.loyalty.stamps[
        r.payerId
      ] ?? 0;

    if (have < per) {
      return compact ? null : (
        <p className="mt-2 text-sm text-muted">
          {fill(o.stampsLine, {
            have,
            n: per,
          })}
        </p>
      );
    }

    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warn-soft px-4 py-3 text-warn">
        <p className="text-sm font-semibold">
          {fill(o.rewardReady, {
            name: r.customerName,
            reward,
          })}
        </p>

        <button
          type="button"
          onClick={() =>
            onRedeem(
              r.id,
              reward,
            )
          }
          disabled={busy}
          className="rounded-full bg-warn px-4 py-2 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
        >
          {o.redeem}
        </button>
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-3 px-4 pt-7 sm:px-6 lg:px-8">
      <h2 className="text-xl font-black tracking-tight text-[#302018] sm:text-2xl">
        {o.reservations}

        {active.length > 0 && (
          <span className="text-brand">
            {" "}· {active.length}
          </span>
        )}
      </h2>

      {handing && (
        <HandOverDialog
          r={handing}
          items={items(handing)}
          t={t}
          busy={busy}
          onClose={() => setHanding(null)}
          onDeliver={async (proof) => {
            const error = await onDeliver(handing.id, proof);
            if (!error) setHanding(null);
            return error;
          }}
        />
      )}

      {active.map((r) => (
        <article
          key={r.id}
          className="rounded-2xl border border-[#e9d4c5] bg-surface p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xl font-extrabold text-[#302018]">
                {r.orderNumber && (
                  <span className="mr-2 text-brand">#{r.orderNumber}</span>
                )}
                {r.customerName}
              </p>

              <p className="mt-1 text-sm">
                {items(r)}
              </p>
            </div>

            <p className="text-xl font-black tabular-nums text-brand">
              {fmt(
                r.totalCents,
              )}
            </p>
          </div>

          <p
            className={`mt-3 text-sm font-semibold ${
              r.status === "authorized"
                ? "text-ok"
                : "text-warn"
            }`}
          >
            {r.status === "authorized"
              ? fill(o.paidHeld, {
                  time: clock(
                    r.pickupBy,
                    timezone,
                    lang,
                  ),
                })
              : o.awaitingPayment}
          </p>

          {stamps(r)}

          <div className="mt-5 grid grid-cols-[1fr_auto] gap-3">
            <button
              type="button"
              onClick={() => deliver(r)}
              disabled={
                busy ||
                r.status !== "authorized"
              }
              className="rounded-xl bg-ok px-5 py-3.5 text-base font-bold text-white active:scale-[0.98] disabled:opacity-40"
            >
              {o.deliver}
            </button>

            <button
              type="button"
              onClick={() =>
                onCancel(r.id)
              }
              disabled={busy}
              className="rounded-xl border border-line px-5 py-3.5 font-semibold active:scale-[0.98] disabled:opacity-40"
            >
              {o.cancel}
            </button>
          </div>
        </article>
      ))}

      {done.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-line/60 bg-surface/60 px-4 py-3"
        >
          <p className="flex justify-between gap-3 text-sm text-muted">
            <span className="min-w-0 truncate">
              {r.orderNumber ? `#${r.orderNumber} · ` : ""}
              {r.customerName} ·{" "}
              {items(r)}
            </span>

            <span className="shrink-0">
              {
                o.reservationStatus[
                  r.status
                ]
              }
            </span>
          </p>

          {r.status ===
            "captured" &&
            stamps(r, true)}
        </div>
      ))}
    </section>
  );
}

/* ========================================
   ENTREGA CON CÓDIGO
======================================== */

function HandOverDialog({
  r,
  items,
  t,
  busy,
  onClose,
  onDeliver,
}: {
  r: Reservation;
  items: string;
  t: Dictionary;
  busy: boolean;
  onClose: () => void;
  onDeliver: (proof: { code?: string; lastName?: string }) => Promise<string | null>;
}) {
  const o = t.owner;
  const [code, setCode] = useState("");
  const [lastName, setLastName] = useState("");
  const [noCode, setNoCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped on each wrong try so the boxes shake again.
  const [tries, setTries] = useState(0);

  async function submit(proof: { code?: string; lastName?: string }) {
    const e = await onDeliver(proof);
    if (!e) return;
    setError(e === "wrong_code" ? o.handWrongCode : o.handWrongLastName);
    setTries((n) => n + 1);
    if (e === "wrong_code") setCode("");
  }

  function type(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setCode(digits);
    setError(null);
    if (digits.length === 4) void submit({ code: digits });
  }

  return (
    <Sheet>
      <p className="text-sm font-bold uppercase tracking-wide text-muted">{o.handTitle}</p>
      <p className="mt-2 text-2xl font-black text-[#302018]">
        {r.orderNumber && <span className="text-brand">#{r.orderNumber} · </span>}
        {r.customerName}
      </p>
      <p className="mt-1 text-sm">{items}</p>

      {!noCode ? (
        <>
          <p className="mt-6 font-semibold">{o.handAskCode}</p>
          <label key={tries} className={`relative mt-3 flex justify-center gap-3 ${tries ? "animate-shake" : ""}`}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`flex h-16 w-14 items-center justify-center rounded-2xl border-2 font-mono text-3xl font-black ${
                  error ? "border-bad text-bad" : i === code.length ? "border-brand" : "border-line"
                }`}
              >
                {code[i] ?? ""}
              </span>
            ))}
            <input
              autoFocus
              value={code}
              onChange={(e) => type(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label={o.handAskCode}
              disabled={busy}
              className="absolute inset-0 opacity-0"
            />
          </label>
          {error && <p className="mt-3 text-center font-semibold text-bad">{error}</p>}
          <button
            type="button"
            onClick={() => {
              setNoCode(true);
              setError(null);
            }}
            className="mt-5 block w-full text-center text-sm text-muted underline"
          >
            {o.handNoCode}
          </button>
        </>
      ) : (
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit({ lastName });
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="font-semibold">{o.handAskLastName}</span>
            <input
              autoFocus
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setError(null);
              }}
              className={`rounded-xl border-2 bg-background px-4 py-3 text-lg ${error ? "border-bad" : "border-line"}`}
            />
          </label>
          {error && <p key={tries} className="animate-shake font-semibold text-bad">{error}</p>}
          <button
            type="submit"
            disabled={busy || lastName.trim().length < 2}
            className="rounded-xl bg-ok px-5 py-3.5 font-bold text-white disabled:opacity-40"
          >
            {o.deliver}
          </button>
          <button type="button" onClick={() => setNoCode(false)} className="text-sm text-muted underline">
            {o.handBackToCode}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full rounded-xl border border-line px-5 py-3 font-semibold"
      >
        {o.handCancel}
      </button>
    </Sheet>
  );
}

/* ========================================
   REABASTECIMIENTO
======================================== */

function RestockDialog({
  view,
  t,
  lang,
  busy,
  onCancel,
  onRestock,
}: {
  view: OwnerView;
  t: Dictionary;
  lang: string;
  busy: boolean;
  onCancel: () => void;
  onRestock: (
    adds: Record<
      string,
      number
    >,
  ) => void;
}) {
  const o = t.owner;

  const [adds, setAdds] =
    useState<
      Record<string, string>
    >({});

  const parsed = Object.fromEntries(
    Object.entries(adds)
      .map(
        ([k, v]) =>
          [
            k,
            Number(v) || 0,
          ] as const,
      )
      .filter(([, n]) => n > 0),
  );

  return (
    <Sheet>
      <h2 className="text-2xl font-black">
        {o.restockTitle}
      </h2>

      <p className="mt-2 text-sm text-muted">
        {o.restockHint}
      </p>

      <form
        className="mt-5 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();

          if (
            Object.keys(parsed).length
          ) {
            onRestock(parsed);
          }
        }}
      >
        {view.ingredients.map((i) => (
          <label
            key={i.id}
            className="flex items-center gap-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {i.name}
              </span>

              <span
                className={`mt-1 block text-xs ${
                  i.stock <= 0
                    ? "font-semibold text-bad"
                    : "text-muted"
                }`}
              >
                {fill(o.youHave, {
                  n: qty(
                    i.stock,
                    i.unit,
                    lang,
                  ),
                })}
              </span>
            </span>

            <span className="text-lg text-muted">
              +
            </span>

            <input
              inputMode="decimal"
              placeholder="0"
              className="w-24 rounded-xl border border-line bg-background px-3 py-2 text-right text-lg tabular-nums"
              value={
                adds[i.id] ?? ""
              }
              onChange={(e) =>
                setAdds((c) => ({
                  ...c,
                  [i.id]:
                    e.target.value.replace(
                      /[^\d.]/g,
                      "",
                    ),
                }))
              }
              aria-label={`${o.restock} ${i.name} (${i.unit})`}
            />

            <span className="w-8 text-sm text-muted">
              {i.unit}
            </span>
          </label>
        ))}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-line py-3 font-semibold"
          >
            {o.cancel}
          </button>

          <button
            type="submit"
            disabled={
              busy ||
              !Object.keys(parsed)
                .length
            }
            className="rounded-2xl bg-brand py-3 font-bold text-white disabled:opacity-50"
          >
            {o.restockConfirm}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/* ========================================
   CLIENTES Y TARJETAS DE SELLOS
======================================== */

function Customers({
  view,
  t,
  busy,
  reward,
  onStamp,
  onRedeem,
}: {
  view: OwnerView;
  t: Dictionary;
  busy: boolean;
  reward: string;
  onStamp: (body: {
    cardId?: string;
    phone?: string;
    name?: string;
  }) => void;
  onRedeem: (
    cardId: string,
  ) => void;
}) {
  const o = t.owner;
  const per =
    view.loyalty.stampsPerReward;

  const [query, setQuery] =
    useState("");

  const [name, setName] =
    useState("");

  const q = query
    .trim()
    .toLowerCase();

  const asPhone =
    phoneCardId(query);

  const cards =
    view.loyalty.cards.filter(
      (c) =>
        !q ||
        c.id === asPhone ||
        cardLabel(c)
          .toLowerCase()
          .includes(q) ||
        c.id.includes(
          q.replace(/\D/g, "") ||
            "~",
        ),
    );

  const isNew =
    asPhone !== null &&
    !view.loyalty.cards.some(
      (c) =>
        c.id === asPhone,
    );

  return (
    <section className="flex flex-col gap-3 px-4 pt-7 sm:px-6 lg:px-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
          {o.customers}
        </p>

        <h2 className="mt-2 text-2xl font-black tracking-tight text-[#302018]">
          {o.customers}
        </h2>

        <p className="mt-2 text-sm text-muted">
          {fill(
            o.customersHint,
            {
              n: per,
              reward,
            },
          )}
        </p>
      </div>

      <input
        value={query}
        onChange={(e) =>
          setQuery(
            e.target.value,
          )
        }
        placeholder={
          o.customerSearch
        }
        className="rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-brand"
        aria-label={
          o.customerSearch
        }
      />

      {isNew && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-line p-4">
          <input
            value={name}
            onChange={(e) =>
              setName(
                e.target.value,
              )
            }
            placeholder={
              o.customerName
            }
            className="rounded-xl border border-line bg-background px-4 py-3"
            aria-label={
              o.customerName
            }
          />

          <button
            type="button"
            onClick={() => {
              onStamp({
                phone: query,
                name,
              });
              setName("");
            }}
            disabled={busy}
            className="rounded-xl bg-brand py-3 font-bold text-white active:scale-[0.98] disabled:opacity-40"
          >
            {o.newCard}
          </button>
        </div>
      )}

      {cards.length === 0 &&
        !isNew && (
          <p className="py-3 text-sm text-muted">
            {q
              ? o.noCustomer
              : o.noCards}
          </p>
        )}

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {cards
          .slice(0, 8)
          .map((c) => {
            const ready =
              c.stamps >= per;

            return (
              <li
                key={c.id}
                className={`flex flex-wrap items-center gap-3 rounded-2xl border border-line/60 p-4 shadow-sm ${
                  ready
                    ? "bg-warn-soft"
                    : "bg-surface"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {cardLabel(c)}
                  </p>

                  <p
                    className={`mt-1 text-sm ${
                      ready
                        ? "font-semibold text-warn"
                        : "text-muted"
                    }`}
                  >
                    {ready
                      ? fill(
                          o.stampFull,
                          { reward },
                        )
                      : fill(
                          o.stampsLine,
                          {
                            have:
                              c.stamps,
                            n: per,
                          },
                        )}
                  </p>
                </div>

                {ready && (
                  <button
                    type="button"
                    onClick={() =>
                      onRedeem(
                        c.id,
                      )
                    }
                    disabled={busy}
                    className="rounded-full bg-warn px-4 py-2 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
                  >
                    {o.redeem}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    onStamp({
                      cardId:
                        c.id,
                    })
                  }
                  disabled={busy}
                  className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold active:scale-95 disabled:opacity-40"
                  aria-label={`${o.addStamp} ${cardLabel(c)}`}
                >
                  {o.addStamp}
                </button>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
