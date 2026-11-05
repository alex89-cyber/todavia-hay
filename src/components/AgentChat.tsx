"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/dictionaries";
import type { AgentReservation, ChatMessage, PickupChoices } from "@/lib/agent";
import { clock, fill, money } from "@/lib/format";

type Turn = ChatMessage & {
  reservation?: AgentReservation;
  pickupChoices?: PickupChoices;
  needsLogin?: boolean;
  error?: boolean;
  /** Shown only here, never sent to the agent. */
  local?: boolean;
};

// The chat is kept while the customer goes to sign in, and picked up on return.
const saved = (slug: string) => `th_chat:${slug}`;

/** "15:30" → "3:30 p. m." for the button label. */
function label(hhmm: string, lang: "es" | "en") {
  const [h, m] = hhmm.split(":").map(Number);
  return new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, 0, 1, h, m)),
  );
}

const FIRST_TIMES = 8;

// The "¿todavía hay?" chat. The conversation lives here; each send posts the
// last turns to the agent, which answers from the live menu and can reserve.
export function AgentChat({
  slug,
  lang,
  currency,
  timezone,
  isOpen,
  signedIn = false,
  t,
}: {
  slug: string;
  lang: "es" | "en";
  currency: string;
  timezone: string;
  isOpen: boolean;
  signedIn?: boolean;
  t: Dictionary;
}) {
  const p = t.public;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const [allTimes, setAllTimes] = useState(false);

  // Back from signing in: restore the conversation so they can finish reserving.
  useEffect(() => {
    let back: Turn[] = [];
    try {
      back = JSON.parse(sessionStorage.getItem(saved(slug)) ?? "[]");
      sessionStorage.removeItem(saved(slug));
    } catch {}
    if (!Array.isArray(back) || !back.length) return;
    const restored = back.map(({ needsLogin, ...m }) => (void needsLogin, m));
    if (signedIn) restored.push({ role: "assistant", content: p.chatSignedIn, local: true });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after mount
    setTurns(restored);
    requestAnimationFrame(() => document.getElementById("chat")?.scrollIntoView({ block: "start" }));
  }, [slug, signedIn, p.chatSignedIn]);

  function goSignIn() {
    try {
      sessionStorage.setItem(saved(slug), JSON.stringify(turns.filter((m) => !m.error)));
    } catch {}
    const here = `${window.location.pathname}#chat`;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load so the session cookie is read
    window.location.href = `/${lang}/login?next=${encodeURIComponent(here)}`;
  }

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
          messages: next.filter((m) => !m.error && !m.local).map(({ role, content }) => ({ role, content })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.reply) {
        const reply = json.error === "agent_unavailable" ? p.agentOff : p.agentError;
        setTurns([...next, { role: "assistant", content: reply, error: true }]);
      } else {
        setTurns([
          ...next,
          {
            role: "assistant",
            content: json.reply,
            reservation: json.reservation,
            pickupChoices: json.pickupChoices,
            needsLogin: json.needsLogin,
          },
        ]);
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
                    {fill(p.reservedSummaryAt, {
                      items: m.reservation.lines.map((l) => `${l.qty} × ${l.name}`).join(", "),
                      total: money(m.reservation.totalCents, currency, lang),
                      when: fill(m.reservation.pickupMode === "asap" ? p.whenAsap : p.whenAt, {
                        time: m.reservation.pickupAt ? clock(m.reservation.pickupAt, timezone, lang) : "",
                      }),
                    })}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-muted">{p.chargeWarning}</p>
                  <a
                    href={m.reservation.approveUrl}
                    className="mt-2 block rounded-full bg-[#ffc439] py-3 text-center font-bold text-[#003087] active:scale-[0.98]"
                  >
                    {p.payWithPayPal}
                  </a>
                </div>
              )}
              {m.needsLogin && !signedIn && (
                <div className="w-full max-w-[85%] rounded-2xl border border-line p-3">
                  <p className="text-sm">{p.chatLoginWhy}</p>
                  <button
                    onClick={goSignIn}
                    className="mt-2 block w-full rounded-full bg-brand py-3 text-center font-bold text-white active:scale-[0.98]"
                  >
                    {p.chatLogin}
                  </button>
                </div>
              )}
              {m.pickupChoices && i === turns.length - 1 && !busy && (
                <div className="flex w-full max-w-[85%] flex-wrap gap-2">
                  {m.pickupChoices.asap.available && (
                    <button
                      onClick={() => send(p.pickupAsapMsg)}
                      className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white active:scale-95"
                    >
                      {fill(p.pickupAsapButton, { n: m.pickupChoices.asap.minutes })}
                    </button>
                  )}
                  {(allTimes ? m.pickupChoices.times : m.pickupChoices.times.slice(0, FIRST_TIMES)).map((time) => (
                    <button
                      key={time}
                      onClick={() => send(fill(p.pickupTimeMsg, { time: label(time, lang) }) + ` (${time})`)}
                      className="rounded-full border border-line px-3 py-1.5 text-sm active:scale-95"
                    >
                      {label(time, lang)}
                    </button>
                  ))}
                  {!allTimes && m.pickupChoices.times.length > FIRST_TIMES && (
                    <button onClick={() => setAllTimes(true)} className="px-2 py-1.5 text-sm text-muted underline">
                      {p.pickupMore}
                    </button>
                  )}
                  {!m.pickupChoices.asap.available && !m.pickupChoices.times.length && (
                    <p className="text-sm text-muted">
                      {p.pickupNone}
                      {m.pickupChoices.opensAt &&
                        " " +
                          fill(p.pickupOpensAt, {
                            when: new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", {
                              weekday: "long",
                              hour: "numeric",
                              minute: "2-digit",
                              timeZone: timezone,
                            }).format(new Date(m.pickupChoices.opensAt)),
                          })}
                    </p>
                  )}
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
