
import "server-only";

import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { createClient } from "@supabase/supabase-js";

export function rewardDatabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("supabase_not_configured");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createNonce(): string {
  return randomUUID();
}

export function pinFor(
  businessId: string,
  nonce: string,
): string {
  const secret =
    process.env.REWARD_PIN_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "REWARD_PIN_SECRET_missing_or_too_short",
    );
  }

  const digest = createHmac(
    "sha256",
    secret,
  )
    .update(`${businessId}:${nonce}`)
    .digest();

  const number =
    digest.readUInt32BE(0) % 1_000_000;

  return number.toString().padStart(6, "0");
}

export function verifyPin(
  entered: string,
  expected: string,
): boolean {
  if (!/^\d{6}$/.test(entered)) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(entered),
    Buffer.from(expected),
  );
}

export async function findRewardBusiness(
  slug: string,
) {
  const db = rewardDatabase();

  const { data, error } = await db
    .from("businesses")
    .select("id, slug, stamps_per_reward")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data;
}
