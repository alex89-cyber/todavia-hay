import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { phoneCardId } from "./stall";

// Profiles, who manages which business, and stamp cards that belong to an
// account. Server only: uses the service role.

let client: SupabaseClient | null = null;
export function admin(): SupabaseClient {
  return (client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}

/** Finds an existing account by email (Supabase has no direct lookup). */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const wanted = email.trim().toLowerCase();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === wanted);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

export type Profile = { id: string; firstName: string; lastName: string; phone: string | null };

/** Stamp card id of an account (stamp_cards.payer_id). */
export const accountCard = (userId: string) => `user:${userId}`;

const fail = (what: string, e: { message: string } | null) => {
  if (e) throw new Error(`accounts ${what}: ${e.message}`);
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await admin().from("profiles").select("id, first_name, last_name, phone").eq("id", userId).maybeSingle();
  fail("profile", error);
  return data ? { id: data.id, firstName: data.first_name, lastName: data.last_name, phone: data.phone } : null;
}

export type ProfileResult = "ok" | "phone_taken" | "bad_phone" | "bad_name";

/** Saves name and phone. A new phone brings the stamps given at the counter with it. */
export async function saveProfile(
  userId: string,
  input: { firstName: string; lastName: string; phone: string | null },
): Promise<ProfileResult> {
  const first = input.firstName.trim().slice(0, 60);
  const last = input.lastName.trim().slice(0, 60);
  if (!first || !last) return "bad_name";
  let phone: string | null = null;
  if (input.phone && input.phone.trim()) {
    const card = phoneCardId(input.phone);
    if (!card) return "bad_phone";
    phone = card.slice("tel:".length);
  }
  const { error } = await admin()
    .from("profiles")
    .upsert({ id: userId, first_name: first, last_name: last, phone, updated_at: new Date().toISOString() });
  if (error?.code === "23505") return "phone_taken";
  fail("save profile", error);
  if (phone) {
    const merged = await admin().rpc("merge_stamp_cards", { p_from: `tel:${phone}`, p_to: accountCard(userId) });
    fail("merge cards", merged.error);
  }
  return "ok";
}

/** A phone typed at the counter: the account's card if someone registered it. */
export async function cardForPhone(phoneCard: string): Promise<string> {
  const digits = phoneCard.startsWith("tel:") ? phoneCard.slice(4) : null;
  if (!digits) return phoneCard;
  const { data, error } = await admin().from("profiles").select("id").eq("phone", digits).maybeSingle();
  fail("card for phone", error);
  return data ? accountCard(data.id) : phoneCard;
}

/** Slugs of the businesses this account manages. */
export async function memberships(userId: string): Promise<{ slug: string; name: string }[]> {
  const { data, error } = await admin().from("business_members").select("businesses(slug, name)").eq("user_id", userId);
  fail("memberships", error);
  return (data ?? [])
    .map((r) => r.businesses as unknown as { slug: string; name: string } | null)
    .filter((b): b is { slug: string; name: string } => Boolean(b));
}

export async function isMember(slug: string, userId: string): Promise<boolean> {
  return (await memberships(userId)).some((b) => b.slug === slug);
}

export async function addMember(slug: string, userId: string, role: "owner" | "staff" = "owner") {
  const { data: b, error } = await admin().from("businesses").select("id").eq("slug", slug).maybeSingle();
  fail("business", error);
  if (!b) throw new Error(`no business ${slug}`);
  const r = await admin().from("business_members").upsert({ business_id: b.id, user_id: userId, role });
  fail("add member", r.error);
}

export type AccountCard = { slug: string; name: string; stamps: number };

/** The account's stamps at every business. */
export async function accountCards(userId: string): Promise<AccountCard[]> {
  const { data, error } = await admin()
    .from("stamp_cards")
    .select("stamps, businesses(slug, name)")
    .eq("payer_id", accountCard(userId));
  fail("cards", error);
  return (data ?? []).flatMap((r) => {
    const b = r.businesses as unknown as { slug: string; name: string } | null;
    return b ? [{ slug: b.slug, name: b.name, stamps: r.stamps as number }] : [];
  });
}

export type AccountOrder = {
  id: string;
  slug: string;
  business: string;
  status: string;
  totalCents: number;
  createdAt: string;
  pickupAt: string | null;
  orderNumber: number | null;
};

export async function accountOrders(userId: string, limit = 10): Promise<AccountOrder[]> {
  const { data, error } = await admin()
    .from("reservations")
    .select("id, status, total_cents, created_at, pickup_at, order_number, businesses(slug, name)")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  fail("orders", error);
  return (data ?? []).flatMap((r) => {
    const b = r.businesses as unknown as { slug: string; name: string } | null;
    return b
      ? [
          {
            id: r.id as string,
            slug: b.slug,
            business: b.name,
            status: r.status as string,
            totalCents: r.total_cents as number,
            createdAt: r.created_at as string,
            pickupAt: (r.pickup_at as string | null) ?? null,
            orderNumber: (r.order_number as number | null) ?? null,
          },
        ]
      : [];
  });
}
