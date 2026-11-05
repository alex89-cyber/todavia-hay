import "server-only";
import { memoryStore } from "./memory";
import { supabaseStore } from "./supabase";
import type { StallStore } from "./types";

// Supabase when its keys are set (Render, .env.local), otherwise the in-memory demo.
export const usingSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export const store: StallStore = usingSupabase ? supabaseStore : memoryStore;
