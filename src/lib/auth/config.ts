
/**
 * TODAVÍA HAY
 * Configuración de autenticación con Supabase
 *
 * Clientes:
 * - Registro con correo y contraseña
 * - Confirmación de correo
 * - Recuperación de contraseña
 *
 * Negocios:
 * - Acceso mediante cuentas autorizadas
 * - El PIN anterior se conserva temporalmente
 */

export const AUTH_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";

// Compatible con claves anon y publishable.
export const AUTH_KEY =
  (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();

// Comprueba si Supabase Auth está configurado.
export function authEnabled(): boolean {
  return Boolean(AUTH_URL && AUTH_KEY);
}

// Evita redirecciones a sitios externos
// después de iniciar sesión.
export function safeNext(
  next: string | null | undefined,
  fallback: string,
): string {
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
