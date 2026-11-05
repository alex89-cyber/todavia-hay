
"use client";

import { useEffect, useState } from "react";

type Props = {
  slug: string;
  lang: string;
};

type PinResponse = {
  pin?: string;
  error?: string;
};

export default function OwnerRewardPinCard({
  slug,
  lang,
}: Props) {
  const es = lang !== "en";

  const url =
    `/api/stalls/${encodeURIComponent(slug)}/reward-pin`;

  const [pin, setPin] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  // CONSULTAR PIN EXISTENTE
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });

        const data = (await res
          .json()
          .catch(() => ({}))) as PinResponse;

        if (
          !res.ok ||
          !/^\d{6}$/.test(data.pin ?? "")
        ) {
          throw new Error(
            data.error || `HTTP ${res.status}`,
          );
        }

        if (!controller.signal.aborted) {
          setPin(data.pin!);
          setError("");
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(
            e instanceof Error
              ? e.message
              : "pin_unavailable",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [url]);

  // GENERAR NUEVO PIN
  async function regenerate() {
    if (!pin || regenerating) return;

    const confirmed = window.confirm(
      es
        ? "¿Generar un PIN nuevo? El anterior dejará de funcionar."
        : "Generate a new PIN? The previous PIN will stop working.",
    );

    if (!confirmed) return;

    setRegenerating(true);
    setError("");

    try {
      const res = await fetch(url, {
        method: "POST",
        cache: "no-store",
      });

      const data = (await res
        .json()
        .catch(() => ({}))) as PinResponse;

      if (
        !res.ok ||
        !/^\d{6}$/.test(data.pin ?? "")
      ) {
        throw new Error(
          data.error || `HTTP ${res.status}`,
        );
      }

      setPin(data.pin!);
      setVisible(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "pin_unavailable",
      );
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <section className="min-w-0 rounded-3xl border border-[#eaded3] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a63822]">
          {es
            ? "Seguridad de recompensas"
            : "Rewards security"}
        </p>

        <span className="rounded-full border border-[#eaded3] bg-[#fff8f2] px-3 py-1 text-xs font-semibold text-[#80695d]">
          {es ? "Solo negocio" : "Business only"}
        </span>
      </div>

      <h2 className="mt-3 text-2xl font-black leading-tight text-[#302018]">
        🔐{" "}
        {es
          ? "PIN de recompensas"
          : "Rewards PIN"}
      </h2>

      <p className="mt-2 text-sm leading-6 text-[#80695d]">
        {es
          ? "Pide al cliente que escriba este PIN al entregarle su premio."
          : "Ask the customer to enter this PIN when receiving the reward."}
      </p>

      {/* CÓDIGO */}
      <div className="mt-5 rounded-2xl border border-[#f0dfd2] bg-[#fff9f4] p-5 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-[#886a58]">
          {es ? "Código vigente" : "Current code"}
        </p>

        <p className="mt-4 font-mono text-3xl font-black tabular-nums tracking-[0.15em] text-[#302018] sm:text-4xl">
          {loading
            ? "······"
            : visible && pin
              ? pin
              : "••••••"}
        </p>

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={!pin || loading}
          className="mt-4 rounded-xl border border-[#d9b6a2] bg-white px-5 py-2 text-sm font-bold text-[#a63822] transition hover:bg-[#fff2ea] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {visible
            ? es
              ? "Ocultar PIN"
              : "Hide PIN"
            : es
              ? "Mostrar PIN"
              : "Show PIN"}
        </button>
      </div>

      <p className="mt-4 text-sm leading-6 text-[#80695d]">
        {es
          ? "El PIN se mantiene al abrir el panel y cambia tras cada canje exitoso."
          : "The PIN stays the same when reopening the panel and changes after a successful redemption."}
      </p>

      <button
        type="button"
        onClick={() => void regenerate()}
        disabled={!pin || regenerating}
        className="mt-4 w-full rounded-xl bg-[#a63822] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#8d2e1c] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {regenerating
          ? es
            ? "Regenerando..."
            : "Regenerating..."
          : es
            ? "Regenerar PIN"
            : "Regenerate PIN"}
      </button>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700"
        >
          {es
            ? "No se pudo cargar el PIN"
            : "Could not load the PIN"}
          : {error}

          <span className="mt-1 block text-xs">
            {es
              ? "Revisa la API /reward-pin, la tabla reward_pin_state y REWARD_PIN_SECRET."
              : "Check /reward-pin, reward_pin_state, and REWARD_PIN_SECRET."}
          </span>
        </p>
      )}
    </section>
  );
}
