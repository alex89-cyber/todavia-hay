// Browser side of Web Push: register the service worker and get a subscription.

export type PushProblem = "unsupported" | "ios" | "denied";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iPhone Safari only delivers web push to a page added to the home screen. */
export function iosOutsideHomeScreen() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return ios && (navigator as { standalone?: boolean }).standalone !== true;
}

function toKey(base64: string) {
  const s = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

/** Asks permission (must run from a tap) and returns the subscription, or why not. */
export async function subscribePush(vapidKey: string): Promise<PushSubscriptionJSON | PushProblem> {
  if (!pushSupported()) return iosOutsideHomeScreen() ? "ios" : "unsupported";
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  const key = toKey(vapidKey);
  let sub = await reg.pushManager.getSubscription();
  // Si se suscribió con otras llaves (cambiaron en el servidor), esa
  // suscripción ya no recibe avisos: se cambia por una nueva.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe().catch(() => false);
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  return sub.toJSON();
}

function sameKey(current: ArrayBuffer | null | undefined, wanted: Uint8Array) {
  if (!current) return false;
  const a = new Uint8Array(current);
  return a.length === wanted.length && a.every((b, i) => b === wanted[i]);
}
