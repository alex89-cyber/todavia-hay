
import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import { cookies } from "next/headers";

import { authEnabled } from "./auth/config";
import { currentAccount } from "./auth/server";
import { admin } from "./accounts";

// ==========================================
// TODAVÍA HAY
// AUTORIZACIÓN DEL PROPIETARIO
// ==========================================
//
// Cuando Supabase Auth está activo,
// solo los usuarios con rol "owner"
// pueden administrar completamente
// el negocio.
//
// El PIN antiguo se conserva únicamente
// para el modo local sin Supabase Auth.
//
// ==========================================

export const OWNER_COOKIE = "th_owner";

const MAX_AGE_S = 30 * 24 * 3600;

const pin = () =>
  process.env.OWNER_PIN?.trim() ?? "";

export const ownerPinRequired = () =>
  pin().length > 0;

// ==========================================
// PIN ANTERIOR
// ==========================================

const token = () =>
  createHmac("sha256", pin())
    .update("todavia-hay:owner:v1")
    .digest("hex");

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);

  return (
    x.length === y.length &&
    timingSafeEqual(x, y)
  );
}

export function pinMatches(candidate: string) {
  return (
    ownerPinRequired() &&
    same(candidate.trim(), pin())
  );
}

// ==========================================
// COMPROBAR SI ES PROPIETARIO
// ==========================================

export async function isOwner(
  slug?: string,
): Promise<boolean> {
  if (authEnabled()) {
    const me = await currentAccount();

    if (!me) {
      return false;
    }

    try {
      const db = admin();

      // Sin negocio específico:
      // comprobar que sea dueño de
      // al menos un negocio.
      if (!slug) {
        const { data, error } = await db
          .from("business_members")
          .select("business_id")
          .eq("user_id", me.id)
          .eq("role", "owner")
          .limit(1);

        if (error) {
          console.error(
            "owner auth:",
            error.message,
          );
          return false;
        }

        return (data?.length ?? 0) > 0;
      }

      // Buscar el negocio solicitado.
      const { data: business, error: businessError } =
        await db
          .from("businesses")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

      if (businessError || !business) {
        return false;
      }

      // Comprobar la relación exacta
      // usuario + negocio + rol.
      const { data: member, error: memberError } =
        await db
          .from("business_members")
          .select("role")
          .eq("business_id", business.id)
          .eq("user_id", me.id)
          .eq("role", "owner")
          .maybeSingle();

      if (memberError) {
        console.error(
          "owner membership:",
          memberError.message,
        );
        return false;
      }

      return Boolean(member);
    } catch (error) {
      console.error("owner auth failed:", error);
      return false;
    }
  }

  // Compatibilidad temporal con
  // el sistema antiguo basado en PIN.
  // Sin cuentas ni PIN: abierto solo fuera
  // de producción (local, pruebas).
  if (!ownerPinRequired()) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "Owner panel closed: set NEXT_PUBLIC_SUPABASE_ANON_KEY (accounts) or OWNER_PIN.",
      );
      return false;
    }
    return true;
  }

  const cookie = (await cookies())
    .get(OWNER_COOKIE)?.value;

  return Boolean(
    cookie && same(cookie, token()),
  );
}

// ==========================================
// SESIÓN ANTIGUA POR PIN
// ==========================================

export async function signIn() {
  (await cookies()).set(
    OWNER_COOKIE,
    token(),
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE_S,
    },
  );
}

export async function signOut() {
  (await cookies()).delete(OWNER_COOKIE);
}

// ==========================================
// ACCESO NO AUTORIZADO
// ==========================================

export const unauthorized = () =>
  Response.json(
    { error: "owner_only" },
    { status: 403 },
  );

// ==========================================
// LIMITAR INTENTOS DEL PIN ANTIGUO
// ==========================================

const WINDOW_MS = 60_000;
const MAX_TRIES = 5;

const tries = new Map<string, number[]>();

export function tooManyTries(
  ip: string,
): boolean {
  const now = Date.now();

  const recent = (tries.get(ip) ?? [])
    .filter(
      (time) => now - time < WINDOW_MS,
    );

  tries.set(ip, recent);

  return recent.length >= MAX_TRIES;
}

export function recordFailure(
  ip: string,
) {
  tries.set(ip, [
    ...(tries.get(ip) ?? []),
    Date.now(),
  ]);
}
