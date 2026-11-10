import "server-only";
import { createECDH } from "node:crypto";
import webpush from "web-push";
import { menuAvailability } from "./inventory";
import { shortName, type Reservation, type StallState } from "./stall";
import { store } from "./store";
import type { Watch } from "./store/types";

// "Avísame cuando haya": browser push notifications (Web Push with VAPID keys,
// no paid provider). A watch waits for the stall to open or for a sold-out dish
// to come back, is sent once and then deleted.

const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
// Push services want a contact: mailto: or an https URL. Set VAPID_SUBJECT
// in production; the site URL is only a fallback.
const subject =
  process.env.VAPID_SUBJECT ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://localhost";

export const pushConfigured = () => Boolean(publicKey && privateKey);
export const vapidPublicKey = () => (pushConfigured() ? publicKey : null);

if (pushConfigured()) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  checkVapid();
}

/** Revisa al arrancar que las llaves sean pareja y que el subject sirva (sin imprimir valores). */
function checkVapid() {
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(privateKey, "base64url"));
    const derived = ecdh.getPublicKey().toString("base64url");
    if (derived !== publicKey.replace(/=+$/, "")) {
      console.error("push: VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY no son pareja; Apple y Google rechazan los avisos.");
    }
  } catch (e) {
    console.error("push: no se pudo leer VAPID_PRIVATE_KEY:", (e as Error).message);
  }
  if (!/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s]+)$/.test(subject) || /localhost/.test(subject)) {
    console.error("push: VAPID_SUBJECT debe ser mailto:correo@dominio o https://tu-dominio (sin espacios ni localhost).");
  }
}

/** Motivo del rechazo, para el log: código, respuesta del servicio y a quién se mandó. */
function why(e: unknown) {
  const err = e as { statusCode?: number; body?: string; endpoint?: string; message?: string };
  let host = "";
  try {
    host = err.endpoint ? new URL(err.endpoint).host : "";
  } catch {}
  return `${err.statusCode ?? "?"} ${String(err.body ?? err.message ?? "").slice(0, 200).trim()} ${host}`.trim();
}

type Message = { title: string; body: string; url: string };

function message(s: StallState, w: Watch, portions: Map<string, number>): Message {
  const es = w.lang === "es";
  const url = `/${w.lang}/${s.slug}`;
  const name = (id: string) => {
    const d = s.dishes.find((x) => x.id === id);
    return d ? (es ? d.nameEs : d.nameEn) : id;
  };
  if (w.dishId) {
    const n = portions.get(w.dishId) ?? 0;
    return es
      ? { title: `¡Volvió: ${name(w.dishId)}!`, body: `Quedan unas ${n} en ${s.name}. Apártala antes de que se acabe.`, url }
      : { title: `${name(w.dishId)} is back!`, body: `About ${n} left at ${s.name}. Reserve before it runs out.`, url };
  }
  const left = s.dishes.filter((d) => (portions.get(d.id) ?? 0) > 0).map((d) => name(d.id));
  const list = left.slice(0, 3).join(", ") + (left.length > 3 ? "…" : "");
  return es
    ? { title: `${s.name} ya abrió`, body: left.length ? `Todavía hay: ${list}` : "Pasa a ver qué hay.", url }
    : { title: `${s.name} is open`, body: left.length ? `Still available: ${list}` : "Come see what's left.", url };
}

/** Sends the watches that are due now: the stall is open, or their dish is available again. */
export async function notifyWaiting(s: StallState): Promise<number> {
  if (!pushConfigured() || !s.isOpen) return 0;
  const portions = new Map(menuAvailability(s.dishes, s.ingredients).map((a) => [a.dishId, a.portions]));
  const back = [...portions].filter(([, n]) => n > 0).map(([id]) => id);
  const due = await store.claimWatches(s.slug, true, back);
  if (!due.length) return 0;

  const results = await Promise.allSettled(
    due.map((w) =>
      webpush.sendNotification(
        { endpoint: w.endpoint, keys: { p256dh: w.p256dh, auth: w.auth } },
        JSON.stringify({ ...message(s, w, portions), tag: `${s.slug}-${w.dishId ?? "open"}` }),
        { TTL: 30 * 60, timeout: 10_000 },
      ),
    ),
  );
  let sent = 0;
  for (const r of results) {
    if (r.status === "fulfilled") sent++;
    // 404/410: the customer unsubscribed or the browser dropped it. Nothing to keep.
    else if (![404, 410].includes((r.reason as { statusCode?: number }).statusCode ?? 0)) {
      console.error("push: send failed", why(r.reason));
    }
  }
  console.log(`push: ${sent}/${due.length} sent for ${s.slug}`);
  return sent;
}

// ------------------------------------------
// Recoger: avisos al negocio y al cliente
// ------------------------------------------

type Push = { title: string; body: string; url: string; tag: string };

async function sendTo(slug: string, reservationId: string | null, build: (lang: "es" | "en") => Push): Promise<number> {
  if (!pushConfigured()) return 0;
  const targets = await store.pushTargets(slug, reservationId);
  let sent = 0;
  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          JSON.stringify(build(t.lang)),
          { TTL: 30 * 60, timeout: 10_000 },
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode ?? 0;
        if ([404, 410].includes(code)) await store.dropPush(slug, t.endpoint).catch(() => {});
        else console.error("push: send failed", why(e));
      }
    }),
  );
  return sent;
}

const label = (r: Reservation) => `#${r.orderNumber ?? "?"} · ${shortName(r.customerName)}`;
const time = (iso: string | null, s: StallState, lang: "es" | "en") =>
  iso
    ? new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", { hour: "numeric", minute: "2-digit", timeZone: s.timezone }).format(
        new Date(iso),
      )
    : "";

/** The kitchen should start on this order now. */
export const alertOwnerToPrepare = (s: StallState, r: Reservation) =>
  sendTo(s.slug, null, (lang) => ({
    title: lang === "es" ? `Por preparar: ${label(r)}` : `To prepare: ${label(r)}`,
    body:
      r.pickupMode === "scheduled"
        ? lang === "es"
          ? `Lo recogen a las ${time(r.pickupAt, s, lang)}.`
          : `Pickup at ${time(r.pickupAt, s, lang)}.`
        : lang === "es"
          ? "Pedido para ahorita."
          : "Order for right now.",
    url: `/${lang}/panel/${s.slug}`,
    tag: `prep-${r.id}`,
  }));

/** Scheduled hours ahead: still coming? */
export const askCustomerToConfirm = (s: StallState, r: Reservation) =>
  sendTo(s.slug, r.id, (lang) => ({
    title: lang === "es" ? `¿Sigues en pie para las ${time(r.pickupAt, s, lang)}?` : `Still coming at ${time(r.pickupAt, s, lang)}?`,
    body:
      lang === "es"
        ? `Confirma tu pedido en ${s.name} para que lo empiecen a preparar. Si no confirmas, se cancela sin costo.`
        : `Confirm your order at ${s.name} so they start preparing it. If you don't, it is cancelled at no cost.`,
    url: `/${lang}/${s.slug}`,
    tag: `confirm-${r.id}`,
  }));

export const tellCustomerReady = (s: StallState, r: Reservation) =>
  sendTo(s.slug, r.id, (lang) => ({
    title: lang === "es" ? "¡Tu pedido está listo!" : "Your order is ready!",
    body:
      lang === "es"
        ? `Pasa por él a ${s.name}. Di tu código al recoger.`
        : `Pick it up at ${s.name}. Say your code at the counter.`,
    url: `/${lang}/${s.slug}`,
    tag: `ready-${r.id}`,
  }));
