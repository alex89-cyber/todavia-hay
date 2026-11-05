import type { AgAiEvent, AgLlmAdapter, AgLlmResponse } from "ag-studio";

// AG Studio ships no LLM adapters: this one sends each turn to our own
// /api/studio/llm, which calls Gemini on the server. The reply comes whole, so
// it is replayed to Studio as one burst of streaming events.

type Turn = {
  model: string;
  text: string;
  toolCalls: { callId: string; name: string; arguments: string }[];
  usage: { inputTokens: number; outputTokens: number };
  truncated: boolean;
};

const uid = () => Math.random().toString(36).slice(2, 10);

/** `setFacts` takes the day's numbers, sent along with every turn. */
export function geminiAdapter(lang: "es" | "en"): AgLlmAdapter & { setFacts(text: string): void } {
  let facts = "";
  return {
    setFacts(text) {
      facts = text;
    },
    executeTurn(request, options) {
      const events: AgAiEvent[] = [];
      const waiting: { wake?: () => void } = {};
      let done = false;

      const complete: Promise<AgLlmResponse> = (async () => {
        const id = `resp_${uid()}`;
        const createdAt = Math.floor(Date.now() / 1000);
        try {
          const res = await fetch("/api/studio/llm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...request, lang, facts }),
            signal: options?.signal,
          });
          if (!res.ok) {
            const { error } = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(error ?? `HTTP ${res.status}`);
          }
          const turn = (await res.json()) as Turn;
          const output: AgLlmResponse["output"] = [];
          if (turn.text) {
            const messageId = `msg_${uid()}`;
            events.push(
              { type: "TEXT_MESSAGE_START", messageId, role: "assistant" },
              { type: "TEXT_MESSAGE_CONTENT", messageId, delta: turn.text },
              { type: "TEXT_MESSAGE_END", messageId },
            );
            output.push({
              id: messageId,
              kind: "output",
              type: "message",
              role: "assistant",
              status: "completed",
              content: [{ type: "text", text: turn.text, annotations: [] }],
            });
          }
          for (const c of turn.toolCalls) {
            events.push(
              { type: "TOOL_CALL_START", toolCallId: c.callId, toolCallName: c.name },
              { type: "TOOL_CALL_ARGS", toolCallId: c.callId, delta: c.arguments },
              { type: "TOOL_CALL_END", toolCallId: c.callId },
            );
            output.push({ id: `fc_${uid()}`, kind: "output", type: "function_call", callId: c.callId, name: c.name, arguments: c.arguments, status: "completed" });
          }
          return {
            id,
            createdAt,
            model: turn.model,
            output,
            status: turn.truncated ? "incomplete" : "completed",
            incompleteDetails: turn.truncated ? { reason: "max_output_tokens" } : undefined,
            usage: turn.usage as AgLlmResponse["usage"],
          };
        } catch (e) {
          const aborted = options?.signal?.aborted;
          const message =
            (e as Error).message === "rate_limited"
              ? lang === "es" ? "Demasiadas preguntas seguidas. Espera unos minutos." : "Too many questions in a row. Wait a few minutes."
              : lang === "es" ? "El asistente no respondió. Inténtalo otra vez." : "The assistant didn't answer. Try again.";
          return {
            id,
            createdAt,
            output: [],
            status: aborted ? "cancelled" : "failed",
            error: aborted ? undefined : { code: "model_failed", message },
          };
        } finally {
          done = true;
          waiting.wake?.();
        }
      })();

      const stream = {
        async *[Symbol.asyncIterator]() {
          let i = 0;
          while (true) {
            if (i < events.length) {
              yield events[i++];
              continue;
            }
            if (done) return;
            await new Promise<void>((r) => (waiting.wake = r));
            waiting.wake = undefined;
          }
        },
      };
      return { stream, complete };
    },
  };
}
