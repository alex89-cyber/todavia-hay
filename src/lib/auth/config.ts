// Accounts run on Supabase Auth. Without its URL and public key (local demo on
// the memory store) there are no accounts and the panel falls back to OWNER_PIN.

export const AUTH_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const AUTH_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const authEnabled = () => Boolean(AUTH_URL && AUTH_KEY);

/** Only same-site paths, so a link can't send people to another site after signing in. */
export function safeNext(next: string | null | undefined, fallback: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
