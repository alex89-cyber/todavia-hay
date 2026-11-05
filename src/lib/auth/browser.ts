"use client";

import { createBrowserClient } from "@supabase/ssr";
import { AUTH_KEY, AUTH_URL } from "./config";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function supabaseBrowser() {
  return (client ??= createBrowserClient(AUTH_URL, AUTH_KEY));
}
