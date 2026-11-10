"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { KitchenSnapshot, KitchenTicket } from "@/app/api/businesses/[slug]/kitchen/route";
import { beep } from "@/lib/beep";

// ==========================================
// TODAVÍA HAY
// PANTALLA DE COCINA
// ==========================================
//
// Una sola fila de comandas por hora de
// llegada: mesas, recoger y comer aquí.
// Se actualiza sola cada 10 s y suena cuando
// llega una comanda nueva.
//
// Solo la persona de cocina marca "Lista".
// Dueño y encargado solo la ven.
// ==========================================

type Props = { slug: string; lang: "es" | "en" };

const TEXT = {
  es: {
    loading: "Cargando comandas…",
    empty: "Sin comandas. Aquí aparecen los pedidos de mesas y apartados.",
    pending: (n: number) => `${n} por preparar`,
    ready: "Lista",
    markReady: "Lista ✓",
    cancelled: "CANCELADO",
    waiting: (m: number) => (m < 1 ? "recién llegó" : `espera ${m} min`),
    table: "Mesa",
    pickup: "Recoger",
    viewOnly: "Solo lectura: entra con la cuenta de Cocina para marcar Lista.",
    sound: "Activar sonido",
    soundOn: "Sonido activo",
    error: "No se pudo completar. Intenta otra vez.",
    updated: (time: string) => `Actualizado ${time}`,
  },
  en: {
    loading: "Loading tickets…",
    empty: "No tickets. Table and pickup orders show up here.",
    pending: (n: number) => `${n} to prepare`,
    ready: "Ready",
    markReady: "Ready ✓",
    cancelled: "CANCELLED",
    waiting: (m: number) => (m < 1 ? "just in" : `waiting ${m} min`),
    table: "Table",
    pickup: "Pickup",
    viewOnly: "View only: sign in with the Kitchen account to mark tickets Ready.",
    sound: "Turn on sound",
    soundOn: "Sound on",
    error: "Couldn't finish that. Try again.",
    updated: (time: string) => `Updated ${time}`,
  },
};

export default function KitchenBoard({ slug, lang }: Props) {
  const t = TEXT[lang];
  const endpoint = `/api/businesses/${encodeURIComponent(slug)}/kitchen?lang=${lang}`;

  const [data, setData] = useState<KitchenSnapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sound, setSound] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const seen = useRef<Set<string> | null>(null);

  const accept = useCallback((next: KitchenSnapshot) => {
    const pending = new Set(next.tickets.filter((k) => k.status === "pending").map((k) => k.key));
    const before = seen.current;
    seen.current = pending;
    if (before && [...pending].some((key) => !before.has(key))) beep(3);
    setData(next);
    setUpdatedAt(new Date());
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: "no-store", credentials: "same-origin" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? t.error);
      accept(result as KitchenSnapshot);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    }
  }, [endpoint, accept, t.error]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 10_000);
    // Los minutos de espera avanzan aunque no haya cambios.
    const clock = setInterval(() => setTick((n) => n + 1), 30_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      clearInterval(clock);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  async function markReady(ticket: KitchenTicket) {
    setBusy(ticket.key);
    setError("");
    const [kind, id] = [ticket.key.slice(0, 1), ticket.key.slice(2)];
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "t" ? { action: "ready", ticketId: id } : { action: "ready", reservationId: id },
        ),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? t.error);
      accept(result as KitchenSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return (
      <div className="mt-6">
        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : (
          <p className="text-sm text-gray-600">{t.loading}</p>
        )}
      </div>
    );
  }

  const pendingCount = data.tickets.filter((k) => k.status === "pending").length;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-black text-[#302018]">{t.pending(pendingCount)}</p>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="text-xs text-gray-500">
              {t.updated(updatedAt.toLocaleTimeString(lang === "es" ? "es-MX" : "en-US", { timeStyle: "short" }))}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              // El navegador solo deja sonar después de un toque.
              beep(1);
              setSound(true);
            }}
            className={`rounded-xl border px-3 py-2 text-xs font-bold ${
              sound ? "border-[#244D38] bg-[#EDF4E9] text-[#244D38]" : "border-[#eaded3] bg-white"
            }`}
          >
            🔔 {sound ? t.soundOn : t.sound}
          </button>
        </div>
      </div>

      {!data.canMark && (
        <p className="rounded-xl bg-[#fff7ef] p-3 text-sm text-[#4b3024]">{t.viewOnly}</p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      {data.tickets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#eaded3] bg-white p-8 text-center text-sm text-gray-600">
          {t.empty}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.tickets.map((ticket) => {
            const ready = ticket.status === "ready";
            const wait = minutesSince(ticket.since);
            const late = !ready && wait >= 15;
            return (
              <article
                key={ticket.key}
                className={`flex flex-col rounded-2xl border-2 bg-white p-4 ${
                  ready ? "border-[#cfe0c6] opacity-60" : late ? "border-red-600" : "border-[#a3341f]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      ticket.kind === "table" ? "bg-[#302018] text-white" : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {ticket.kind === "table" ? t.table : t.pickup}
                  </span>
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      ready ? "text-[#244D38]" : late ? "text-red-700" : "text-gray-600"
                    }`}
                  >
                    {ready ? `✓ ${t.ready}` : t.waiting(wait)}
                  </span>
                </div>
                <h3 className="mt-2 text-xl font-black leading-tight text-[#302018]">{ticket.label}</h3>
                <ul className="mt-3 flex-1 space-y-2">
                  {ticket.items.map((item, i) => (
                    <li key={i} className={item.cancelled ? "text-red-700" : "text-[#302018]"}>
                      <p className="text-base">
                        <span className={item.cancelled ? "line-through" : ""}>
                          <span className="font-black tabular-nums">{item.qty}×</span> {item.name}
                        </span>
                        {item.cancelled && (
                          <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-black">
                            {t.cancelled}
                          </span>
                        )}
                      </p>
                      {item.note && !item.cancelled && (
                        <p className="ml-6 text-sm font-semibold text-[#a3341f]">“{item.note}”</p>
                      )}
                    </li>
                  ))}
                </ul>
                {!ready && data.canMark && (
                  <button
                    type="button"
                    onClick={() => void markReady(ticket)}
                    disabled={busy !== null}
                    className="mt-4 w-full rounded-xl bg-[#244D38] px-4 py-4 text-base font-black text-white disabled:opacity-40"
                  >
                    {busy === ticket.key ? "…" : t.markReady}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function minutesSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}
