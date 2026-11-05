
import type {
  LoyaltyConfigInput,
} from "./store/types";

import type {
  LoyaltyPeriodConfig,
} from "./loyalty-period";

/**
 * ¿Todavía hay?
 *
 * Reglas configurables del programa de recompensas.
 *
 * Este módulo:
 * - Valida la configuración del negocio.
 * - Proporciona valores predeterminados.
 * - Prepara los datos para calcular vencimientos.
 * - Evita modificar accidentalmente objetos existentes.
 *
 * No modifica la base de datos.
 */

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfigInput = {
  enabled: true,
  stampsPerReward: 10,
  rewardDishId: null,
  periodKind: "none",
  periodDays: 30,
  expiryAction: "reset",
  rewardValidDays: null,
};

export type LoyaltyValidationResult =
  | {
      ok: true;
      config: LoyaltyConfigInput;
    }
  | {
      ok: false;
      reason: "invalid_config";
      message: string;
    };

const PERIOD_KINDS = [
  "none",
  "calendar_week",
  "calendar_month",
  "rolling_days",
] as const;

const EXPIRY_ACTIONS = [
  "reset",
  "keep",
] as const;

function isIntegerBetween(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

export function validateLoyaltyConfig(
  input: LoyaltyConfigInput,
): LoyaltyValidationResult {
  if (typeof input.enabled !== "boolean") {
    return {
      ok: false,
      reason: "invalid_config",
      message:
        "Debes indicar si el programa está activado.",
    };
  }

  if (
    !isIntegerBetween(
      input.stampsPerReward,
      1,
      100,
    )
  ) {
    return {
      ok: false,
      reason: "invalid_config",
      message:
        "La cantidad de sellos debe estar entre 1 y 100.",
    };
  }

  if (
    input.rewardDishId !== null &&
    (
      typeof input.rewardDishId !== "string" ||
      input.rewardDishId.trim().length === 0
    )
  ) {
    return {
      ok: false,
      reason: "invalid_config",
      message:
        "El identificador del premio no es válido.",
    };
  }

  if (
    !PERIOD_KINDS.includes(
      input.periodKind,
    )
  ) {
    return {
      ok: false,
      reason: "invalid_config",
      message:
        "El periodo seleccionado no es válido.",
    };
  }

  if (
    !isIntegerBetween(
      input.periodDays,
      1,
      365,
    )
  ) {
    return {
      ok: false,
      reason: "invalid_config",
      message:
        "La duración debe estar entre 1 y 365 días.",
    };
  }

  if (
    !EXPIRY_ACTIONS.includes(
      input.expiryAction,
    )
  ) {
    return {
      ok: false,
      reason: "invalid_config",
      message:
        "La regla de vencimiento no es válida.",
    };
  }

  if (
    input.rewardValidDays !== null &&
    !isIntegerBetween(
      input.rewardValidDays,
      1,
      365,
    )
  ) {
    return {
      ok: false,
      reason: "invalid_config",
      message:
        "La vigencia del premio debe estar entre 1 y 365 días.",
    };
  }

  return {
    ok: true,
    config: {
      enabled: input.enabled,
      stampsPerReward: input.stampsPerReward,
      rewardDishId:
        input.rewardDishId?.trim() || null,
      periodKind: input.periodKind,
      periodDays: input.periodDays,
      expiryAction: input.expiryAction,
      rewardValidDays: input.rewardValidDays,
    },
  };
}

/**
 * Recupera una configuración completa.
 *
 * Resulta útil para negocios anteriores que
 * todavía no tienen todas las nuevas opciones.
 */
export function normalizeLoyaltyConfig(
  input?: Partial<LoyaltyConfigInput> | null,
): LoyaltyConfigInput {
  const candidate: LoyaltyConfigInput = {
    ...DEFAULT_LOYALTY_CONFIG,
    ...input,
  };

  const result = validateLoyaltyConfig(candidate);

  if (result.ok) {
    return result.config;
  }

  return {
    ...DEFAULT_LOYALTY_CONFIG,
  };
}

/**
 * Prepara las reglas que utiliza el calculador
 * de periodos.
 */
export function toLoyaltyPeriodConfig(
  config: LoyaltyConfigInput,
  timezone: string,
): LoyaltyPeriodConfig {
  return {
    periodKind: config.periodKind,
    periodDays: config.periodDays,
    expiryAction: config.expiryAction,
    timezone,
  };
}

/**
 * Determina si el negocio permite ganar
 * nuevos sellos.
 */
export function canEarnLoyaltyStamps(
  config: LoyaltyConfigInput,
): boolean {
  return config.enabled;
}

/**
 * Describe la vigencia de los sellos.
 */
export function describeLoyaltyPeriod(
  config: LoyaltyConfigInput,
  lang: "es" | "en" = "es",
): string {
  if (config.periodKind === "none") {
    return lang === "es"
      ? "Tus sellos no tienen fecha de vencimiento."
      : "Your stamps do not expire.";
  }

  if (config.periodKind === "calendar_week") {
    return lang === "es"
      ? "El periodo de sellos va de lunes a domingo."
      : "The stamp period runs from Monday to Sunday.";
  }

  if (config.periodKind === "calendar_month") {
    return lang === "es"
      ? "El periodo de sellos termina el último día de cada mes."
      : "The stamp period ends on the last day of each month.";
  }

  return lang === "es"
    ? `Tienes ${config.periodDays} días desde tu primer sello para completar la tarjeta.`
    : `You have ${config.periodDays} days from your first stamp to complete the card.`;
}

/**
 * Explica qué sucede con los sellos
 * incompletos cuando termina el periodo.
 */
export function describeLoyaltyExpiration(
  config: LoyaltyConfigInput,
  lang: "es" | "en" = "es",
): string {
  if (config.periodKind === "none") {
    return lang === "es"
      ? "Los sellos acumulados se conservan."
      : "Accumulated stamps are preserved.";
  }

  if (config.expiryAction === "keep") {
    return lang === "es"
      ? "Cuando termine el periodo, conservarás tus sellos acumulados."
      : "When the period ends, your accumulated stamps will be preserved.";
  }

  return lang === "es"
    ? "Si termina el periodo sin completar tu tarjeta, los sellos incompletos se reiniciarán. Los premios que ya ganaste se conservan según sus propias reglas."
    : "If the period ends before you complete your card, incomplete stamps will reset. Rewards you have already earned remain subject to their own rules.";
}

/**
 * Explica cuántos sellos necesita el cliente.
 */
export function describeLoyaltyGoal(
  config: LoyaltyConfigInput,
  lang: "es" | "en" = "es",
): string {
  const amount = config.stampsPerReward;

  if (lang === "en") {
    return `Collect ${amount} ${
      amount === 1 ? "stamp" : "stamps"
    } to earn a reward.`;
  }

  return `Junta ${amount} ${
    amount === 1 ? "sello" : "sellos"
  } para obtener una recompensa.`;
}

/**
 * Explica la vigencia de un premio
 * después de que el cliente lo consigue.
 */
export function describeRewardValidity(
  config: LoyaltyConfigInput,
  lang: "es" | "en" = "es",
): string {
  if (config.rewardValidDays === null) {
    return lang === "es"
      ? "Tu premio no tiene vencimiento configurado."
      : "Your reward has no configured expiration.";
  }

  const days = config.rewardValidDays;

  if (lang === "en") {
    return `You have ${days} ${
      days === 1 ? "day" : "days"
    } after earning your reward to redeem it.`;
  }

  return `Tienes ${days} ${
    days === 1 ? "día" : "días"
  } después de ganar tu premio para canjearlo.`;
}
