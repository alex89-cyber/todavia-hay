import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// The owner panel, the cash-up and every owner action sit behind a PIN set in
// OWNER_PIN. Entering it once leaves a signed, httpOnly cookie on that device.
// Without OWNER_PIN (local dev, tests) everything stays open.

export const OWNER_COOKIE = "th_owner";
const MAX_AGE_S = 30 * 24 * 3600;

const pin = () => process.env.OWNER_PIN?.trim() ?? "";
export const ownerPinRequired = () => pin().length > 0;

/** Changing OWNER_PIN signs everyone out, since the token is derived from it. */
const token = () => createHmac("sha256", pin()).update("todavia-hay:owner:v1").digest("hex");

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function pinMatches(candidate: string) {
  return ownerPinRequired() && same(candidate.trim(), pin());
}

/** For pages and route handlers: is this request from the owner? */
export async function isOwner() {
  if (!ownerPinRequired()) return true;
  const c = (await cookies()).get(OWNER_COOKIE)?.value;
  return Boolean(c && same(c, token()));
}

export async function signIn() {
  (await cookies()).set(OWNER_COOKIE, token(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function signOut() {
  (await cookies()).delete(OWNER_COOKIE);
}

export const unauthorized = () => Response.json({ error: "owner_only" }, { status: 401 });

// A few wrong PINs per minute per address, so a 4-6 digit PIN can't be guessed.
const WINDOW_MS = 60_000;
const MAX_TRIES = 5;
const tries = new Map<string, number[]>();

export function tooManyTries(ip: string) {
  const now = Date.now();
  const recent = (tries.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  tries.set(ip, recent);
  return recent.length >= MAX_TRIES;
}

export function recordFailure(ip: string) {
  tries.set(ip, [...(tries.get(ip) ?? []), Date.now()]);
}

/** Demo-only tools (resetting the stall to a seeded day) are on with DEMO_MODE=1. */
export const demoMode = () => ["1", "true", "yes"].includes((process.env.DEMO_MODE ?? "").toLowerCase());
