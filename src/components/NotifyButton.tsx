"use client";

import { useState, useSyncExternalStore } from "react";
import type { Dictionary } from "@/dictionaries";

// "Avísame cuando haya": subscribes this browser to a push notification for
// when the stall opens (dishId null) or a sold-out dish comes back.

type State = "idle" | "busy" | "on" | "denied" | "ios" | "error";

const key = (slug: string, dishId: string | null) => `watch:${slug}:${dishId ?? "open"}`;

/** Forget a sent alert so the button offers it again next time the dish runs out. */
export function forgetWatch(slug: string, dishId: string | null) {
  try {
    localStorage.removeItem(key(slug, dishId));
  } catch {}
}

const noop = () => () => {};

function isSaved(slug: string, dishId: string | null) {
  try {
    return Boolean(localStorage.getItem(key(slug, dishId)));
  } catch {
    return false;
  }
}

function supported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iPhone Safari only delivers web push to a page added to the home screen. */
function iosOutsideHomeScreen() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

function toKey(base64: string) {
  const s = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export function NotifyButton({
  slug,
  dishId,
  lang,
  vapidKey,
  t,
  wide = false,
}: {
  slug: string;
  dishId: string | null;
  lang: "es" | "en";
  vapidKey: string;
  t: Dictionary;
  wide?: boolean;
}) {
  const p = t.public;
  const [picked, setState] = useState<State>("idle");
  // Rendered on the server too: only show once we know the browser can do it.
  const shown = useSyncExternalStore(noop, () => supported() || iosOutsideHomeScreen(), () => false);
  const saved = useSyncExternalStore(noop, () => isSaved(slug, dishId), () => false);
  const state: State = picked === "idle" && saved ? "on" : picked;

  async function subscribe() {
    if (!supported()) return setState("ios");
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      if ((await Notification.requestPermission()) !== "granted") return setState("denied");
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(vapidKey) }));
      const res = await fetch(`/api/stalls/${slug}/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dishId, lang, subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error(`watch ${res.status}`);
      try {
        localStorage.setItem(key(slug, dishId), String(Date.now()));
      } catch {}
      setState("on");
    } catch (e) {
      console.error(e);
      setState("error");
    }
  }

  if (!shown) return null;
  const note = { denied: p.notifyDenied, ios: p.notifyIos, error: p.notifyError }[state as string];

  return (
    <div className={`flex flex-col gap-1 ${wide ? "" : "items-end"}`}>
      <button
        onClick={subscribe}
        disabled={state === "busy" || state === "on"}
        aria-pressed={state === "on"}
        className={`rounded-full px-3 py-1.5 text-sm font-semibold active:scale-95 ${
          state === "on" ? "bg-ok-soft text-ok" : "bg-brand text-white"
        } ${wide ? "py-3 text-base" : ""} disabled:active:scale-100`}
      >
        {state === "on" ? `✓ ${p.notifyOn}` : `🔔 ${dishId ? p.notifyDish : p.notifyOpen}`}
      </button>
      {state === "on" && wide && <p className="text-sm text-muted">{p.notifyOpenOn}</p>}
      {note && <p className={`text-xs text-muted ${wide ? "" : "max-w-48 text-right"}`}>{note}</p>}
    </div>
  );
}
