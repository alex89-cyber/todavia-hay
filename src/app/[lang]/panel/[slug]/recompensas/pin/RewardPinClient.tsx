
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  lang: "es" | "en";
  slug: string;
};

type PinResponse = {
  pin?: string;
  error?: string;
};

export default function RewardPinClient({
  lang,
  slug,
}: Props) {
  const es = lang === "es";

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPin, setShowPin] = useState(false);

  const url = `/api/stalls/${encodeURIComponent(slug)}/reward-pin`;

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPin() {
      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });

        const data =
          (await response.json()) as PinResponse;

        if (!response.ok || !data.pin) {
          throw new Error(
            data.error || "pin_unavailable",
          );
        }

        if (!controller.signal.aborted) {
          setPin(data.pin);
          setError("");
        }
      } catch {
        if (!controller.signal.aborted) {
          setError(
            es
              ? "No se pudo cargar el PIN. Comprueba tu sesión."
              : "Could not load the PIN. Check your session.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchPin();

    return () => controller.abort();
  }, [url, es]);

  async function regenerate() {
    if (busy || loading) return;

    const confirmed = window.confirm(
      es
        ? "¿Quieres generar un PIN nuevo? El anterior dejará de funcionar."
        : "Generate a new PIN? The previous code will stop working.",
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch(url, {
        method: "POST",
        cache: "no-store",
      });

      const data =
        (await response.json()) as PinResponse;

      if (!response.ok || !data.pin) {
        throw new Error(
          data.error || "pin_unavailable",
        );
      }

      setPin(data.pin);
      setShowPin(true);
    } catch {
      setError(
        es
          ? "No se pudo regenerar el PIN. Intenta nuevamente."
          : "Could not regenerate the PIN. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fffaf4] px-4 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <Link
          href={`/${lang}/panel/${slug}`}
          className="text-sm font-bold text-[#a3341f] hover:underline"
        >
          ← {es ? "Volver al panel" : "Back to dashboard"}
        </Link>

        <section className="rounded-3xl border border-[#eaded3] bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <span className="text-4xl">🔐</span>

            <h1 className="mt-3 text-2xl font-black text-[#302018]">
              {es
                ? "PIN de recompensas"
                : "Rewards PIN"}
            </h1>

            <p className="mt-2 text-sm leading-6 text-[#80695d]">
              {es
                ? "Proporciona este PIN al cliente cuando le entregues su premio."
                : "Give this PIN to the customer when you hand over their reward."}
            </p>
          </div>

          <div className="rounded-2xl border border-[#eaded3] bg-[#fffaf4] px-4 py-8 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#80695d]">
              {es
                ? "Código vigente"
                : "Current code"}
            </p>

            <p className="font-mono text-4xl font-black tracking-widest text-[#302018] sm:text-5xl">
              {loading
                ? "······"
                : showPin
                  ? pin || "------"
                  : "••••••"}
            </p>

            <button
              type="button"
              disabled={loading || !pin}
              onClick={() =>
                setShowPin((current) => !current)
              }
              className="mt-5 rounded-xl border border-[#eaded3] bg-white px-5 py-2 text-sm font-bold text-[#a3341f] disabled:opacity-50"
            >
              {showPin
                ? es
                  ? "Ocultar PIN"
                  : "Hide PIN"
                : es
                  ? "Mostrar PIN"
                  : "Show PIN"}
            </button>
          </div>

          <p className="mt-5 text-center text-sm leading-6 text-[#60483d]">
            {es
              ? "El PIN permanece igual hasta un canje exitoso o hasta que lo regeneres manualmente."
              : "The PIN stays the same until a successful redemption or manual regeneration."}
          </p>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={busy || loading || !pin}
            onClick={() => void regenerate()}
            className="mt-6 w-full rounded-xl border border-[#a3341f] px-5 py-3 font-bold text-[#a3341f] disabled:opacity-50"
          >
            {busy
              ? es
                ? "Regenerando..."
                : "Regenerating..."
              : es
                ? "Regenerar PIN manualmente"
                : "Regenerate PIN manually"}
          </button>
        </section>
      </div>
    </main>
  );
}
