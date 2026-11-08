
/**
 * TODAVÍA HAY
 *
 * Configuración de autenticación.
 *
 * Supabase puede utilizarse como base de datos
 * sin obligar a iniciar sesión con correo.
 *
 * El acceso con cuentas se configura mediante
 * AUTH_ENABLED.
 */

export const AUTH_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const AUTH_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Determina si las cuentas de Supabase
 * están habilitadas.
 *
 * true = acceso mediante cuentas
 * false = sistema alternativo de PIN
 */
export const authEnabled = () =>
  process.env.AUTH_ENABLED === "true" &&
  Boolean(AUTH_URL && AUTH_KEY);

/**
 * Evita redirecciones a sitios externos
 * después de iniciar sesión.
 */
export function safeNext(
  next: string | null | undefined,
  fallback: string,
) {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  ) {
    return fallback;
  }

  return next;
}
