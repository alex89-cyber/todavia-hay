
import "server-only";

import { admin } from "@/lib/accounts";
import { currentAccount } from "@/lib/auth/server";

// ==========================================
// TODAVÍA HAY
// VERIFICACIÓN DE SUPERADMINISTRADORES
// ==========================================

export async function platformAdmin() {
  // Identificar al usuario desde su sesión
  // autenticada de Supabase.
  const account = await currentAccount();

  if (!account) {
    return null;
  }

  // Comprobar que su ID esté autorizado
  // en la tabla privada platform_admins.
  const { data, error } = await admin()
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", account.id)
    .maybeSingle();

  if (error) {
    console.error(
      "Error verificando superadministrador:",
      error.message,
    );

    throw new Error(
      "No se pudieron comprobar los permisos de administración.",
    );
  }

  if (!data) {
    return null;
  }

  return account;
}
