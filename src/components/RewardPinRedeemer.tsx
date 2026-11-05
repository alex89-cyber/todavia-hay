
"use client";

import { useRef, useState } from "react";

type Props = {
  slug: string;
  lang: "es" | "en";
  rewardName?: string;
  rewardEmoji?: string;
  stampColor?: string;
};

type RedeemResponse = {
  ok?: boolean;
  error?: string;
  stampsRemaining?: number;
  reward?: string;
};

const translations = {
  es: {
    title: "Canjear con PIN",
    help: "Solicita el código al negocio cuando recibas tu premio.",
    pin: "PIN de seis dígitos",
    confirm: "Confirmar canje",
    processing: "Confirmando...",
    success: "¡Recompensa canjeada!",
    invalid_pin: "PIN incorrecto.",
    invalid_pin_format: "Introduce los seis dígitos.",
    pin_locked: "Demasiados intentos. Intenta más tarde.",
    pin_changed: "El PIN cambió. Solicita uno nuevo.",
    pin_not_ready: "El negocio todavía no tiene un PIN.",
    card_not_identified: "Primero identifica tu tarjeta.",
    not_enough_stamps: "No tienes suficientes sellos.",
    invalid_reward: "La recompensa no está configurada.",
    redeem_failed: "No se pudo realizar el canje.",
    unknown: "No se pudo realizar el canje.",
  },
  en: {
    title: "Redeem with PIN",
    help: "Ask the business for its code when receiving your reward.",
    pin: "Six-digit PIN",
    confirm: "Confirm redemption",
    processing: "Confirming...",
    success: "Reward redeemed!",
    invalid_pin: "Incorrect PIN.",
    invalid_pin_format: "Enter all six digits.",
    pin_locked: "Too many attempts. Try again later.",
    pin_changed: "The PIN changed. Request a new one.",
    pin_not_ready: "The business has no PIN yet.",
    card_not_identified: "Identify your stamp card first.",
    not_enough_stamps: "Not enough stamps.",
    invalid_reward: "The reward is not configured.",
    redeem_failed: "Could not redeem the reward.",
    unknown: "Could not redeem the reward.",
  },
} as const;

function validColor(value?: string) {
  return value && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : "#B4230B";
}

export default function RewardPinRedeemer({
  slug,
  lang,
  stampColor,
}: Props) {
  const t = translations[lang];
  const color = validColor(stampColor);

  const inputRef = useRef<HTMLInputElement>(null);

  const [pin, setPin] = useState("");
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const digits = pin.split("");

  function updatePin(value: string) {
    setPin(value.replace(/\D/g, "").slice(0, 6));
    setError("");
  }

  async function redeem() {
    if (busy || success || pin.length !== 6) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        `/api/stalls/${encodeURIComponent(slug)}/rewards/redeem`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pin }),
        },
      );

      const data = (await response
        .json()
        .catch(() => null)) as RedeemResponse | null;

      if (!response.ok || !data?.ok) {
        const code = data?.error as keyof typeof t;

        setError(t[code] || t.unknown);
        return;
      }

      setSuccess(true);
      setPin("");

      // Recargar el saldo de sellos actualizado.
      window.location.reload();
    } catch {
      setError(t.redeem_failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-col rounded-2xl border border-[#eaded3] bg-white p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{
            backgroundColor: "#fff2eb",
          }}
        >
          🔐
        </div>

        <div className="min-w-0">
          <h4 className="text-base font-black text-[#302018] sm:text-lg">
            {t.title}
          </h4>
          <p className="text-xs text-[#80695d]">
            {t.help}
          </p>
        </div>
      </div>

      {success ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-center text-sm font-bold text-green-700"
        >
          ✓ {t.success}
        </div>
      ) : (
        <>
          <div className="mt-5">
            <label
              htmlFor="reward-pin-input"
              className="mb-3 block text-center text-xs font-bold uppercase tracking-wider text-[#957564]"
            >
              {t.pin}
            </label>

            <div className="relative mx-auto max-w-[330px]">
              <input
                id="reward-pin-input"
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={pin}
                disabled={busy}
                onChange={(e) => updatePin(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                aria-invalid={Boolean(error)}
                aria-describedby="reward-pin-error"
                className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
              />

              <div
                aria-hidden="true"
                onClick={() => inputRef.current?.focus()}
                className="grid cursor-text grid-cols-6 gap-1.5 sm:gap-2"
              >
                {Array.from({ length: 6 }, (_, index) => {
                  const digit = digits[index] ?? "";
                  const active =
                    focused &&
                    index === pin.length &&
                    pin.length < 6;

                  return (
                    <div
                      key={index}
                      className="flex aspect-[0.85] min-w-0 items-center justify-center rounded-lg border-2 font-mono text-xl font-bold transition-all sm:rounded-xl sm:text-2xl"
                      style={{
                        borderColor:
                          digit || active
                            ? color
                            : "#eaded3",
                        backgroundColor: digit
                          ? "#fff7f2"
                          : "#fffdfb",
                        color: "#302018",
                      }}
                    >
                      {digit || (
                        <span className="text-[#d8c9bd]">
                          {active ? "|" : "•"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {error && (
            <p
              id="reward-pin-error"
              role="alert"
              className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700"
            >
              {error}
            </p>
          )}

          <div className="mt-auto pt-5">
            <button
              type="button"
              disabled={busy || pin.length !== 6}
              onClick={() => void redeem()}
              className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                backgroundColor: color,
              }}
            >
              {busy ? t.processing : t.confirm}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
