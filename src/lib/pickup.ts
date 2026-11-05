import { isActive, type PickupSettings, type Reservation, type StallState } from "./stall";

// "Recoger": when an order can be picked up. Two modes:
// - asap ("para ahorita"): prepared right away, ready in about asapMinutes.
// - scheduled ("para una hora"): today only, inside opening hours, no sooner
//   than now + noticeMinutes, with an optional cap of orders per slot.
// Orders scheduled more than an hour ahead must be confirmed by the customer
// before the kitchen starts; unconfirmed ones are released for free. An order
// nobody picks up within the tolerance is charged (the customer is told so).

export const DEFAULT_PICKUP: PickupSettings = {
  asapMinutes: 30,
  noticeMinutes: 20,
  slotMinutes: 15,
  maxPerSlot: null,
  toleranceMinutes: 20,
};

/** Scheduled further ahead than this needs the customer's confirmation. */
export const CONFIRM_AFTER_MINUTES = 60;
/** The confirmation is asked this long before the kitchen would start. */
export const CONFIRM_MARGIN_MINUTES = 15;

const MIN = 60_000;

export function pickupSettings(s: Pick<StallState, "settings">): PickupSettings {
  const p = { ...DEFAULT_PICKUP, ...(s.settings?.pickup ?? {}) };
  const whole = (n: unknown, d: number, lo: number, hi: number) =>
    typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
  return {
    asapMinutes: whole(p.asapMinutes, DEFAULT_PICKUP.asapMinutes, 1, 240),
    noticeMinutes: whole(p.noticeMinutes, DEFAULT_PICKUP.noticeMinutes, 0, 240),
    slotMinutes: whole(p.slotMinutes, DEFAULT_PICKUP.slotMinutes, 5, 120),
    maxPerSlot: p.maxPerSlot == null || !(p.maxPerSlot > 0) ? null : whole(p.maxPerSlot, 1, 1, 500),
    toleranceMinutes: whole(p.toleranceMinutes, DEFAULT_PICKUP.toleranceMinutes, 0, 240),
  };
}

// ------------------------------------------
// Time zones
// ------------------------------------------

/** Local weekday, minutes after midnight and calendar date of an instant. */
export function localParts(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return {
    day,
    minutes: Number(p.hour) * 60 + Number(p.minute),
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    offsetMs:
      Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) -
      Math.floor(date.getTime() / 1000) * 1000,
  };
}

/** The instant at `minutes` after local midnight of the local day `date` falls on (plus `addDays`). */
export function atLocal(date: Date, timeZone: string, minutes: number, addDays = 0): Date {
  const { y, m, d } = localParts(date, timeZone);
  const naive = Date.UTC(y, m - 1, d + addDays, 0, minutes);
  let t = naive - localParts(new Date(naive), timeZone).offsetMs;
  // Around a DST change the offset at the result can differ from the guess.
  t = naive - localParts(new Date(t), timeZone).offsetMs;
  return new Date(t);
}

const toMinutes = (hhmm: string) => {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** "15:30" in the stall's time zone. */
export function hhmm(date: Date, timeZone: string) {
  const { minutes } = localParts(date, timeZone);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// ------------------------------------------
// Opening hours
// ------------------------------------------

type Window = { open: Date; close: Date };

const configured = (s: Pick<StallState, "settings">) => (s.settings?.openingHours ?? []).length > 0;

/**
 * Today's opening window. With no hours configured the whole local day counts,
 * so only "Abrir día" in the panel decides.
 */
export function todayWindow(s: Pick<StallState, "settings" | "timezone">, now: Date): Window | null {
  if (!configured(s)) return { open: atLocal(now, s.timezone, 0), close: atLocal(now, s.timezone, 0, 1) };
  const today = localParts(now, s.timezone).day;
  const h = s.settings!.openingHours!.find((x) => x.day === today);
  if (!h?.enabled) return null;
  const open = toMinutes(h.open);
  let close = toMinutes(h.close);
  if (open === null || close === null) return null;
  if (close <= open) close += 24 * 60; // closes after midnight
  return { open: atLocal(now, s.timezone, open), close: atLocal(now, s.timezone, close) };
}

/** When the stall next opens after `now`, from its weekly hours. */
export function nextOpening(s: Pick<StallState, "settings" | "timezone">, now: Date): Date | null {
  if (!configured(s)) return null;
  for (let add = 0; add <= 7; add++) {
    const probe = atLocal(now, s.timezone, 12 * 60, add);
    const day = localParts(probe, s.timezone).day;
    const h = s.settings!.openingHours!.find((x) => x.day === day);
    const open = h?.enabled ? toMinutes(h.open) : null;
    if (open === null) continue;
    const at = atLocal(now, s.timezone, open, add);
    if (at > now) return at;
  }
  return null;
}

// ------------------------------------------
// Options shown to the customer
// ------------------------------------------

export type Unavailable = "closed" | "closing";

export type PickupOptions = {
  asap: { available: true; readyAt: Date } | { available: false; reason: Unavailable };
  /** Free slots left today, earliest first. */
  slots: Date[];
  /** When the stall opens next, if it is closed now. */
  opensAt: Date | null;
};

const roundUp = (t: number, step: number) => Math.ceil(t / step) * step;

function slotCount(s: StallState, slotStart: Date, slotMinutes: number) {
  const a = slotStart.getTime();
  const b = a + slotMinutes * MIN;
  return s.reservations.filter((r) => {
    if (!isActive(r) || r.pickupMode !== "scheduled" || !r.pickupAt) return false;
    const t = new Date(r.pickupAt).getTime();
    return t >= a && t < b;
  }).length;
}

export function pickupOptions(s: StallState, now = new Date()): PickupOptions {
  const p = pickupSettings(s);
  const w = todayWindow(s, now);
  const inHours = !!w && now >= w.open && now < w.close;
  const opensAt = inHours ? null : w && now < w.open ? w.open : nextOpening(s, now);

  let asap: PickupOptions["asap"];
  const readyAt = new Date(now.getTime() + p.asapMinutes * MIN);
  if (!s.isOpen || !inHours) asap = { available: false, reason: "closed" };
  else if (readyAt > w!.close) asap = { available: false, reason: "closing" };
  else asap = { available: true, readyAt };

  const slots: Date[] = [];
  if (s.isOpen && w && now < w.close) {
    const step = p.slotMinutes * MIN;
    // Slots line up with the opening time (9:00, 9:15...), not with "now".
    const base = w.open.getTime();
    const earliest = Math.max(base, now.getTime() + p.noticeMinutes * MIN);
    for (let t = base + roundUp(earliest - base, step); t <= w.close.getTime(); t += step) {
      const at = new Date(t);
      if (p.maxPerSlot === null || slotCount(s, at, p.slotMinutes) < p.maxPerSlot) slots.push(at);
    }
  }
  return { asap, slots, opensAt };
}

// ------------------------------------------
// Validating a choice
// ------------------------------------------

export type PickupChoice = { mode: "asap" } | { mode: "scheduled"; time: string };

export type ResolvedPickup = {
  mode: "asap" | "scheduled";
  pickupAt: Date;
  /** After this, an order nobody collected is charged. */
  pickupBy: Date;
};

export type PickupRejection = "closed" | "closing" | "bad_time" | "too_soon" | "outside_hours" | "full";

export function resolvePickup(
  s: StallState,
  choice: PickupChoice,
  now = new Date(),
): { ok: true; pickup: ResolvedPickup } | { ok: false; reason: PickupRejection; options: PickupOptions } {
  const p = pickupSettings(s);
  const options = pickupOptions(s, now);
  const done = (pickupAt: Date) => ({
    ok: true as const,
    pickup: { mode: choice.mode, pickupAt, pickupBy: new Date(pickupAt.getTime() + p.toleranceMinutes * MIN) },
  });
  if (choice.mode === "asap") {
    return options.asap.available ? done(options.asap.readyAt) : { ok: false, reason: options.asap.reason, options };
  }
  const minutes = toMinutes(choice.time);
  if (minutes === null) return { ok: false, reason: "bad_time", options };
  const at = atLocal(now, s.timezone, minutes);
  if (options.slots.some((x) => x.getTime() === at.getTime())) return done(at);

  // Say why, most specific first.
  const w = todayWindow(s, now);
  if (!s.isOpen || !w) return { ok: false, reason: "closed", options };
  if (at < w.open || at > w.close) return { ok: false, reason: "outside_hours", options };
  if (at.getTime() < now.getTime() + p.noticeMinutes * MIN) return { ok: false, reason: "too_soon", options };
  const step = p.slotMinutes * MIN;
  const onGrid = (at.getTime() - w.open.getTime()) % step === 0;
  if (!onGrid) {
    // "a las 3:10" with 15-minute slots: take the slot it falls in if it is free.
    const slot = new Date(w.open.getTime() + roundUp(at.getTime() - w.open.getTime(), step));
    if (options.slots.some((x) => x.getTime() === slot.getTime())) return done(slot);
  }
  return { ok: false, reason: "full", options };
}

// ------------------------------------------
// Where an order is in the kitchen
// ------------------------------------------

export type KitchenStage = "scheduled" | "awaiting_confirmation" | "to_prepare" | "ready";

type Timed = Pick<Reservation, "pickupMode" | "pickupAt" | "createdAt" | "confirmedAt" | "readyAt">;

export function needsConfirmation(r: Timed) {
  return (
    r.pickupMode === "scheduled" &&
    !!r.pickupAt &&
    new Date(r.pickupAt).getTime() - new Date(r.createdAt).getTime() > CONFIRM_AFTER_MINUTES * MIN
  );
}

/** When the kitchen should start on it. */
export function prepStartsAt(r: Timed, p: PickupSettings) {
  if (r.pickupMode !== "scheduled" || !r.pickupAt) return new Date(r.createdAt);
  return new Date(new Date(r.pickupAt).getTime() - p.noticeMinutes * MIN);
}

export function confirmAskAt(r: Timed, p: PickupSettings) {
  return new Date(prepStartsAt(r, p).getTime() - CONFIRM_MARGIN_MINUTES * MIN);
}

export function kitchenStage(r: Timed, p: PickupSettings, now = new Date()): KitchenStage {
  if (r.readyAt) return "ready";
  const start = prepStartsAt(r, p);
  if (needsConfirmation(r) && !r.confirmedAt) return now >= confirmAskAt(r, p) ? "awaiting_confirmation" : "scheduled";
  return now >= start ? "to_prepare" : "scheduled";
}
