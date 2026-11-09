
import {
  isActive,
  type PickupSettings,
  type Reservation,
  type StallState,
} from "./stall";

// ==========================================
// TODAVÍA HAY
// CONFIGURACIÓN DE RECOGIDA
// ==========================================

// No permitir horarios programados
// durante los últimos 20 minutos
// antes del cierre del negocio.

export const CLOSING_BUFFER_MINUTES = 20;

export const DEFAULT_PICKUP: PickupSettings = {
  asapMinutes: 30,
  noticeMinutes: 20,
  slotMinutes: 15,
  maxPerSlot: null,
  toleranceMinutes: 20,
  dineIn: false,
  dineInToleranceMinutes: 15,
};

export const CONFIRM_AFTER_MINUTES = 60;
export const CONFIRM_MARGIN_MINUTES = 15;

const MIN = 60_000;

// ==========================================
// CONFIGURACIÓN
// ==========================================

export function pickupSettings(
  s: Pick<StallState, "settings">,
): PickupSettings {
  const p = {
    ...DEFAULT_PICKUP,
    ...(s.settings?.pickup ?? {}),
  };

  const whole = (
    n: unknown,
    d: number,
    lo: number,
    hi: number,
  ) =>
    typeof n === "number" &&
    Number.isFinite(n)
      ? Math.min(
          hi,
          Math.max(lo, Math.round(n)),
        )
      : d;

  return {
    asapMinutes: whole(
      p.asapMinutes,
      DEFAULT_PICKUP.asapMinutes,
      1,
      240,
    ),

    noticeMinutes: whole(
      p.noticeMinutes,
      DEFAULT_PICKUP.noticeMinutes,
      0,
      240,
    ),

    slotMinutes: whole(
      p.slotMinutes,
      DEFAULT_PICKUP.slotMinutes,
      5,
      120,
    ),

    maxPerSlot:
      p.maxPerSlot == null ||
      !(p.maxPerSlot > 0)
        ? null
        : whole(
            p.maxPerSlot,
            1,
            1,
            500,
          ),

    toleranceMinutes: whole(
      p.toleranceMinutes,
      DEFAULT_PICKUP.toleranceMinutes,
      0,
      240,
    ),

    dineIn: p.dineIn === true,

    dineInToleranceMinutes: whole(
      p.dineInToleranceMinutes,
      DEFAULT_PICKUP.dineInToleranceMinutes,
      0,
      120,
    ),
  };
}

// ==========================================
// ZONAS HORARIAS
// ==========================================

export function localParts(
  date: Date,
  timeZone: string,
) {
  const f = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    },
  );

  const p = Object.fromEntries(
    f.formatToParts(date).map(
      (x) => [x.type, x.value],
    ),
  );

  const day = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ].indexOf(p.weekday);

  return {
    day,

    minutes:
      Number(p.hour) * 60 +
      Number(p.minute),

    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),

    offsetMs:
      Date.UTC(
        Number(p.year),
        Number(p.month) - 1,
        Number(p.day),
        Number(p.hour),
        Number(p.minute),
        Number(p.second),
      ) -
      Math.floor(
        date.getTime() / 1000,
      ) *
        1000,
  };
}

export function atLocal(
  date: Date,
  timeZone: string,
  minutes: number,
  addDays = 0,
): Date {
  const { y, m, d } = localParts(
    date,
    timeZone,
  );

  const naive = Date.UTC(
    y,
    m - 1,
    d + addDays,
    0,
    minutes,
  );

  let t =
    naive -
    localParts(
      new Date(naive),
      timeZone,
    ).offsetMs;

  t =
    naive -
    localParts(
      new Date(t),
      timeZone,
    ).offsetMs;

  return new Date(t);
}

const toMinutes = (hhmm: string) => {
  const m =
    /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(
      hhmm.trim(),
    );

  return m
    ? Number(m[1]) * 60 +
        Number(m[2])
    : null;
};

export function hhmm(
  date: Date,
  timeZone: string,
) {
  const { minutes } = localParts(
    date,
    timeZone,
  );

  return `${String(
    Math.floor(minutes / 60),
  ).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;
}

// ==========================================
// HORARIO DE APERTURA Y CIERRE
// ==========================================

type Window = {
  open: Date;
  close: Date;
};

const configured = (
  s: Pick<StallState, "settings">,
) =>
  (s.settings?.openingHours ?? [])
    .length > 0;

export function todayWindow(
  s: Pick<
    StallState,
    "settings" | "timezone"
  >,
  now: Date,
): Window | null {
  if (!configured(s)) {
    return {
      open: atLocal(
        now,
        s.timezone,
        0,
      ),
      close: atLocal(
        now,
        s.timezone,
        0,
        1,
      ),
    };
  }

  const today = localParts(
    now,
    s.timezone,
  ).day;

  const h =
    s.settings!.openingHours!.find(
      (x) => x.day === today,
    );

  if (!h?.enabled) return null;

  const open = toMinutes(h.open);
  let close = toMinutes(h.close);

  if (
    open === null ||
    close === null
  ) {
    return null;
  }

  // Negocios que cierran
  // después de medianoche.
  if (close <= open) {
    close += 24 * 60;
  }

  return {
    open: atLocal(
      now,
      s.timezone,
      open,
    ),
    close: atLocal(
      now,
      s.timezone,
      close,
    ),
  };
}

export function nextOpening(
  s: Pick<
    StallState,
    "settings" | "timezone"
  >,
  now: Date,
): Date | null {
  if (!configured(s)) {
    return null;
  }

  for (
    let add = 0;
    add <= 7;
    add++
  ) {
    const probe = atLocal(
      now,
      s.timezone,
      12 * 60,
      add,
    );

    const day = localParts(
      probe,
      s.timezone,
    ).day;

    const h =
      s.settings!.openingHours!.find(
        (x) => x.day === day,
      );

    const open = h?.enabled
      ? toMinutes(h.open)
      : null;

    if (open === null) continue;

    const at = atLocal(
      now,
      s.timezone,
      open,
      add,
    );

    if (at > now) return at;
  }

  return null;
}

// ==========================================
// OPCIONES DE RECOGIDA
// ==========================================

export type Unavailable =
  | "closed"
  | "closing";

export type PickupOptions = {
  asap:
    | {
        available: true;
        readyAt: Date;
      }
    | {
        available: false;
        reason: Unavailable;
      };

  slots: Date[];
  opensAt: Date | null;
};

const roundUp = (
  t: number,
  step: number,
) =>
  Math.ceil(t / step) * step;

// ==========================================
// CONTAR PEDIDOS POR HORARIO
// ==========================================

function slotCount(
  s: StallState,
  slotStart: Date,
  slotMinutes: number,
) {
  const a = slotStart.getTime();
  const b =
    a + slotMinutes * MIN;

  return s.reservations.filter(
    (r) => {
      if (
        !isActive(r) ||
        r.pickupMode !== "scheduled" ||
        !r.pickupAt
      ) {
        return false;
      }

      const t = new Date(
        r.pickupAt,
      ).getTime();

      return t >= a && t < b;
    },
  ).length;
}

// ==========================================
// GENERAR HORARIOS DISPONIBLES
// ==========================================

export function pickupOptions(
  s: StallState,
  now = new Date(),
): PickupOptions {
  const p = pickupSettings(s);
  const w = todayWindow(s, now);

  const inHours =
    !!w &&
    now >= w.open &&
    now < w.close;

  const opensAt = inHours
    ? null
    : w && now < w.open
      ? w.open
      : nextOpening(s, now);

  // ========================================
  // RECOGIDA INMEDIATA
  // ========================================

  let asap: PickupOptions["asap"];

  const readyAt = new Date(
    now.getTime() +
      p.asapMinutes * MIN,
  );

  if (
    !s.isOpen ||
    !inHours
  ) {
    asap = {
      available: false,
      reason: "closed",
    };
  } else if (
    readyAt > w!.close
  ) {
    asap = {
      available: false,
      reason: "closing",
    };
  } else {
    asap = {
      available: true,
      readyAt,
    };
  }

  // ========================================
  // RECOGIDA PROGRAMADA
  // ========================================

  const slots: Date[] = [];

  if (
    s.isOpen &&
    w &&
    now < w.close
  ) {
    const step =
      p.slotMinutes * MIN;

    const base =
      w.open.getTime();

    const earliest = Math.max(
      base,
      now.getTime() +
        p.noticeMinutes * MIN,
    );

    // Última hora en la que se
    // puede programar una recogida.
    const latest =
      w.close.getTime() -
      CLOSING_BUFFER_MINUTES * MIN;

    // No mostrar horarios una vez
    // alcanzada la hora límite.
    if (
      earliest <= latest &&
      now.getTime() < latest
    ) {
      const first =
        base +
        roundUp(
          earliest - base,
          step,
        );

      for (
        let t = first;
        t <= latest;
        t += step
      ) {
        const at = new Date(t);

        if (
          p.maxPerSlot === null ||
          slotCount(
            s,
            at,
            p.slotMinutes,
          ) < p.maxPerSlot
        ) {
          slots.push(at);
        }
      }
    }
  }

  return {
    asap,
    slots,
    opensAt,
  };
}

// ==========================================
// VALIDAR ELECCIÓN DEL CLIENTE
// ==========================================

export type PickupChoice =
  | {
      mode: "asap";
    }
  | {
      mode: "scheduled";
      time: string;
    };

export type ResolvedPickup = {
  mode: "asap" | "scheduled";
  pickupAt: Date;
  pickupBy: Date;
};

export type PickupRejection =
  | "closed"
  | "closing"
  | "bad_time"
  | "too_soon"
  | "outside_hours"
  | "full";

export function resolvePickup(
  s: StallState,
  choice: PickupChoice,
  now = new Date(),
  dineIn = false,
):
  | {
      ok: true;
      pickup: ResolvedPickup;
    }
  | {
      ok: false;
      reason: PickupRejection;
      options: PickupOptions;
    } {
  const p = pickupSettings(s);

  const options = pickupOptions(
    s,
    now,
  );

  const done = (
    pickupAt: Date,
  ) => ({
    ok: true as const,

    pickup: {
      mode: choice.mode,
      pickupAt,

      pickupBy: new Date(
        pickupAt.getTime() +
          (dineIn
            ? p.dineInToleranceMinutes
            : p.toleranceMinutes) *
            MIN,
      ),
    },
  });

  // ========================================
  // PARA AHORITA
  // ========================================

  if (choice.mode === "asap") {
    return options.asap.available
      ? done(options.asap.readyAt)
      : {
          ok: false,
          reason:
            options.asap.reason,
          options,
        };
  }

  // ========================================
  // HORARIO PROGRAMADO
  // ========================================

  const minutes = toMinutes(
    choice.time,
  );

  if (minutes === null) {
    return {
      ok: false,
      reason: "bad_time",
      options,
    };
  }

  const at = atLocal(
    now,
    s.timezone,
    minutes,
  );

  // Validar que esté dentro
  // de las horas disponibles.
  if (
    options.slots.some(
      (x) =>
        x.getTime() ===
        at.getTime(),
    )
  ) {
    return done(at);
  }

  const w = todayWindow(
    s,
    now,
  );

  if (!s.isOpen || !w) {
    return {
      ok: false,
      reason: "closed",
      options,
    };
  }

  const latest =
    w.close.getTime() -
    CLOSING_BUFFER_MINUTES * MIN;

  // Rechazar cualquier horario
  // dentro de los últimos 20 minutos.
  if (
    at.getTime() > latest ||
    now.getTime() >= latest
  ) {
    return {
      ok: false,
      reason: "closing",
      options,
    };
  }

  if (
    at < w.open ||
    at > w.close
  ) {
    return {
      ok: false,
      reason: "outside_hours",
      options,
    };
  }

  if (
    at.getTime() <
    now.getTime() +
      p.noticeMinutes * MIN
  ) {
    return {
      ok: false,
      reason: "too_soon",
      options,
    };
  }

  const step =
    p.slotMinutes * MIN;

  const onGrid =
    (at.getTime() -
      w.open.getTime()) %
      step ===
    0;

  if (!onGrid) {
    const slot = new Date(
      w.open.getTime() +
        roundUp(
          at.getTime() -
            w.open.getTime(),
          step,
        ),
    );

    if (
      options.slots.some(
        (x) =>
          x.getTime() ===
          slot.getTime(),
      )
    ) {
      return done(slot);
    }
  }

  return {
    ok: false,
    reason: "full",
    options,
  };
}

// ==========================================
// PREPARACIÓN Y CONFIRMACIÓN
// ==========================================

export type KitchenStage =
  | "scheduled"
  | "awaiting_confirmation"
  | "to_prepare"
  | "ready";

type Timed = Pick<
  Reservation,
  | "pickupMode"
  | "pickupAt"
  | "createdAt"
  | "confirmedAt"
  | "readyAt"
>;

export function needsConfirmation(
  r: Timed,
) {
  return (
    r.pickupMode === "scheduled" &&
    !!r.pickupAt &&
    new Date(
      r.pickupAt,
    ).getTime() -
      new Date(
        r.createdAt,
      ).getTime() >
      CONFIRM_AFTER_MINUTES * MIN
  );
}

export function prepStartsAt(
  r: Timed,
  p: PickupSettings,
) {
  if (
    r.pickupMode !== "scheduled" ||
    !r.pickupAt
  ) {
    return new Date(
      r.createdAt,
    );
  }

  return new Date(
    new Date(
      r.pickupAt,
    ).getTime() -
      p.noticeMinutes * MIN,
  );
}

export function confirmAskAt(
  r: Timed,
  p: PickupSettings,
) {
  return new Date(
    prepStartsAt(
      r,
      p,
    ).getTime() -
      CONFIRM_MARGIN_MINUTES * MIN,
  );
}

export function kitchenStage(
  r: Timed,
  p: PickupSettings,
  now = new Date(),
): KitchenStage {
  if (r.readyAt) {
    return "ready";
  }

  const start =
    prepStartsAt(r, p);

  if (
    needsConfirmation(r) &&
    !r.confirmedAt
  ) {
    return now >=
      confirmAskAt(
        r,
        p,
      )
      ? "awaiting_confirmation"
      : "scheduled";
  }

  return now >= start
    ? "to_prepare"
    : "scheduled";
}
