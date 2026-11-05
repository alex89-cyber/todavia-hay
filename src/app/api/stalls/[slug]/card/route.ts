import { z } from "zod";
import { PAYER_COOKIE, phoneCardId } from "@/lib/stall";
import { store } from "@/lib/store";
import { origin } from "@/lib/origin";

// POST /api/stalls/:slug/card {phone}  A customer who pays at the counter looks
// up their stamp card by phone. Remembered in the same cookie as PayPal cards.

const Body = z.object({ phone: z.string().max(30) });

export async function POST(request: Request, ctx: RouteContext<"/api/stalls/[slug]/card">) {
  const { slug } = await ctx.params;
  if (!(await store.get(slug))) return Response.json({ error: "not_found" }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  const card = parsed.success ? phoneCardId(parsed.data.phone) : null;
  if (!card) return Response.json({ error: "bad_phone" }, { status: 400 });

  const stamps = await store.stamps(slug, card);
  const secure = origin(request).startsWith("https:") ? "; Secure" : "";
  return Response.json(
    { stamps },
    {
      headers: {
        "Set-Cookie": `${PAYER_COOKIE}=${encodeURIComponent(card)}; Path=/; Max-Age=${365 * 24 * 3600}; HttpOnly; SameSite=Lax${secure}`,
      },
    },
  );
}
