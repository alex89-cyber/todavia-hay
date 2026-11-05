"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/dictionaries";
import type { AgentReservation, ChatMessage } from "@/lib/agent";
import { clock, fill, money } from "@/lib/format";

type Turn = ChatMessage & { reservation?: AgentReservation; error?: boolean };

// The "¿todavía hay?" chat. The conversation lives here; each send posts the
// last turns to the agent, which answers from the live menu and can reserve.
export function AgentChat({
  slug,
  lang,
  currency,
  timezone,
  isOpen,
  t,
}: {
  slug: string;
  lang: "es" | "en";
  currency: string;
  timezone: string;
  isOpen: boolean;
  t: Dictionary;
}) {
  const p = t.public;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (turns.length) end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, busy]);

  async function send(content: string) {
    const msg = content.trim();
    if (!msg || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: msg }];
    setTurns(next);
    setText("");
    setBusy(true);
    try {
      const res = await fetch(`/api/stalls/${slug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          lang,
          messages: next.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.reply) {
        const reply = json.error === "agent_unavailable" ? p.agentOff : p.agentError;
        setTurns([...next, { role: "assistant", content: reply, error: true }]);
      } else {
        setTurns([...next, { role: "assistant", content: json.reply, reservation: json.reservation }]);
      }
    } catch {
      setTurns([...next, { role: "assistant", content: p.agentError, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-bold">{p.askTitle}</h2>
        <p className="text-sm text-muted">{p.askHint}</p>
      </div>

      {turns.length > 0 && (
        <ol className="flex max-h-96 flex-col gap-2 overflow-y-auto" aria-live="polite">
          {turns.map((m, i) => (
            <li key={i} className={`flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
              <p
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
                  m.role === "user"
                    ? "rounded-br-sm bg-brand text-white"
                    : m.error
                      ? "rounded-bl-sm bg-bad-soft text-bad"
                      : "rounded-bl-sm bg-background"
                }`}
              >
                {m.content}
              </p>
              {m.reservation && (
                <div className="w-full max-w-[85%] rounded-2xl border border-line p-3">
                  <p className="text-sm">
                    {fill(p.reservedSummary, {
                      items: m.reservation.lines.map((l) => `${l.qty} × ${l.name}`).join(", "),
                      total: money(m.reservation.totalCents, currency, lang),
                      time: clock(m.reservation.pickupBy, timezone, lang),
                    })}
                  </p>
                  <a
                    href={m.reservation.approveUrl}
                    className="mt-2 block rounded-full bg-[#ffc439] py-3 text-center font-bold text-[#003087] active:scale-[0.98]"
                  >
                    {p.payWithPayPal}
                  </a>
                </div>
              )}
            </li>
          ))}
          {busy && <li className="text-sm text-muted">{p.thinking}</li>}
          <div ref={end} />
        </ol>
      )}

      {turns.length === 0 && isOpen && (
        <div className="flex flex-wrap gap-2">
          {p.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-line px-3 py-1.5 text-sm active:scale-95"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={p.askPlaceholder}
          maxLength={500}
          className="min-w-0 flex-1 rounded-full border border-line bg-background px-4 py-3"
          aria-label={p.askTitle}
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-full bg-brand px-5 font-semibold text-white active:scale-95 disabled:opacity-50"
        >
          {p.send}
        </button>
      </form>
    </section>
  );
}
