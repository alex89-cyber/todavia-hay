import "server-only";
import webpush from "web-push";
import { menuAvailability } from "./inventory";
import type { StallState } from "./stall";
import { store } from "./store";
import type { Watch } from "./store/types";

// "Avísame cuando haya": browser push notifications (Web Push with VAPID keys,
// no paid provider). A watch waits for the stall to open or for a sold-out dish
// to come back, is sent once and then deleted.

const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
// Push services want a contact: mailto: or an https URL.
const subject = process.env.VAPID_SUBJECT || "https://hachaton-paypal.onrender.com";

export const pushConfigured = () => Boolean(publicKey && privateKey);
export const vapidPublicKey = () => (pushConfigured() ? publicKey : null);

if (pushConfigured()) webpush.setVapidDetails(subject, publicKey, privateKey);

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
      console.error("push: send failed", (r.reason as Error).message);
    }
  }
  console.log(`push: ${sent}/${due.length} sent for ${s.slug}`);
  return sent;
}
