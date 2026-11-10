
"use client";

import {
  useEffect,
  useState,
} from "react";

import type { Dictionary } from "@/dictionaries";
import type { HeldOrder } from "@/lib/holds";

import {
  clock,
  fill,
  money,
} from "@/lib/format";

import { subscribePush } from "@/lib/client-push";

// ==========================================
// TODAVÍA HAY
// MIS PEDIDOS Y APARTADOS
// ==========================================

const POLL_MS = 15_000;

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
  const [holds, setHolds] =
    useState<HeldOrder[]>(initial);

  // ========================================
  // CONSULTAR ESTADOS ACTUALIZADOS
  // ========================================

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await fetch(
          `/api/stalls/${encodeURIComponent(
            slug,
          )}/holds?lang=${lang}`,
          {
            cache: "no-store",
            credentials: "same-origin",
          },
        );

        if (!response.ok) return;

        const data =
          (await response.json()) as {
            holds: HeldOrder[];
          };

        if (
          active &&
          Array.isArray(data.holds)
        ) {
          setHolds(data.holds);
        }
      } catch (error) {
        console.error(
          "Error al actualizar pedidos:",
          error,
        );
      }
    }

    void refresh();

    const timer = window.setInterval(
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void refresh();
        }
      },
      POLL_MS,
    );

    const onFocus = () => {
      void refresh();
    };

    window.addEventListener(
      "focus",
      onFocus,
    );

    return () => {
      active = false;
      window.clearInterval(timer);

      window.removeEventListener(
        "focus",
        onFocus,
      );
    };
  }, [slug, lang]);

  if (!holds.length) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-black">
        {lang === "es"
          ? "Mis pedidos"
          : "My orders"}
      </h2>

      {holds.map((hold) => (
        <HoldCard
          key={hold.id}
          hold={hold}
          slug={slug}
          lang={lang}
          currency={currency}
          timezone={timezone}
          vapidKey={vapidKey}
          t={t}
          onChange={(patch) => {
            setHolds((current) =>
              current.map((item) =>
                item.id === hold.id
                  ? {
                      ...item,
                      ...patch,
                    }
                  : item,
              ),
            );
          }}
        />
      ))}
    </section>
  );
}

// ==========================================
// TARJETA INDIVIDUAL
// ==========================================

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
  onChange: (
    patch: Partial<HeldOrder>,
  ) => void;
}) {
  const p = t.public;
  const es = lang === "es";

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [notify, setNotify] =
    useState<
      | "idle"
      | "on"
      | "denied"
      | "ios"
      | "error"
    >("idle");

  const at = (
    iso: string | null,
  ) =>
    iso
      ? clock(
          iso,
          timezone,
          lang,
        )
      : "";

  const delivered =
    hold.status === "captured";

  const expired =
    hold.status === "expired";

  const cancelled =
    hold.status === "voided";

  const active =
    hold.status === "authorized";

  const ready =
    active &&
    hold.stage === "ready";

  // ========================================
  // TEXTO DEL ESTADO
  // ========================================

  const status = delivered
    ? es
      ? "Entregado y pagado"
      : "Delivered and paid"
    : expired
      ? es
        ? "Pedido vencido"
        : "Expired order"
      : cancelled
        ? es
          ? "Pedido cancelado"
          : "Cancelled order"
        : hold.stage === "ready"
          ? p.pickupReady
          : hold.stage === "to_prepare"
            ? hold.pickupMode === "asap"
              ? fill(
                  p.pickupAsap,
                  {
                    time: at(
                      hold.pickupAt,
                    ),
                  },
                )
              : fill(
                  p.pickupPreparing,
                  {
                    time: at(
                      hold.pickupAt,
                    ),
                  },
                )
            : hold.stage ===
                "awaiting_confirmation"
              ? fill(
                  p.pickupConfirmAsk,
                  {
                    time: at(
                      hold.confirmBy,
                    ),
                  },
                )
              : fill(
                  p.pickupScheduled,
                  {
                    time: at(
                      hold.pickupAt,
                    ),
                  },
                );

  // ========================================
  // CONFIRMAR RECOGIDA
  // ========================================

  async function confirm() {
    if (!active || busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/stalls/${encodeURIComponent(
          slug,
        )}/holds`,
        {
          method: "POST",

          credentials: "same-origin",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            action: "confirm",
            id: hold.id,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          String(response.status),
        );
      }

      onChange({
        confirmed: true,
        stage: "scheduled",
      });
    } catch {
      setError(
        p.pickupConfirmError,
      );
    } finally {
      setBusy(false);
    }
  }

  // ========================================
  // NOTIFICACIONES
  // ========================================

  async function notifyMe() {
    if (
      !vapidKey ||
      !active
    ) {
      return;
    }

    try {
      const subscription =
        await subscribePush(vapidKey);

      if (
        typeof subscription ===
        "string"
      ) {
        setNotify(
          subscription === "unsupported"
            ? "error"
            : subscription,
        );
        return;
      }

      const response = await fetch(
        `/api/stalls/${encodeURIComponent(
          slug,
        )}/holds`,
        {
          method: "POST",

          credentials: "same-origin",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            action: "push",
            id: hold.id,
            lang,
            subscription,
          }),
        },
      );

      setNotify(
        response.ok
          ? "on"
          : "error",
      );
    } catch {
      setNotify("error");
    }
  }

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <div
      role="status"
      className={`space-y-3 rounded-3xl border p-5 shadow-sm sm:p-8 ${
        ready
          ? "border-brand bg-brand text-white"
          : delivered
            ? "border-green-200 bg-green-50 text-green-900"
            : "border-line bg-surface text-foreground"
      }`}
    >
      {/* NÚMERO DE PEDIDO */}

      <p className="text-lg font-extrabold">
        {es
          ? "Tu pedido"
          : "Your order"}

        {hold.orderNumber
          ? ` #${hold.orderNumber}`
          : ""}
      </p>

      {/* ESTADO */}

      <p className="text-base font-bold sm:text-xl">
        {delivered ? "✓ " : ""}
        {status}
      </p>

      {/* PRODUCTOS */}

      <p className="text-sm leading-relaxed">
        {hold.items}
        {" · "}
        {money(
          hold.totalCents,
          currency,
          lang,
        )}
      </p>

      {/* HORARIO */}

      {hold.pickupAt && (
        <p className="text-sm">
          {es
            ? "Hora de recogida:"
            : "Pickup time:"}
          {" "}
          {at(hold.pickupAt)}
        </p>
      )}

      {/* RECORDATORIO DE CONFIRMACIÓN */}

      {active &&
        hold.stage === "scheduled" &&
        hold.needsConfirmation && (
          <p className="text-sm">
            {hold.confirmed
              ? p.pickupConfirmed
              : p.pickupConfirmLater}
          </p>
        )}

      {/* BOTÓN PARA CONFIRMAR */}

      {active &&
        hold.stage ===
          "awaiting_confirmation" && (
          <button
            onClick={confirm}
            disabled={busy}
            className="rounded-full bg-brand px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            {p.pickupConfirmButton}
          </button>
        )}

      {error && (
        <p className="text-sm text-red-700">
          {error}
        </p>
      )}

      {/* NIP SOLO PARA PEDIDOS ACTIVOS */}

      {active && hold.code && (
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <span className="rounded-2xl border border-line bg-white px-4 py-2 font-mono text-3xl font-black tracking-[0.25em] text-black">
            {hold.code}
          </span>

          <span className="text-sm">
            {p.pickupCodeHint}
          </span>
        </div>
      )}

      {/* AVISO DE PAGO */}

      {delivered && (
        <p className="text-sm font-semibold">
          {es
            ? "El negocio registró la entrega y el pago."
            : "The business recorded delivery and payment."}
        </p>
      )}

      {active && (
        <p className="text-sm">
          {es
            ? "Pagarás al recoger tu pedido."
            : "Payment is collected at pickup."}
        </p>
      )}

      {/* NOTIFICACIONES */}

      {active &&
        !ready &&
        vapidKey && (
          <div className="space-y-1">
            <button
              onClick={notifyMe}
              disabled={notify === "on"}
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {notify === "on"
                ? `✓ ${p.readyNotifyOn}`
                : `🔔 ${p.readyNotify}`}
            </button>

            {notify === "denied" && (
              <p className="text-xs">
                {p.notifyDenied}
              </p>
            )}

            {notify === "ios" && (
              <p className="text-xs">
                {p.notifyIos}
              </p>
            )}

            {notify === "error" && (
              <p className="text-xs">
                {p.notifyError}
              </p>
            )}
          </div>
        )}

    </div>
  );
}
