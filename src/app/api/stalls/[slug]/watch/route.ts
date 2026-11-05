import { z } from "zod";
import { pushConfigured } from "@/lib/push";
import { store } from "@/lib/store";

// POST /api/stalls/:slug/watch  "Avísame cuando haya": saves the browser's push
// subscription until the stall opens (dishId null) or that dish comes back.

const Body = z.object({
  dishId: z.string().min(1).max(100).nullable(),
  lang: z.enum(["es", "en"]),
  subscription: z.object({
    endpoint: z.url({ protocol: /^https$/ }).max(1000),
    keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  }),
});

export async function POST(request: Request, ctx: RouteContext<"/api/stalls/[slug]/watch">) {
  if (!pushConfigured()) return Response.json({ error: "push_unavailable" }, { status: 503 });
  const { slug } = await ctx.params;
  const s = await store.get(slug);
  if (!s) return Response.json({ error: "not_found" }, { status: 404 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const { dishId, lang, subscription } = parsed.data;
  if (dishId && !s.dishes.some((d) => d.id === dishId)) return Response.json({ error: "not_found" }, { status: 404 });

  await store.addWatch(slug, { dishId, lang, endpoint: subscription.endpoint, ...subscription.keys });
  return Response.json({ ok: true });
}
