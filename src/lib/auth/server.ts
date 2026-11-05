import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { AUTH_KEY, AUTH_URL, authEnabled } from "./config";
import { getProfile, type Profile } from "../accounts";

/** Supabase client acting as the signed-in person (their session cookies). */
export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(AUTH_URL, AUTH_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // Server components can't set cookies; the proxy refreshes the session.
        }
      },
    },
  });
}

export type Account = Profile & { email: string; verified: boolean };

/** The signed-in person, or null. Checked against Supabase, not just the cookie. */
export const currentAccount = cache(async (): Promise<Account | null> => {
  if (!authEnabled()) return null;
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  const u = data.user;
  const profile = await getProfile(u.id);
  return {
    ...(profile ?? { id: u.id, firstName: "", lastName: "", phone: null }),
    email: u.email ?? "",
    verified: Boolean(u.email_confirmed_at),
  };
});
