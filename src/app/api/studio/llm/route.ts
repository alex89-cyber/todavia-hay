import { connection } from "next/server";
import { agentAvailable } from "@/lib/agent";
import { isOwner, unauthorized } from "@/lib/owner-auth";
import { studioTurn, type StudioRequest } from "@/lib/studio-llm";

// POST /api/studio/llm  one LLM turn for the AG Studio agents on the cash-up
// page. The browser sends Studio's request (conversation, instructions, tool
// schemas) and gets back the text and tool calls; Studio runs the tools itself.

const MAX_BYTES = 1_500_000;
// A small guard so the page can't be used as a free Gemini proxy.
const WINDOW_MS = 10 * 60_000;
const MAX_TURNS = 80;
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_TURNS;
}

export async function POST(request: Request) {
  await connection();
  if (!(await isOwner())) return unauthorized();
  if (!agentAvailable()) return Response.json({ error: "agent_off" }, { status: 503 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });

  const raw = await request.text();
  if (raw.length > MAX_BYTES) return Response.json({ error: "too_large" }, { status: 413 });
  let body: StudioRequest;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  if (!Array.isArray(body?.input)) return Response.json({ error: "bad_request" }, { status: 400 });
  body.lang = body.lang === "en" ? "en" : "es";

  try {
    return Response.json(await studioTurn(body, request.signal), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const o = (e ?? {}) as { statusCode?: number; message?: string };
    return Response.json({ error: "model_failed", status: o.statusCode ?? null }, { status: 502 });
  }
}
