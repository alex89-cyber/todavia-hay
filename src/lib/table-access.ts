import "server-only";

import { admin } from "@/lib/accounts";
import { currentAccount } from "@/lib/auth/server";

// ==========================================
// TODAVÍA HAY
// QUIÉN PUEDE USAR LAS MESAS
// ==========================================
//
// Dueño, encargado y mesero del negocio,
// en los planes Medium y Plus.
// ==========================================

export const TABLE_ROLES = ["owner", "manager", "waiter"] as const;
export type TableRole = (typeof TABLE_ROLES)[number];

/** Atender mesas (abrir, pedir, cobrar, juntar): meseros y encargados. */
export const canServe = (role: TableRole) => role === "waiter" || role === "manager";

/** Crear, editar y desactivar mesas: dueño y encargado. */
export const canConfigure = (role: TableRole) => role === "owner" || role === "manager";

export const plansWithTables = (plan: string | null | undefined) =>
  plan === "medium" || plan === "plus";

export type MemberAccess<R extends string> =
  | {
      ok: true;
      businessId: string;
      businessName: string;
      plan: string;
      userId: string;
      role: R;
    }
  | {
      ok: false;
      reason: "login" | "not_found" | "forbidden" | "plan";
      message: string;
      status: number;
    };

export type TableAccess = MemberAccess<TableRole>;

export async function tableAccess(slug: string): Promise<TableAccess> {
  return memberAccess(
    slug,
    TABLE_ROLES,
    plansWithTables,
    "No tienes permiso para gestionar mesas.",
    "Las mesas están en los planes Medium y Plus.",
  );
}

// ==========================================
// COCINA: dueño, encargado y cocina, plan Plus
// ==========================================

export const KITCHEN_ROLES = ["owner", "manager", "kitchen"] as const;
export type KitchenRole = (typeof KITCHEN_ROLES)[number];

/** Marcar comandas como listas: solo la persona de cocina. */
export const canCook = (role: KitchenRole) => role === "kitchen";

export const planWithKitchen = (plan: string | null | undefined) => plan === "plus";

export async function kitchenAccess(slug: string): Promise<MemberAccess<KitchenRole>> {
  return memberAccess(
    slug,
    KITCHEN_ROLES,
    planWithKitchen,
    "No tienes permiso para ver la cocina.",
    "La cocina está en el plan Plus.",
  );
}

async function memberAccess<R extends string>(
  slug: string,
  roles: readonly R[],
  planOk: (plan: string | null | undefined) => boolean,
  forbidden: string,
  planMessage: string,
): Promise<MemberAccess<R>> {
  const me = await currentAccount();
  if (!me) {
    return { ok: false, reason: "login", message: "Debes iniciar sesión.", status: 401 };
  }

  const db = admin();
  const { data: business, error } = await db
    .from("businesses")
    .select("id, name, plan")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!business) {
    return { ok: false, reason: "not_found", message: "Restaurante no encontrado.", status: 404 };
  }

  const { data: member, error: memberError } = await db
    .from("business_members")
    .select("role")
    .eq("business_id", business.id)
    .eq("user_id", me.id)
    .in("role", [...roles])
    .maybeSingle();
  if (memberError) throw memberError;
  if (!member) {
    return {
      ok: false,
      reason: "forbidden",
      message: forbidden,
      status: 403,
    };
  }

  if (!planOk(business.plan)) {
    return {
      ok: false,
      reason: "plan",
      message: planMessage,
      status: 403,
    };
  }

  return {
    ok: true,
    businessId: business.id as string,
    businessName: business.name as string,
    plan: business.plan as string,
    userId: me.id,
    role: member.role as R,
  };
}

/** ¿El negocio tiene mesas en su plan? (para mostrar o esconder el botón) */
export async function businessHasTables(slug: string): Promise<boolean> {
  const { data, error } = await admin()
    .from("businesses")
    .select("plan")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("plan:", error.message);
    return false;
  }
  return plansWithTables(data?.plan);
}

/** ¿El negocio tiene cocina en su plan? */
export async function businessHasKitchen(slug: string): Promise<boolean> {
  const { data, error } = await admin()
    .from("businesses")
    .select("plan")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("plan:", error.message);
    return false;
  }
  return planWithKitchen(data?.plan);
}
