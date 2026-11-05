
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import {
  calculateLoyaltyPeriod,
} from "@/lib/loyalty-period";

import {
  DEFAULT_LOYALTY_CONFIG,
  validateLoyaltyConfig,
} from "@/lib/loyalty-config";

import type {
  LoyaltyConfigInput,
} from "@/lib/store/types";

// ==========================================
// TYPES
// ==========================================

type Language = "es" | "en";

type CustomConfig = LoyaltyConfigInput & {
  rewardText: string;
  rewardConditions: string;
  stampEmoji: string;
  rewardEmoji: string;
  stampColor: string;
};

type Props = {
  slug: string;
};

const DEFAULTS: CustomConfig = {
  ...DEFAULT_LOYALTY_CONFIG,
  rewardText: "",
  rewardConditions: "",
  stampEmoji: "⭐",
  rewardEmoji: "🎁",
  stampColor: "#B4230B",
};

const EMOJIS = [
  "⭐", "🌮", "☕", "🍔", "🍕",
  "❤️", "🔥", "🎁", "🏆", "🎉",
  "🥤", "🍰", "💎", "✅", "💚",
];

const cardClass =
  "rounded-2xl border border-[#E9DACC] bg-white p-5 shadow-sm";

const labelClass =
  "mb-2 block text-sm font-semibold text-[#38251D]";

const inputClass =
  "w-full rounded-xl border border-[#E7D7C9] bg-white px-4 py-3 text-sm text-[#38251D] outline-none focus:border-[#B4230B]";

// ==========================================
// TRANSLATIONS
// ==========================================

const translations = {
  es: {
    loading: "Cargando configuración de recompensas...",
    loadError: "No se pudo cargar la configuración.",
    saveError: "No se pudieron guardar las recompensas.",
    connectionError: "Error de conexión.",
    saved: "¡Programa de recompensas guardado correctamente!",

    enabledTitle: "Activar recompensas",
    enabledDescription:
      "Decide si los clientes pueden acumular nuevos sellos.",

    stampsTitle: "Cantidad de sellos",
    stampsQuestion:
      "¿Cuántos sellos necesita el cliente?",

    rewardTitle: "Premio para el cliente",
    rewardName: "Nombre del premio",
    rewardPlaceholder: "Ej. Una quesabirria gratis",
    rewardHelp:
      "Puedes escribir un producto, regalo, descuento o cualquier otro beneficio.",
    rewardConditions: "Condiciones del premio (opcional)",
    conditionsPlaceholder:
      "Ej. Válido para una porción individual.",

    periodTitle: "Vigencia de los sellos",
    periodQuestion:
      "¿Cuánto tiempo tiene el cliente para completar su tarjeta?",
    noExpiration: "Sin vencimiento",
    calendarWeek: "Por semana calendario",
    calendarMonth: "Por mes calendario",
    rollingDays: "Días desde el primer sello",
    daysNumber: "Número de días",
    expiryQuestion:
      "¿Qué sucede cuando vence el periodo?",
    resetStamps: "Reiniciar sellos incompletos",
    keepStamps: "Conservar sellos acumulados",
    periodHint:
      "La fecha límite se mostrará en la vista previa de abajo.",

    validityTitle: "Vigencia del premio",
    validityQuestion:
      "¿Cuánto tiempo tiene el cliente para canjearlo una vez ganado?",
    rewardNeverExpires: "El premio no vence",
    rewardLimited:
      "Vence después de ciertos días",
    rewardDays: "Días disponibles para canjear",

    appearanceTitle: "Personalización de la tarjeta",
    stampEmoji: "Emoji de los sellos",
    rewardEmoji: "Emoji del premio",
    otherEmoji: "O escribe otro emoji:",
    stampColor: "Color de los sellos",
    colorHelp:
      "Pulsa el selector para elegir cualquier color, no solo una paleta de opciones fijas.",
    colorHex: "Código hexadecimal del color",

    previewTitle: "Vista previa del cliente",
    example: "Ejemplo",
    programDisabled:
      "El programa está desactivado. Las recompensas existentes no se eliminan por apagarlo.",
    cardTitle: "Mi tarjeta de sellos",
    completed: "¡Completaste tu tarjeta!",
    remainingOne: "Te falta 1 sello para ganar.",
    remainingMany: (count: number) =>
      `Te faltan ${count} sellos para ganar.`,
    yourReward: "Tu premio",
    customReward: "Tu premio personalizado",
    stampDeadline: "Fecha límite de los sellos",
    resetNotice:
      "Los sellos incompletos se reinician al vencer.",
    redemptionTitle: "Canje del premio",
    redemptionNoExpiry:
      "Tu premio no tiene fecha de vencimiento.",
    redemptionDays: (days: number) =>
      `Tendrás ${days} días para canjearlo después de ganarlo.`,
    testStamps: "Probar cantidad de sellos",

    saveButton: "Guardar programa de recompensas",
    saving: "Guardando recompensas...",
    saveNote:
      "Los sellos históricos no se eliminan al modificar la configuración del programa.",

    rewardRequired: "Escribe el nombre del premio.",
    invalidColor: "El color debe tener formato #RRGGBB.",
    invalidStamps:
      "La cantidad de sellos debe estar entre 1 y 100.",
    invalidPeriodDays:
      "El periodo debe estar entre 1 y 365 días.",
    invalidRewardDays:
      "La vigencia del premio debe estar entre 1 y 365 días.",
    invalidEmoji: "Selecciona un emoji válido.",

    serverErrors: {
      loyalty_operation_failed:
        "No se pudo completar la operación en Supabase.",
      invalid_request: "Revisa los datos del formulario.",
      invalid_reward_text: "Revisa el nombre del premio.",
      invalid_stamp_color: "El color seleccionado no es válido.",
      invalid_stamps_per_reward:
        "La cantidad de sellos no es válida.",
      invalid_period: "El periodo seleccionado no es válido.",
      invalid_period_days: "El número de días no es válido.",
      invalid_expiry_action:
        "La opción de vencimiento no es válida.",
      invalid_reward_valid_days:
        "La vigencia del premio no es válida.",
      business_not_found: "No se encontró el negocio.",
      not_found: "No se encontró el negocio.",
      unauthorized: "No tienes autorización para guardar.",
      reward_text_required: "Escribe el nombre del premio.",
    },
  },

  en: {
    loading: "Loading rewards settings...",
    loadError: "Could not load rewards settings.",
    saveError: "Could not save rewards settings.",
    connectionError: "Connection error.",
    saved: "Rewards program saved successfully!",

    enabledTitle: "Enable rewards",
    enabledDescription:
      "Choose whether customers can earn new stamps.",

    stampsTitle: "Number of stamps",
    stampsQuestion:
      "How many stamps does a customer need?",

    rewardTitle: "Customer reward",
    rewardName: "Reward name",
    rewardPlaceholder: "E.g. One free quesabirria",
    rewardHelp:
      "Enter a product, gift, discount, or any other benefit.",
    rewardConditions: "Reward conditions (optional)",
    conditionsPlaceholder:
      "E.g. Valid for one individual serving.",

    periodTitle: "Stamp expiration",
    periodQuestion:
      "How long does a customer have to complete their card?",
    noExpiration: "No expiration",
    calendarWeek: "Calendar week",
    calendarMonth: "Calendar month",
    rollingDays: "Days after the first stamp",
    daysNumber: "Number of days",
    expiryQuestion:
      "What happens when the period expires?",
    resetStamps: "Reset incomplete stamps",
    keepStamps: "Keep accumulated stamps",
    periodHint:
      "The expiration date will appear in the preview below.",

    validityTitle: "Reward validity",
    validityQuestion:
      "How long does a customer have to redeem an earned reward?",
    rewardNeverExpires: "The reward never expires",
    rewardLimited: "Expires after a set number of days",
    rewardDays: "Days available to redeem",

    appearanceTitle: "Stamp card customization",
    stampEmoji: "Stamp emoji",
    rewardEmoji: "Reward emoji",
    otherEmoji: "Or enter another emoji:",
    stampColor: "Stamp color",
    colorHelp:
      "Click the color picker to choose any color, not just a limited palette.",
    colorHex: "Hex color code",

    previewTitle: "Customer preview",
    example: "Example",
    programDisabled:
      "The program is disabled. Existing rewards are not deleted when you turn it off.",
    cardTitle: "My stamp card",
    completed: "You've completed your card!",
    remainingOne: "You need 1 more stamp to earn a reward.",
    remainingMany: (count: number) =>
      `You need ${count} more stamps to earn a reward.`,
    yourReward: "Your reward",
    customReward: "Your custom reward",
    stampDeadline: "Stamp expiration date",
    resetNotice:
      "Incomplete stamps will reset when the period expires.",
    redemptionTitle: "Reward redemption",
    redemptionNoExpiry:
      "Your reward does not expire.",
    redemptionDays: (days: number) =>
      `You'll have ${days} days to redeem your reward after earning it.`,
    testStamps: "Test customer stamp count",

    saveButton: "Save rewards program",
    saving: "Saving rewards...",
    saveNote:
      "Existing customer stamps are not deleted when you update the program settings.",

    rewardRequired: "Enter a reward name.",
    invalidColor: "The color must use the #RRGGBB format.",
    invalidStamps:
      "The number of stamps must be between 1 and 100.",
    invalidPeriodDays:
      "The period must be between 1 and 365 days.",
    invalidRewardDays:
      "Reward validity must be between 1 and 365 days.",
    invalidEmoji: "Choose a valid emoji.",

    serverErrors: {
      loyalty_operation_failed:
        "Supabase could not complete the operation.",
      invalid_request: "Check the form information.",
      invalid_reward_text: "Check the reward name.",
      invalid_stamp_color: "The selected color is invalid.",
      invalid_stamps_per_reward:
        "The stamp requirement is invalid.",
      invalid_period: "The selected period is invalid.",
      invalid_period_days: "The number of days is invalid.",
      invalid_expiry_action:
        "The expiration option is invalid.",
      invalid_reward_valid_days:
        "Reward validity is invalid.",
      business_not_found: "Business not found.",
      not_found: "Business not found.",
      unauthorized: "You are not authorized to save.",
      reward_text_required: "Enter a reward name.",
    },
  },
} as const;

// ==========================================
// ERROR HANDLING
// ==========================================

function getApiError(
  data: unknown,
  lang: Language,
  fallback: string,
): string {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const result = data as {
    error?: string;
    details?: string;
    message?: string;
  };

  const messages =
    translations[lang].serverErrors;

  const code = result.error ?? "";

  const translated =
    Object.prototype.hasOwnProperty.call(
      messages,
      code,
    )
      ? messages[
          code as keyof typeof messages
        ]
      : null;

  const mainMessage =
    translated ||
    result.message ||
    fallback;

  // Keep technical diagnostics available in
  // the browser console without displaying
  // untranslated database errors to users.
  if (result.details) {
    console.error(
      "Rewards API diagnostic:",
      result.error,
      result.details,
    );
  }

  return mainMessage;
}

function validColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : "#B4230B";
}

function formatDate(
  date: Date,
  timezone: string,
  lang: Language,
): string {
  try {
    return new Intl.DateTimeFormat(
      lang === "es" ? "es-MX" : "en-US",
      {
        timeZone: timezone,
        day: "numeric",
        month: "long",
        year: "numeric",
      },
    ).format(date);
  } catch {
    return new Intl.DateTimeFormat(
      lang === "es" ? "es-MX" : "en-US",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      },
    ).format(date);
  }
}

// ==========================================
// EMOJI PICKER
// ==========================================

function EmojiPicker({
  label,
  otherLabel,
  value,
  onChange,
}: {
  label: string;
  otherLabel: string;
  value: string;
  onChange: (emoji: string) => void;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}
      </label>

      <div className="flex flex-wrap gap-2">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`${label}: ${emoji}`}
            aria-pressed={value === emoji}
            onClick={() => onChange(emoji)}
            className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl transition ${
              value === emoji
                ? "border-[#B4230B] bg-[#FFF3EC] ring-2 ring-[#B4230B]/20"
                : "border-[#E7D7C9] bg-white hover:bg-[#FFF8F3]"
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <label className="mt-3 block text-xs text-[#80695C]">
        {otherLabel}

        <input
          type="text"
          value={value}
          maxLength={20}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className={`${inputClass} mt-2 max-w-32`}
        />
      </label>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function LoyaltySettingsEditor({
  slug,
}: Props) {
  const params = useParams();

  const lang: Language =
    params?.lang === "en" ? "en" : "es";

  const t = translations[lang];

  const [config, setConfig] =
    useState<CustomConfig>({
      ...DEFAULTS,
    });

  const [timezone, setTimezone] =
    useState("America/Mexico_City");

  const [previewStamps, setPreviewStamps] =
    useState(2);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // ========================================
  // LOAD SETTINGS
  // ========================================

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          `/api/stalls/${encodeURIComponent(slug)}/loyalty`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const data: unknown =
          await response.json();

        if (!response.ok) {
          throw new Error(
            getApiError(
              data,
              lang,
              translations[lang].loadError,
            ),
          );
        }

        if (controller.signal.aborted) {
          return;
        }

        const result = data as {
          timezone?: string;
          config?: Partial<CustomConfig>;
        };

        setConfig({
          ...DEFAULTS,
          ...(result.config ?? {}),
        });

        setTimezone(
          result.timezone ||
            "America/Mexico_City",
        );

        setError("");
      } catch (cause) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          cause instanceof Error
            ? cause.message
            : translations[lang].loadError,
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    const timeout = setTimeout(() => {
      void load();
    }, 0);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [slug, lang]);

  // ========================================
  // UPDATE VALUES
  // ========================================

  function update<K extends keyof CustomConfig>(
    key: K,
    value: CustomConfig[K],
  ) {
    setConfig((current) => ({
      ...current,
      [key]: value,
    }));

    setError("");
    setSuccess("");
  }

  // ========================================
  // PREVIEW DATE
  // ========================================

  const period = useMemo(() => {
    try {
      return calculateLoyaltyPeriod(
        {
          periodKind: config.periodKind,
          periodDays: config.periodDays,
          expiryAction: config.expiryAction,
          timezone,
        },
        new Date(),
      );
    } catch {
      return null;
    }
  }, [
    config.periodKind,
    config.periodDays,
    config.expiryAction,
    timezone,
  ]);

  const expiresAt =
    period?.endsAt
      ? formatDate(
          new Date(
            new Date(period.endsAt).getTime() - 1,
          ),
          timezone,
          lang,
        )
      : null;

  const total = Math.max(
    1,
    Math.min(
      100,
      config.stampsPerReward || 1,
    ),
  );

  const filled = Math.max(
    0,
    Math.min(previewStamps, total),
  );

  const remaining = Math.max(
    0,
    total - filled,
  );

  const rewardName =
    config.rewardText.trim() ||
    t.customReward;

  // ========================================
  // SAVE SETTINGS
  // ========================================

  async function save() {
    if (saving || loading) {
      return;
    }

    setError("");
    setSuccess("");

    if (
      !Number.isInteger(config.stampsPerReward) ||
      config.stampsPerReward < 1 ||
      config.stampsPerReward > 100
    ) {
      setError(t.invalidStamps);
      return;
    }

    if (
      !Number.isInteger(config.periodDays) ||
      config.periodDays < 1 ||
      config.periodDays > 365
    ) {
      setError(t.invalidPeriodDays);
      return;
    }

    if (
      config.rewardValidDays !== null &&
      (
        !Number.isInteger(config.rewardValidDays) ||
        config.rewardValidDays < 1 ||
        config.rewardValidDays > 365
      )
    ) {
      setError(t.invalidRewardDays);
      return;
    }

    if (
      config.enabled &&
      config.rewardText.trim().length < 2
    ) {
      setError(t.rewardRequired);
      return;
    }

    if (
      !/^#[0-9a-fA-F]{6}$/.test(
        config.stampColor,
      )
    ) {
      setError(t.invalidColor);
      return;
    }

    if (
      !config.stampEmoji.trim() ||
      !config.rewardEmoji.trim()
    ) {
      setError(t.invalidEmoji);
      return;
    }

    const validation =
      validateLoyaltyConfig(config);

    if (!validation.ok) {
      // The validator currently contains
      // Spanish messages; use a localized
      // message instead.
      setError(
        lang === "es"
          ? validation.message
          : t.saveError,
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/stalls/${encodeURIComponent(slug)}/loyalty`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            action: "saveConfig",

            ...validation.config,

            rewardDishId: null,

            rewardText:
              config.rewardText.trim(),

            rewardConditions:
              config.rewardConditions.trim(),

            stampEmoji:
              config.stampEmoji,

            rewardEmoji:
              config.rewardEmoji,

            stampColor:
              config.stampColor,
          }),
        },
      );

      const data: unknown =
        await response.json();

      if (!response.ok) {
        throw new Error(
          getApiError(
            data,
            lang,
            t.saveError,
          ),
        );
      }

      const result = data as {
        config?: CustomConfig;
      };

      if (result.config) {
        setConfig({
          ...DEFAULTS,
          ...result.config,
        });
      }

      setSuccess(t.saved);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t.saveError,
      );
    } finally {
      setSaving(false);
    }
  }

  // ========================================
  // LOADING STATE
  // ========================================

  if (loading) {
    return (
      <div className={cardClass}>
        {t.loading}
      </div>
    );
  }

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="space-y-5">

      {/* ENABLE / DISABLE */}

      <section className={cardClass}>
        <label className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-[#38251D]">
              {t.enabledTitle}
            </h2>

            <p className="mt-1 text-sm text-[#80695C]">
              {t.enabledDescription}
            </p>
          </div>

          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(event) =>
              update(
                "enabled",
                event.target.checked,
              )
            }
            className="h-5 w-5 accent-[#B4230B]"
          />
        </label>
      </section>

      {/* STAMP REQUIREMENT */}

      <section className={cardClass}>
        <h2 className="mb-4 font-bold text-[#38251D]">
          {t.stampsTitle}
        </h2>

        <label
          htmlFor="stamps-count"
          className={labelClass}
        >
          {t.stampsQuestion}
        </label>

        <input
          id="stamps-count"
          type="number"
          min={1}
          max={100}
          value={config.stampsPerReward}
          onChange={(event) =>
            update(
              "stampsPerReward",
              Number(event.target.value),
            )
          }
          className={inputClass}
        />
      </section>

      {/* CUSTOM REWARD */}

      <section className={cardClass}>
        <h2 className="mb-4 font-bold text-[#38251D]">
          {t.rewardTitle}
        </h2>

        <label
          htmlFor="reward-text"
          className={labelClass}
        >
          {t.rewardName}
        </label>

        <input
          id="reward-text"
          type="text"
          maxLength={150}
          value={config.rewardText}
          onChange={(event) =>
            update(
              "rewardText",
              event.target.value,
            )
          }
          placeholder={t.rewardPlaceholder}
          className={inputClass}
        />

        <p className="mt-2 text-xs text-[#80695C]">
          {t.rewardHelp}
        </p>

        <label
          htmlFor="reward-conditions"
          className={`${labelClass} mt-5`}
        >
          {t.rewardConditions}
        </label>

        <textarea
          id="reward-conditions"
          rows={3}
          maxLength={500}
          value={config.rewardConditions}
          onChange={(event) =>
            update(
              "rewardConditions",
              event.target.value,
            )
          }
          placeholder={
            t.conditionsPlaceholder
          }
          className={inputClass}
        />
      </section>

      {/* STAMP EXPIRATION */}

      <section className={cardClass}>
        <h2 className="mb-4 font-bold text-[#38251D]">
          {t.periodTitle}
        </h2>

        <label
          htmlFor="loyalty-period"
          className={labelClass}
        >
          {t.periodQuestion}
        </label>

        <select
          id="loyalty-period"
          value={config.periodKind}
          onChange={(event) =>
            update(
              "periodKind",
              event.target.value as
                CustomConfig["periodKind"],
            )
          }
          className={inputClass}
        >
          <option value="none">
            {t.noExpiration}
          </option>

          <option value="calendar_week">
            {t.calendarWeek}
          </option>

          <option value="calendar_month">
            {t.calendarMonth}
          </option>

          <option value="rolling_days">
            {t.rollingDays}
          </option>
        </select>

        {config.periodKind ===
          "rolling_days" && (
          <div className="mt-4">
            <label
              htmlFor="period-days"
              className={labelClass}
            >
              {t.daysNumber}
            </label>

            <input
              id="period-days"
              type="number"
              min={1}
              max={365}
              value={config.periodDays}
              onChange={(event) =>
                update(
                  "periodDays",
                  Number(event.target.value),
                )
              }
              className={inputClass}
            />
          </div>
        )}

        {config.periodKind !== "none" && (
          <div className="mt-4">
            <label
              htmlFor="expiry-action"
              className={labelClass}
            >
              {t.expiryQuestion}
            </label>

            <select
              id="expiry-action"
              value={config.expiryAction}
              onChange={(event) =>
                update(
                  "expiryAction",
                  event.target.value as
                    CustomConfig["expiryAction"],
                )
              }
              className={inputClass}
            >
              <option value="reset">
                {t.resetStamps}
              </option>

              <option value="keep">
                {t.keepStamps}
              </option>
            </select>
          </div>
        )}

        <p className="mt-3 text-xs text-[#80695C]">
          {t.periodHint}
        </p>
      </section>

      {/* REWARD VALIDITY */}

      <section className={cardClass}>
        <h2 className="mb-4 font-bold text-[#38251D]">
          {t.validityTitle}
        </h2>

        <label
          htmlFor="reward-validity"
          className={labelClass}
        >
          {t.validityQuestion}
        </label>

        <select
          id="reward-validity"
          value={
            config.rewardValidDays === null
              ? "none"
              : "limited"
          }
          onChange={(event) =>
            update(
              "rewardValidDays",
              event.target.value === "none"
                ? null
                : 30,
            )
          }
          className={inputClass}
        >
          <option value="none">
            {t.rewardNeverExpires}
          </option>

          <option value="limited">
            {t.rewardLimited}
          </option>
        </select>

        {config.rewardValidDays !== null && (
          <div className="mt-4">
            <label
              htmlFor="reward-days"
              className={labelClass}
            >
              {t.rewardDays}
            </label>

            <input
              id="reward-days"
              type="number"
              min={1}
              max={365}
              value={
                config.rewardValidDays
              }
              onChange={(event) =>
                update(
                  "rewardValidDays",
                  Number(event.target.value),
                )
              }
              className={inputClass}
            />
          </div>
        )}
      </section>

      {/* APPEARANCE */}

      <section className={cardClass}>
        <h2 className="mb-4 font-bold text-[#38251D]">
          {t.appearanceTitle}
        </h2>

        <div className="space-y-6">
          <EmojiPicker
            label={t.stampEmoji}
            otherLabel={t.otherEmoji}
            value={config.stampEmoji}
            onChange={(emoji) =>
              update(
                "stampEmoji",
                emoji,
              )
            }
          />

          <EmojiPicker
            label={t.rewardEmoji}
            otherLabel={t.otherEmoji}
            value={config.rewardEmoji}
            onChange={(emoji) =>
              update(
                "rewardEmoji",
                emoji,
              )
            }
          />

          <div>
            <label
              htmlFor="stamp-color"
              className={labelClass}
            >
              {t.stampColor}
            </label>

            <div className="flex items-center gap-4">
              <input
                id="stamp-color"
                type="color"
                value={validColor(
                  config.stampColor,
                )}
                onChange={(event) =>
                  update(
                    "stampColor",
                    event.target.value,
                  )
                }
                className="h-14 w-20 cursor-pointer rounded-xl border border-[#E7D7C9] bg-white p-1"
              />

              <div className="min-w-0 flex-1">
                <input
                  aria-label={t.colorHex}
                  type="text"
                  value={config.stampColor}
                  maxLength={7}
                  onChange={(event) =>
                    update(
                      "stampColor",
                      event.target.value,
                    )
                  }
                  className={inputClass}
                />
              </div>

              <span
                className="h-12 w-12 shrink-0 rounded-full border border-[#E7D7C9]"
                style={{
                  backgroundColor:
                    validColor(
                      config.stampColor,
                    ),
                }}
              />
            </div>

            <p className="mt-2 text-xs text-[#80695C]">
              {t.colorHelp}
            </p>
          </div>
        </div>
      </section>

      {/* CUSTOMER PREVIEW */}

      <section className={cardClass}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-[#38251D]">
            {t.previewTitle}
          </h2>

          <span className="rounded-full bg-[#F8EEE6] px-3 py-1 text-xs font-semibold text-[#96523F]">
            {t.example}
          </span>
        </div>

        {!config.enabled ? (
          <p className="mt-4 text-sm text-[#80695C]">
            {t.programDisabled}
          </p>
        ) : (
          <>
            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="font-semibold text-[#38251D]">
                {t.cardTitle}
              </p>

              <span className="text-sm font-bold text-[#B4230B]">
                {filled} / {total}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from(
                { length: total },
                (_, index) => {
                  const completed =
                    index < filled;

                  return (
                    <div
                      key={index}
                      className="flex aspect-square items-center justify-center rounded-full border border-[#E9DACC] text-lg"
                      style={{
                        backgroundColor:
                          completed
                            ? validColor(
                                config.stampColor,
                              )
                            : "#FAF5F0",
                      }}
                    >
                      {completed
                        ? config.stampEmoji
                        : index === total - 1
                          ? config.rewardEmoji
                          : ""}
                    </div>
                  );
                },
              )}
            </div>

            <p className="mt-4 text-sm font-bold text-[#38251D]">
              {remaining === 0
                ? t.completed
                : remaining === 1
                  ? t.remainingOne
                  : t.remainingMany(remaining)}
            </p>

            <div className="mt-5 space-y-4 border-t border-[#E9DACC] pt-5">

              {/* REWARD */}

              <div className="flex items-start gap-3">
                <span className="text-xl">
                  {config.rewardEmoji}
                </span>

                <div>
                  <p className="text-sm font-bold text-[#38251D]">
                    {t.yourReward}
                  </p>

                  <p className="text-sm text-[#60483d]">
                    {rewardName}
                  </p>

                  {config.rewardConditions && (
                    <p className="mt-1 text-xs text-[#80695C]">
                      {config.rewardConditions}
                    </p>
                  )}
                </div>
              </div>

              {/* EXPIRATION DATE */}

              {expiresAt && (
                <div className="flex items-start gap-3">
                  <span className="text-xl">
                    📅
                  </span>

                  <div>
                    <p className="text-sm font-bold text-[#38251D]">
                      {t.stampDeadline}
                    </p>

                    <p className="text-sm text-[#60483d]">
                      {expiresAt}
                    </p>

                    {config.expiryAction ===
                      "reset" && (
                      <p className="mt-1 text-xs text-[#80695C]">
                        {t.resetNotice}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* REDEMPTION */}

              <div className="flex items-start gap-3">
                <span className="text-xl">
                  ✅
                </span>

                <div>
                  <p className="text-sm font-bold text-[#38251D]">
                    {t.redemptionTitle}
                  </p>

                  <p className="text-sm text-[#60483d]">
                    {config.rewardValidDays === null
                      ? t.redemptionNoExpiry
                      : t.redemptionDays(
                          config.rewardValidDays,
                        )}
                  </p>
                </div>
              </div>
            </div>

            {/* PREVIEW SLIDER */}

            <div className="mt-5 border-t border-[#E9DACC] pt-4">
              <label
                htmlFor="preview-stamps"
                className={labelClass}
              >
                {t.testStamps}
              </label>

              <input
                id="preview-stamps"
                type="range"
                min={0}
                max={total}
                value={filled}
                onChange={(event) =>
                  setPreviewStamps(
                    Number(event.target.value),
                  )
                }
                className="w-full accent-[#B4230B]"
              />
            </div>
          </>
        )}
      </section>

      {/* ERROR AND SUCCESS MESSAGES */}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          {success}
        </div>
      )}

      {/* SAVE BUTTON */}

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="w-full rounded-xl bg-[#B4230B] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#931E0A] disabled:opacity-50"
      >
        {saving
          ? t.saving
          : t.saveButton}
      </button>

      <p className="text-center text-xs leading-5 text-[#927C6E]">
        {t.saveNote}
      </p>
    </div>
  );
}
