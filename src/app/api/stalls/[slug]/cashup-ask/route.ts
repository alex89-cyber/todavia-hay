import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { connection } from "next/server";
import { z } from "zod";

import { agentAvailable } from "@/lib/agent";
import { isOwner, unauthorized } from "@/lib/owner-auth";

// POST /api/stalls/:slug/cashup-ask
// "Pregúntale a tu corte": el dueño escribe una pregunta y Gemini contesta
// con los números del corte que ya calculó la página (facts). Una sola
// llamada, sin herramientas: la respuesta es texto corto.

const Body = z.object({
  question: z.string().trim().min(2).max(300),
  facts: z.string().max(8000),
  lang: z.enum(["es", "en"]).default("es"),
});

const google = createGoogleGenerativeAI({ baseURL: process.env.GOOGLE_GENERATIVE_AI_BASE_URL || undefined });
const MODELS = [process.env.STUDIO_GEMINI_MODEL || "gemini-flash-lite-latest", "gemini-flash-latest"];

// Un tope pequeño para que no se use como Gemini gratis.
const WINDOW_MS = 10 * 60_000;
const MAX_ASKS = 30;
const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_ASKS;
}

export async function POST(request: Request, ctx: RouteContext<"/api/stalls/[slug]/cashup-ask">) {
  await connection();
  const { slug } = await ctx.params;
  if (!(await isOwner(slug))) return unauthorized();
  if (!agentAvailable()) return Response.json({ error: "agent_off" }, { status: 503 });
  if (limited(slug)) return Response.json({ error: "rate_limited" }, { status: 429 });

  const input = Body.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const { question, facts, lang } = input.data;

  const system = [
    "You help the owner of a small Mexican food stall understand their cash-up (corte de caja).",
    "Answer ONLY from the numbers below. If they don't answer the question, say so briefly and say what data would be needed.",
    "Be short and concrete: 1 to 4 sentences, amounts like $1,250. No markdown tables, no headings.",
    lang === "es" ? "Answer in Mexican Spanish." : "Answer in English.",
    "",
    "## Cash-up numbers (exact)",
    facts,
  ].join("\n");

  for (const model of MODELS) {
    try {
      const { text } = await generateText({
        model: google(model),
        system,
        prompt: question,
        maxOutputTokens: 400,
        abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]),
      });
      if (text.trim()) return Response.json({ answer: text.trim() }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      console.error(`cashup-ask ${model}:`, (e as Error)?.message);
    }
  }
  return Response.json({ error: "model_failed" }, { status: 502 });
}
