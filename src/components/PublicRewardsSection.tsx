
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import RewardPinRedeemer from "./RewardPinRedeemer";

type Language = "es" | "en";

type StampCardInfo = {
  have: number | null;
  perReward: number;
  reward: string;
};

type LoyaltyAppearance = {
  enabled: boolean;
  stampsPerReward: number;
  rewardText: string;
  rewardConditions: string;
  stampEmoji: string;
  rewardEmoji: string;
  stampColor: string;
};

type Props = {
  slug: string;
  lang: Language;
  card: StampCardInfo;
};

function validColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : "#B4230B";
}

export default function PublicRewardsSection({
  slug,
  lang,
  card,
}: Props) {
  const es = lang === "es";

  const [config, setConfig] =
    useState<LoyaltyAppearance | null>(null);

  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          `/api/stalls/${encodeURIComponent(slug)}/loyalty/public`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("loyalty_unavailable");
        }

        const data =
          (await response.json()) as LoyaltyAppearance;

        if (!controller.signal.aborted) {
          setConfig(data);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(
            "No se pudo cargar la configuración:",
            error,
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
  }, [slug]);

  async function lookUp(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (checkingPhone) return;

    setCheckingPhone(true);
    setPhoneError(false);

    try {
      const response = await fetch(
        `/api/stalls/${encodeURIComponent(slug)}/card`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            phone: phone.trim(),
          }),
        },
      );

      if (!response.ok) {
        setPhoneError(true);
        return;
      }

      window.location.reload();
    } catch {
      setPhoneError(true);
    } finally {
      setCheckingPhone(false);
    }
  }

  if (config?.enabled === false) {
    return null;
  }

  if (loading) {
    return (
      <section
        aria-busy="true"
        className="rounded-2xl border border-[#eaded3] bg-white p-5 text-sm text-[#80695d]"
      >
        {es
          ? "Cargando recompensas..."
          : "Loading rewards..."}
      </section>
    );
  }

  const total = Math.max(
    1,
    Math.min(
      100,
      config?.stampsPerReward ?? card.perReward,
    ),
  );

  const have = Math.max(0, card.have ?? 0);
  const filled = Math.min(have, total);
  const remaining = Math.max(0, total - filled);

  const ready =
    card.have !== null &&
    have >= total;

  const stampEmoji = config?.stampEmoji || "⭐";
  const rewardEmoji = config?.rewardEmoji || "🎁";

  const stampColor = validColor(
    config?.stampColor || "#B4230B",
  );

  const rewardName =
    config?.rewardText?.trim() ||
    card.reward ||
    (es ? "Tu premio" : "Your reward");

  const rewardConditions =
    config?.rewardConditions?.trim() || "";

  return (
    <section className="min-w-0 space-y-4">
      {/* ENCABEZADO */}

      <div>
        <p
          className="mb-1 text-xs font-bold uppercase tracking-[0.17em]"
          style={{ color: stampColor }}
        >
          {es
            ? "Gracias por tu preferencia"
            : "Thanks for choosing us"}
        </p>

        <h2 className="text-2xl font-black tracking-tight text-[#302018] sm:text-3xl">
          {es ? "Tus recompensas" : "Your rewards"}
        </h2>
      </div>

      {/* CONTENEDOR PRINCIPAL */}

      <div className="rounded-[26px] border border-[#eaded3] bg-white p-4 shadow-sm sm:p-6">
        {/* TARJETA DE SELLOS */}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-[#302018]">
              {es ? "Tarjeta de sellos" : "Stamp card"}
            </h3>

            <p className="mt-1 text-xs text-[#80695d]">
              {ready
                ? es
                  ? "¡Completaste tu tarjeta!"
                  : "Your card is complete!"
                : es
                  ? `Te faltan ${remaining} ${
                      remaining === 1 ? "sello" : "sellos"
                    } para tu premio.`
                  : `${remaining} stamps remaining.`}
            </p>
          </div>

          <span className="rounded-full border border-[#eaded3] bg-[#fffaf4] px-4 py-2 text-sm font-bold tabular-nums text-[#302018]">
            {have} / {total}
          </span>
        </div>

        {/* SELLOS */}

        <ol
          className="mt-5 flex flex-wrap gap-2"
          aria-label={
            es
              ? `${have} de ${total} sellos`
              : `${have} of ${total} stamps`
          }
        >
          {Array.from({ length: total }, (_, index) => {
            const completed = index < filled;
            const last = index === total - 1;

            return (
              <li
                key={index}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-xl sm:h-14 sm:w-14"
                style={
                  completed
                    ? {
                        backgroundColor: stampColor,
                        borderColor: stampColor,
                        color: "#ffffff",
                      }
                    : {
                        borderColor: "#eaded3",
                        borderStyle: "dashed",
                        backgroundColor: "#fffdfb",
                      }
                }
              >
                <span aria-hidden="true">
                  {completed
                    ? stampEmoji
                    : last
                      ? rewardEmoji
                      : ""}
                </span>
              </li>
            );
          })}
        </ol>

        {/* RECOMPENSA + CANJE */}

        <div
          className={`mt-5 grid min-w-0 gap-4 ${
            ready
              ? "grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
              : "grid-cols-1"
          }`}
        >
          {/* PREMIO */}

          <div className="flex min-w-0 flex-col rounded-2xl border border-[#eaded3] bg-[#fffaf6] p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
                {rewardEmoji}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-[#a28575]">
                  {es ? "Tu premio" : "Your reward"}
                </p>

                <h4 className="mt-1 break-words text-lg font-black text-[#302018]">
                  {rewardName}
                </h4>
              </div>
            </div>

            {rewardConditions && (
              <p className="mt-4 text-sm leading-6 text-[#80695d]">
                {rewardConditions}
              </p>
            )}

            {ready && (
              <div className="mt-5 rounded-xl border border-[#cae6d3] bg-[#eef8f0] px-4 py-3">
                <p className="text-sm font-bold text-[#236a3c]">
                  <span aria-hidden="true">✓ </span>
                  {es
                    ? "Premio disponible"
                    : "Reward available"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#49775a]">
                  {es
                    ? "Solicita tu premio y confirma el canje con el PIN del negocio."
                    : "Request your reward and confirm redemption with the business PIN."}
                </p>
              </div>
            )}
          </div>

          {/* PIN */}

          {ready && (
            <RewardPinRedeemer
              slug={slug}
              lang={lang}
              rewardName={rewardName}
              rewardEmoji={rewardEmoji}
              stampColor={stampColor}
            />
          )}
        </div>

        {/* CONSULTAR SELLOS POR TELÉFONO */}

        {card.have === null && (
          <form
            onSubmit={lookUp}
            className="mt-5 space-y-3 rounded-2xl border border-[#eaded3] p-4"
          >
            <label
              htmlFor="public-rewards-phone"
              className="block text-sm font-bold text-[#302018]"
            >
              {es
                ? "Consulta tus sellos con tu teléfono"
                : "Check your stamps using your phone"}
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="public-rewards-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setPhoneError(false);
                }}
                placeholder={
                  es ? "55 1234 5678" : "Phone number"
                }
                className="min-w-0 flex-1 rounded-xl border border-[#eaded3] bg-white px-4 py-3 text-sm text-[#302018] outline-none focus:border-[#a63822]"
              />

              <button
                type="submit"
                disabled={
                  checkingPhone ||
                  phone.replace(/\D/g, "").length < 10
                }
                className="rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                style={{
                  backgroundColor: stampColor,
                }}
              >
                {checkingPhone
                  ? es ? "Consultando..." : "Checking..."
                  : es ? "Consultar" : "Check"}
              </button>
            </div>

            {phoneError && (
              <p role="alert" className="text-xs text-red-700">
                {es
                  ? "No se pudo consultar la tarjeta."
                  : "Could not check the card."}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
