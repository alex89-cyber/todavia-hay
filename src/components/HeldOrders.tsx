"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "@/dictionaries";
import type { HeldOrder } from "@/lib/holds";
import { clock, fill, money } from "@/lib/format";
import { subscribePush } from "@/lib/client-push";

// "Tu apartado": the customer's orders with their pickup status. Polls so the
// card changes on its own when the stall asks to confirm or marks it ready.

const POLL_MS = 20_000;

export function HeldOrders({
  slug,
  lang,
  currency,
  timezone,
  vapidKey,
  initial,
  t,
}: {
  slug: string;
  lang: "es" | "en";
  currency: string;
  timezone: string;
  vapidKey: string | null;
  initial: HeldOrder[];
  t: Dictionary;
}) {
  const [holds, setHolds] = useState(initial);

  useEffect(() => {
    if (!initial.length) return;
    const tick = async () => {
      try {
        const res = await fetch(`/api/stalls/${slug}/holds?lang=${lang}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { holds: HeldOrder[] };
        setHolds(json.holds);
      } catch {}
    };
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [slug, lang, initial]);

  if (!holds.length) return null;
  return (
    <>
      {holds.map((h) => (
        <HoldCard
          key={h.id}
          hold={h}
          slug={slug}
          lang={lang}
          currency={currency}
          timezone={timezone}
          vapidKey={vapidKey}
          t={t}
          onChange={(patch) => setHolds((list) => list.map((x) => (x.id === h.id ? { ...x, ...patch } : x)))}
        />
      ))}
    </>
  );
}

function HoldCard({
  hold,
  slug,
  lang,
  currency,
  timezone,
  vapidKey,
  t,
  onChange,
}: {
  hold: HeldOrder;
  slug: string;
  lang: "es" | "en";
  currency: string;
  timezone: string;
  vapidKey: string | null;
  t: Dictionary;
  onChange: (patch: Partial<HeldOrder>) => void;
}) {
  const p = t.public;
  const at = (iso: string | null) => (iso ? clock(iso, timezone, lang) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notify, setNotify] = useState<"idle" | "on" | "denied" | "ios" | "error">("idle");

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/stalls/${slug}/holds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", id: hold.id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      onChange({ confirmed: true, stage: "scheduled" });
    } catch {
      setError(p.pickupConfirmError);
    } finally {
      setBusy(false);
    }
  }

  async function notifyMe() {
    if (!vapidKey) return;
    try {
      const sub = await subscribePush(vapidKey);
      if (typeof sub === "string") return setNotify(sub === "unsupported" ? "error" : sub);
      const res = await fetch(`/api/stalls/${slug}/holds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "push", id: hold.id, lang, subscription: sub }),
      });
      setNotify(res.ok ? "on" : "error");
    } catch {
      setNotify("error");
    }
  }

  const status =
    hold.stage === "ready"
      ? p.pickupReady
      : hold.stage === "to_prepare"
        ? hold.pickupMode === "asap"
          ? fill(p.pickupAsap, { time: at(hold.pickupAt) })
          : fill(p.pickupPreparing, { time: at(hold.pickupAt) })
        : hold.stage === "awaiting_confirmation"
          ? fill(p.pickupConfirmAsk, { time: at(hold.confirmBy) })
          : fill(p.pickupScheduled, { time: at(hold.pickupAt) });

  const ready = hold.stage === "ready";
  return (
    <div
      role="status"
      className={`space-y-3 rounded-3xl border p-6 shadow-sm sm:p-8 ${
        ready ? "border-brand bg-brand text-white" : "border-ok/20 bg-ok-soft text-ok"
      }`}
    >
      <p className="text-lg font-extrabold">
        {p.yourHold}
        {hold.orderNumber ? ` · ${fill(p.orderNumber, { n: hold.orderNumber })}` : ""}
      </p>

      <p className={`font-bold ${ready ? "text-2xl" : "text-base"}`}>{status}</p>

      {hold.stage === "scheduled" && hold.needsConfirmation && (
        <p className="text-sm">{hold.confirmed ? p.pickupConfirmed : p.pickupConfirmLater}</p>
      )}

      {hold.stage === "awaiting_confirmation" && (
        <button
          onClick={confirm}
          disabled={busy}
          className="w-full rounded-full bg-brand py-3 font-bold text-white active:scale-[0.98] disabled:opacity-60 sm:w-auto sm:px-8"
        >
          {p.pickupConfirmButton}
        </button>
      )}
      {error && <p className="text-sm font-semibold text-bad">{error}</p>}

      <p className="text-sm leading-relaxed">
        {hold.items} · {money(hold.totalCents, currency, lang)}
      </p>

      {hold.code && (
        <div className="flex items-center gap-4 pt-1">
          <span className="rounded-2xl bg-surface px-4 py-2 font-mono text-3xl font-black tracking-[0.3em] text-foreground">
            {hold.code}
          </span>
          <span className="text-sm font-semibold leading-snug">{p.pickupCodeHint}</span>
        </div>
      )}

      {!ready && vapidKey && (
        <div className="space-y-1">
          <button
            onClick={notifyMe}
            disabled={notify === "on"}
            className={`rounded-full px-4 py-2 text-sm font-semibold active:scale-95 ${
              notify === "on" ? "bg-surface text-ok" : "bg-brand text-white"
            }`}
          >
            {notify === "on" ? `✓ ${p.readyNotifyOn}` : `🔔 ${p.readyNotify}`}
          </button>
          {notify === "denied" && <p className="text-xs">{p.notifyDenied}</p>}
          {notify === "ios" && <p className="text-xs">{p.notifyIos}</p>}
          {notify === "error" && <p className="text-xs">{p.notifyError}</p>}
        </div>
      )}

      <p className={`text-xs ${ready ? "text-white/80" : ""}`}>{fill(p.pickupChargeNote, { time: at(hold.pickupBy) })}</p>
    </div>
  );
}
