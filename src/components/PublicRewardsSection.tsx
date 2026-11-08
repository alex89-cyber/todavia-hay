
"use client";

import {
  useEffect,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import {
  useRouter,
} from "next/navigation";

import RewardPinRedeemer from "./RewardPinRedeemer";

// ==========================================
// TODAVÍA HAY
// TARJETA PÚBLICA DE RECOMPENSAS
// ==========================================
//
// - Muestra sellos reales de Supabase
// - Actualiza datos automáticamente
// - Conserva el diseño original
// - Teléfono opcional
// - Compatible con cuentas futuras
// - Permite consultar una tarjeta
// - No suma sellos manualmente
//
// ==========================================

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

// ==========================================
// CONFIGURACIÓN
// ==========================================

const REFRESH_MS = 15_000;

// ==========================================
// VALIDAR COLOR
// ==========================================

function validColor(
  value: string,
): string {
  return /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : "#B4230B";
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function PublicRewardsSection({
  slug,
  lang,
  card,
}: Props) {
  const es = lang === "es";

  const router = useRouter();

  // ========================================
  // ESTADOS
  // ========================================

  const [
    config,
    setConfig,
  ] = useState<LoyaltyAppearance | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    checkingPhone,
    setCheckingPhone,
  ] = useState(false);

  const [
    phoneError,
    setPhoneError,
  ] = useState(false);

  // ========================================
  // CARGAR CONFIGURACIÓN DEL NEGOCIO
  // ========================================

  useEffect(() => {
    const controller =
      new AbortController();

    async function load() {
      try {
        const response = await fetch(
          `/api/stalls/${encodeURIComponent(
            slug,
          )}/loyalty/public`,
          {
            cache: "no-store",
            signal:
              controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            "loyalty_unavailable",
          );
        }

        const data =
          (await response.json()) as LoyaltyAppearance;

        if (
          !controller.signal.aborted
        ) {
          setConfig(data);
        }
      } catch (error) {
        if (
          !controller.signal.aborted
        ) {
          console.error(
            "No se pudo cargar la configuración:",
            error,
          );
        }
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [slug]);

  // ========================================
  // ACTUALIZAR SELLOS AUTOMÁTICAMENTE
  // ========================================

  // router.refresh() solicita otra vez
  // los datos del componente del servidor.
  //
  // No agrega sellos: únicamente vuelve
  // a consultar el saldo de Supabase.

  useEffect(() => {
    const refresh = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        router.refresh();
      }
    };

    const interval =
      window.setInterval(
        refresh,
        REFRESH_MS,
      );

    // Si el cliente regresa a esta pestaña,
    // consultar los datos nuevamente.
    const onFocus = () => {
      refresh();
    };

    const onVisibility = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        refresh();
      }
    };

    window.addEventListener(
      "focus",
      onFocus,
    );

    document.addEventListener(
      "visibilitychange",
      onVisibility,
    );

    return () => {
      window.clearInterval(
        interval,
      );

      window.removeEventListener(
        "focus",
        onFocus,
      );

      document.removeEventListener(
        "visibilitychange",
        onVisibility,
      );
    };
  }, [router]);

  // ========================================
  // CONSULTAR TARJETA POR TELÉFONO
  // ========================================

  // Compatibilidad con la ruta existente:
  //
  // POST /api/stalls/[slug]/card
  //
  // IMPORTANTE:
  // Esta ruta todavía necesita verificar
  // el teléfono antes de utilizarse en
  // producción para consultar o canjear
  // recompensas de clientes reales.

  async function lookUp(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (checkingPhone) {
      return;
    }

    const digits =
      phone.replace(/\D/g, "");

    // Validar longitud de número mexicano.
    const local =
      digits.length === 12 &&
      digits.startsWith("52")
        ? digits.slice(2)
        : digits;

    if (
      !/^\d{10}$/.test(local)
    ) {
      setPhoneError(true);
      return;
    }

    setCheckingPhone(true);
    setPhoneError(false);

    try {
      const response = await fetch(
        `/api/stalls/${encodeURIComponent(
          slug,
        )}/card`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials:
            "same-origin",

          body: JSON.stringify({
            phone: local,
          }),
        },
      );

      if (!response.ok) {
        setPhoneError(true);
        return;
      }

      // Se actualiza la cookie de la
      // tarjeta mediante el servidor.
      //
      // Recargamos para que page.tsx
      // lea la tarjeta correspondiente.
      window.location.reload();
    } catch (error) {
      console.error(
        "Error al consultar recompensas:",
        error,
      );

      setPhoneError(true);
    } finally {
      setCheckingPhone(false);
    }
  }

  // ========================================
  // RECOMPENSAS DESACTIVADAS
  // ========================================

  if (
    config?.enabled === false
  ) {
    return null;
  }

  // ========================================
  // CARGANDO CONFIGURACIÓN
  // ========================================

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

  // ========================================
  // CANTIDAD DE SELLOS
  // ========================================

  const total = Math.max(
    1,
    Math.min(
      100,
      config?.stampsPerReward ??
        card.perReward,
    ),
  );

  // Si no hay tarjeta identificada,
  // no debemos asumir que tiene cero.
  const hasCard =
    card.have !== null;

  const have = Math.max(
    0,
    card.have ?? 0,
  );

  const filled = Math.min(
    have,
    total,
  );

  const remaining = Math.max(
    0,
    total - filled,
  );

  const ready =
    hasCard &&
    have >= total;

  // ========================================
  // PERSONALIZACIÓN
  // ========================================

  const stampEmoji =
    config?.stampEmoji ||
    "⭐";

  const rewardEmoji =
    config?.rewardEmoji ||
    "🎁";

  const stampColor =
    validColor(
      config?.stampColor ||
        "#B4230B",
    );

  const rewardName =
    config?.rewardText?.trim() ||
    card.reward ||
    (
      es
        ? "Tu premio"
        : "Your reward"
    );

  const rewardConditions =
    config?.rewardConditions?.trim() ||
    "";

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <section className="min-w-0 space-y-4">

      {/* ====================================
          ENCABEZADO
      ==================================== */}

      <div>
        <p
          className="mb-1 text-xs font-bold uppercase tracking-[0.17em]"
          style={{
            color: stampColor,
          }}
        >
          {es
            ? "Gracias por tu preferencia"
            : "Thanks for choosing us"}
        </p>

        <h2 className="text-2xl font-black tracking-tight text-[#302018] sm:text-3xl">
          {es
            ? "Tus recompensas"
            : "Your rewards"}
        </h2>
      </div>

      {/* ====================================
          TARJETA PRINCIPAL
      ==================================== */}

      <div className="rounded-[26px] border border-[#eaded3] bg-white p-4 shadow-sm sm:p-6">

        {/* TITULO Y CONTADOR */}

        <div className="flex flex-wrap items-center justify-between gap-3">

          <div>
            <h3 className="text-lg font-black text-[#302018]">
              {es
                ? "Tarjeta de sellos"
                : "Stamp card"}
            </h3>

            <p className="mt-1 text-xs text-[#80695d]">

              {!hasCard
                ? es
                  ? "Asocia tu tarjeta para consultar tus sellos."
                  : "Connect your card to check your stamps."

                : ready
                  ? es
                    ? "¡Completaste tu tarjeta!"
                    : "Your card is complete!"

                  : es
                    ? `Te faltan ${remaining} ${
                        remaining === 1
                          ? "sello"
                          : "sellos"
                      } para tu premio.`
                    : `${remaining} stamps remaining.`
              }

            </p>
          </div>

          {/* CONTADOR */}

          <span className="rounded-full border border-[#eaded3] bg-[#fffaf4] px-4 py-2 text-sm font-bold tabular-nums text-[#302018]">

            {hasCard
              ? have
              : "—"}{" "}
            / {total}

          </span>
        </div>

        {/* ==================================
            SELLOS VISUALES
        ================================== */}

        <ol
          className="mt-5 flex flex-wrap gap-2"
          aria-label={
            es
              ? `${have} de ${total} sellos`
              : `${have} of ${total} stamps`
          }
        >

          {Array.from(
            {
              length: total,
            },
            (_, index) => {
              const completed =
                hasCard &&
                index < filled;

              const last =
                index === total - 1;

              return (
                <li
                  key={index}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-xl sm:h-14 sm:w-14"

                  style={
                    completed
                      ? {
                          backgroundColor:
                            stampColor,

                          borderColor:
                            stampColor,

                          color:
                            "#ffffff",
                        }
                      : {
                          borderColor:
                            "#eaded3",

                          borderStyle:
                            "dashed",

                          backgroundColor:
                            "#fffdfb",
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
            },
          )}

        </ol>

        {/* ==================================
            PREMIO Y CANJE
        ================================== */}

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
                  {es
                    ? "Tu premio"
                    : "Your reward"}
                </p>

                <h4 className="mt-1 break-words text-lg font-black text-[#302018]">
                  {rewardName}
                </h4>

              </div>
            </div>

            {/* CONDICIONES DEL PREMIO */}

            {rewardConditions && (
              <p className="mt-4 text-sm leading-6 text-[#80695d]">
                {rewardConditions}
              </p>
            )}

            {/* PREMIO COMPLETADO */}

            {ready && (
              <div className="mt-5 rounded-xl border border-[#cae6d3] bg-[#eef8f0] px-4 py-3">

                <p className="text-sm font-bold text-[#236a3c]">
                  <span aria-hidden="true">
                    ✓{" "}
                  </span>

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

          {/* ==================================
              PIN DE CANJE
          ================================== */}

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

        {/* ==================================
            CONSULTAR TARJETA
        ================================== */}

        {!hasCard && (
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

            <p className="text-xs leading-5 text-[#80695d]">
              {es
                ? "Si asociaste un número de teléfono a tus recompensas, puedes utilizarlo para consultar tu tarjeta."
                : "If you associated a phone number with your rewards, you can use it to find your card."}
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">

              <input
                id="public-rewards-phone"

                type="tel"

                inputMode="tel"

                autoComplete="tel"

                value={phone}

                onChange={(event) => {
                  setPhone(
                    event.target.value,
                  );

                  setPhoneError(false);
                }}

                placeholder={
                  es
                    ? "55 1234 5678"
                    : "Phone number"
                }

                className="min-w-0 flex-1 rounded-xl border border-[#eaded3] bg-white px-4 py-3 text-sm text-[#302018] outline-none focus:border-[#a63822]"
              />

              <button
                type="submit"

                disabled={
                  checkingPhone ||
                  phone.replace(
                    /\D/g,
                    "",
                  ).length < 10
                }

                className="rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-50"

                style={{
                  backgroundColor:
                    stampColor,
                }}
              >

                {checkingPhone
                  ? es
                    ? "Consultando..."
                    : "Checking..."
                  : es
                    ? "Consultar"
                    : "Check"}

              </button>

            </div>

            {phoneError && (
              <p
                role="alert"
                className="text-xs text-red-700"
              >
                {es
                  ? "No se pudo consultar la tarjeta. Verifica el número e inténtalo nuevamente."
                  : "Could not check the card. Verify the number and try again."}
              </p>
            )}

          </form>
        )}

      </div>
    </section>
  );
}
