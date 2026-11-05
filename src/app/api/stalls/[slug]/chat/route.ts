import { z } from "zod";
import { agentAvailable, chat } from "@/lib/agent";
import { origin } from "@/lib/origin";
import { loadStall } from "@/lib/reservations";

// POST /api/stalls/:slug/chat  { lang, messages }  → { reply, reservation? }
// The client keeps the conversation; only the last turns are sent.

const Body = z.object({
  lang: z.enum(["es", "en"]),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(600) }))
    .min(1)
    .max(30),
});

// Each device gets a fair share of the Gemini quota.
const WINDOW_MS = 10 * 60_000;
const MAX_MESSAGES = 20;
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_MESSAGES;
}

export async function POST(request: Request, ctx: RouteContext<"/api/stalls/[slug]/chat">) {
  const { slug } = await ctx.params;
  if (!agentAvailable()) return Response.json({ error: "agent_unavailable" }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const s = await loadStall(slug);
  if (!s) return Response.json({ error: "not_found" }, { status: 404 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip))
    return Response.json({
      reply:
        parsed.data.lang === "es"
          ? "Ya me escribiste muchos mensajes seguidos. Espera unos minutos y lo seguimos, o pide directo en el puesto."
          : "That's a lot of messages in a row. Wait a few minutes and we'll continue, or order at the stall.",
    });

  // The last turns carry the order and the name; older ones only cost quota.
  const messages = parsed.data.messages.slice(-8);
  if (messages[messages.length - 1].role !== "user") return Response.json({ error: "bad_request" }, { status: 400 });

  try {
    const out = await chat(s, messages, { lang: parsed.data.lang, origin: origin(request) });
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("agent failed", e instanceof Error ? e.message : e, (e as { responseBody?: string })?.responseBody?.slice(0, 500) ?? "");
    return Response.json({ error: "agent_failed" }, { status: 502 });
  }
}
