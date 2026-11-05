
/**
 * ¿Todavía hay?
 * Cálculo de periodos y vencimientos de recompensas.
 *
 * No modifica la base de datos ni los sellos.
 * Se utiliza desde la lógica segura del servidor.
 */

export type LoyaltyPeriodKind =
  | "none"
  | "calendar_week"
  | "calendar_month"
  | "rolling_days";

export type LoyaltyExpiryAction = "reset" | "keep";

export type LoyaltyPeriodConfig = {
  periodKind: LoyaltyPeriodKind;
  periodDays: number;
  expiryAction: LoyaltyExpiryAction;
  timezone: string;
};

export type LoyaltyPeriod = {
  startsAt: string | null;
  endsAt: string | null;
  hasExpiration: boolean;
};

export type LoyaltyProgress = {
  stamps: number;
  stampsRequired: number;
  stampsRemaining: number;
  rewardReady: boolean;
  startsAt: string | null;
  endsAt: string | null;
  expired: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

type LocalDate = {
  year: number;
  month: number;
  day: number;
};

function getFormatter(timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function getLocalParts(
  date: Date,
  timezone: string,
) {
  const parts = getFormatter(timezone).formatToParts(date);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function localMidnightToUTC(
  date: LocalDate,
  timezone: string,
): Date {
  const desired = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
  );

  let guess = desired;

  // Convertir medianoche local a UTC, considerando
  // el desfase horario y sus posibles cambios.
  for (let i = 0; i < 5; i++) {
    const actual = getLocalParts(
      new Date(guess),
      timezone,
    );

    const actualAsUTC = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );

    const difference = desired - actualAsUTC;

    if (difference === 0) {
      break;
    }

    guess += difference;
  }

  return new Date(guess);
}

function addCalendarDays(
  date: LocalDate,
  amount: number,
): LocalDate {
  const result = new Date(
    Date.UTC(
      date.year,
      date.month - 1,
      date.day + amount,
    ),
  );

  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  };
}

function validateTimezone(timezone: string) {
  // Lanza un error si la zona horaria es inválida.
  getFormatter(timezone).format(new Date());
}

export function calculateLoyaltyPeriod(
  config: LoyaltyPeriodConfig,
  now: Date = new Date(),
  firstStampAt?: Date | string | null,
): LoyaltyPeriod {
  validateTimezone(config.timezone);

  if (Number.isNaN(now.getTime())) {
    throw new Error("Invalid current date");
  }

  if (config.periodKind === "none") {
    return {
      startsAt: null,
      endsAt: null,
      hasExpiration: false,
    };
  }

  const local = getLocalParts(now, config.timezone);

  if (config.periodKind === "calendar_month") {
    const start = localMidnightToUTC(
      {
        year: local.year,
        month: local.month,
        day: 1,
      },
      config.timezone,
    );

    const end = localMidnightToUTC(
      {
        year:
          local.month === 12
            ? local.year + 1
            : local.year,
        month:
          local.month === 12
            ? 1
            : local.month + 1,
        day: 1,
      },
      config.timezone,
    );

    return {
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      hasExpiration: true,
    };
  }

  if (config.periodKind === "calendar_week") {
    const currentDay = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
    );

    const jsDay = new Date(currentDay).getUTCDay();

    // Lunes = primer día de la semana.
    const daysSinceMonday = (jsDay + 6) % 7;

    const monday = addCalendarDays(
      {
        year: local.year,
        month: local.month,
        day: local.day,
      },
      -daysSinceMonday,
    );

    const nextMonday = addCalendarDays(monday, 7);

    return {
      startsAt: localMidnightToUTC(
        monday,
        config.timezone,
      ).toISOString(),

      endsAt: localMidnightToUTC(
        nextMonday,
        config.timezone,
      ).toISOString(),

      hasExpiration: true,
    };
  }

  if (config.periodKind === "rolling_days") {
    if (
      !Number.isInteger(config.periodDays) ||
      config.periodDays < 1 ||
      config.periodDays > 365
    ) {
      throw new Error(
        "Loyalty period days must be between 1 and 365",
      );
    }

    const start = firstStampAt
      ? new Date(firstStampAt)
      : now;

    if (Number.isNaN(start.getTime())) {
      throw new Error("Invalid first stamp date");
    }

    // En esta modalidad el plazo comienza exactamente
    // cuando se obtiene el primer sello del periodo.
    const end = new Date(
      start.getTime() + config.periodDays * DAY_MS,
    );

    return {
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      hasExpiration: true,
    };
  }

  throw new Error("Unsupported loyalty period");
}

export function isLoyaltyPeriodExpired(
  endsAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!endsAt) {
    return false;
  }

  const end = new Date(endsAt);

  if (Number.isNaN(end.getTime())) {
    throw new Error("Invalid loyalty expiration date");
  }

  // endsAt es exclusivo: al llegar a esa hora,
  // el periodo ya terminó.
  return now.getTime() >= end.getTime();
}

export function getLoyaltyProgress(
  stamps: number,
  stampsRequired: number,
  period: LoyaltyPeriod,
  now: Date = new Date(),
): LoyaltyProgress {
  const required = Math.max(
    1,
    Math.floor(stampsRequired),
  );

  const current = Math.max(
    0,
    Math.floor(stamps),
  );

  return {
    stamps: current,
    stampsRequired: required,
    stampsRemaining: Math.max(0, required - current),
    rewardReady: current >= required,
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    expired: isLoyaltyPeriodExpired(
      period.endsAt,
      now,
    ),
  };
}

export function formatLoyaltyExpiration(
  endsAt: string | null,
  timezone: string,
  lang: "es" | "en" = "es",
): string | null {
  if (!endsAt) {
    return null;
  }

  const end = new Date(endsAt);

  if (Number.isNaN(end.getTime())) {
    return null;
  }

  // Mostrar la fecha y hora en la que termina
  // el periodo, según el horario del negocio.
  return new Intl.DateTimeFormat(
    lang === "es" ? "es-MX" : "en-US",
    {
      timeZone: timezone,
      dateStyle: "long",
      timeStyle: "short",
    },
  ).format(end);
}

export function getLoyaltyMessage(
  progress: LoyaltyProgress,
  lang: "es" | "en" = "es",
): string {
  if (progress.expired) {
    return lang === "es"
      ? "El periodo de esta tarjeta terminó. Consulta tus sellos vigentes."
      : "This stamp card period has ended. Check your current stamps.";
  }

  if (progress.rewardReady) {
    return lang === "es"
      ? "¡Felicidades! Ya reuniste los sellos necesarios para obtener tu recompensa."
      : "Congratulations! You have collected enough stamps for your reward.";
  }

  const missing = progress.stampsRemaining;

  if (lang === "en") {
    return `You need ${missing} more ${
      missing === 1 ? "stamp" : "stamps"
    } to earn your reward.`;
  }

  return `Te ${
    missing === 1 ? "falta" : "faltan"
  } ${missing} ${
    missing === 1 ? "sello" : "sellos"
  } para obtener tu recompensa.`;
}
