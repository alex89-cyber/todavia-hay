import { cookies } from "next/headers";
import { connection } from "next/server";
import { z } from "zod";
import { heldOrders, holdIds } from "@/lib/holds";
import { confirmPickup, loadStall } from "@/lib/reservations";
import { HOLDS_COOKIE } from "@/lib/stall";
import { store } from "@/lib/store";
import { currentAccount } from "@/lib/auth/server";

// The customer's own orders, from the cookie set when PayPal approved them.
// GET  /api/stalls/:slug/holds?lang=es            → { holds }
// POST /api/stalls/:slug/holds { action: "confirm", id }
// POST /api/stalls/:slug/holds { action: "push", id, lang, subscription }

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), id: z.string().min(1).max(80) }),
  z.object({
    action: z.literal("push"),
    id: z.string().min(1).max(80),
    lang: z.enum(["es", "en"]),
    subscription: z.object({
      endpoint: z.string().url().max(2048),
      keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
    }),
  }),
]);

export async function GET(request: Request, ctx: RouteContext<"/api/stalls/[slug]/holds">) {
  await connection();
  const { slug } = await ctx.params;
  const s = await loadStall(slug);
  if (!s) return Response.json({ error: "not_found" }, { status: 404 });
  const lang = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "es";
  const cookie = (await cookies()).get(HOLDS_COOKIE)?.value;
  const me = await currentAccount();
  return Response.json({ holds: heldOrders(s, lang, cookie, me?.id ?? null) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, ctx: RouteContext<"/api/stalls/[slug]/holds">) {
  const { slug } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const a = parsed.data;
  if (!(await store.get(slug))) return Response.json({ error: "not_found" }, { status: 404 });
  // Only the browser that paid for an order, or the account that made it, can act on it.
  if (!holdIds((await cookies()).get(HOLDS_COOKIE)?.value).includes(a.id)) {
    const me = await currentAccount();
    const r = me ? await store.getReservation(slug, a.id) : null;
    if (!me || r?.customerId !== me.id) return Response.json({ error: "not_yours" }, { status: 403 });
  }

  if (a.action === "confirm") {
    const r = await confirmPickup(slug, a.id);
    return Response.json({ ok: r === "ok" || r === "not_needed", result: r }, { status: r === "not_found" ? 409 : 200 });
  }
  await store.savePush(slug, {
    reservationId: a.id,
    endpoint: a.subscription.endpoint,
    p256dh: a.subscription.keys.p256dh,
    auth: a.subscription.keys.auth,
    lang: a.lang,
  });
  return Response.json({ ok: true });
}
