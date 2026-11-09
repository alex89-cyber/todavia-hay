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

export type TableAccess =
  | {
      ok: true;
      businessId: string;
      businessName: string;
      userId: string;
      role: TableRole;
    }
  | {
      ok: false;
      reason: "login" | "not_found" | "forbidden" | "plan";
      message: string;
      status: number;
    };

export async function tableAccess(slug: string): Promise<TableAccess> {
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
    .in("role", [...TABLE_ROLES])
    .maybeSingle();
  if (memberError) throw memberError;
  if (!member) {
    return {
      ok: false,
      reason: "forbidden",
      message: "No tienes permiso para gestionar mesas.",
      status: 403,
    };
  }

  if (!plansWithTables(business.plan)) {
    return {
      ok: false,
      reason: "plan",
      message: "Las mesas están en los planes Medium y Plus.",
      status: 403,
    };
  }

  return {
    ok: true,
    businessId: business.id as string,
    businessName: business.name as string,
    userId: me.id,
    role: member.role as TableRole,
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
