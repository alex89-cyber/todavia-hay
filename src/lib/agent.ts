import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, isStepCount, tool } from "ai";
import { z } from "zod";
import { menuAvailability } from "./inventory";
import { startReservation } from "./reservations";
import { replyLanguage } from "./language";
import { offlineReply } from "./offline-reply";
import type { StallState } from "./stall";
import { hhmm, pickupOptions, pickupSettings, resolvePickup, type PickupOptions } from "./pickup";

// The "¿Todavía hay?" agent on the public page. It answers from the live menu
// and, once the customer confirms, reserves through PayPal: the money is held
// now and only charged when the owner hands the order over.

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AgentReservation = {
  id: string;
  approveUrl: string;
  totalCents: number;
  pickupBy: string;
  pickupMode: "asap" | "scheduled";
  pickupAt: string | null;
  lines: { name: string; qty: number }[];
};

/** Buttons under the reply: "Para ahorita" and today's free times. */
export type PickupChoices = {
  asap: { available: boolean; minutes: number };
  /** "15:30", in the stall's time zone. */
  times: string[];
  opensAt: string | null;
};

export type AgentReply = {
  reply: string;
  reservation?: AgentReservation;
  pickupChoices?: PickupChoices;
  /** Reserving needs an account: show "Inicia sesión para apartar". */
  needsLogin?: boolean;
  offline?: boolean;
};

/** Who is chatting, when accounts are on. */
export type ChatCustomer = { id: string; firstName: string; lastName: string };
export type ChatAccounts = { required: boolean; customer: ChatCustomer | null };

function accountRule(a: ChatAccounts) {
  if (!a.required) return "";
  if (!a.customer)
    return `- The customer is NOT signed in, and reserving needs a free account. Answer questions normally. As soon as they want to reserve, call ask_to_sign_in (it shows them a sign-in button) and tell them that after signing in they come back to this same chat to finish. Don't ask for their name.\n`;
  const { firstName, lastName } = a.customer;
  return lastName
    ? `- The customer is signed in as ${firstName} ${lastName}. The reservation goes under that name: never ask for their name.\n`
    : `- The customer is signed in as ${firstName} but their account has no last name. Ask for their last name before reserving.\n`;
}

function choicesFrom(s: StallState, o: PickupOptions): PickupChoices {
  return {
    asap: { available: o.asap.available, minutes: pickupSettings(s).asapMinutes },
    times: o.slots.map((d) => hhmm(d, s.timezone)),
    opensAt: o.opensAt?.toISOString() ?? null,
  };
}

function pickupRules(s: StallState, lang: "es" | "en") {
  const p = pickupSettings(s);
  const o = pickupOptions(s);
  const asap = o.asap.available
    ? `available, ready in about ${p.asapMinutes} minutes`
    : o.asap.reason === "closing"
      ? "NOT available: it would be ready after closing time"
      : "NOT available: the stall is closed";
  const times = o.slots.length
    ? o.slots.map((d) => clock(d, s, lang)).join(", ")
    : "none left today";
  const opens = o.opensAt ? ` The stall opens next at ${clock(o.opensAt, s, lang)} (${o.opensAt.toISOString().slice(0, 10)}).` : "";
  return `Pickup (ask before summarizing the order):
- Ask "¿Para ahorita o para una hora?" / "For right now or for a set time?" and call offer_pickup_times in the same turn so the customer gets buttons.
- "Para ahorita": ${asap}.
- "Para una hora": today only, no other day. Free times right now: ${times}. Never accept a time outside this list; if they ask for one, offer the nearest free ones.${opens}
- If they confirm more than an hour ahead, tell them they will get a notice to confirm they are still coming before the stall starts cooking; if they don't confirm, it is cancelled at no cost.
- Wait time: the stall holds the order ${p.toleranceMinutes} minutes after the pickup time. If nobody picks it up, it IS charged. Always say this in the summary before they confirm.`;
}

// GOOGLE_GENERATIVE_AI_BASE_URL only points local tests at a fake Gemini.
const google = createGoogleGenerativeAI({ baseURL: process.env.GOOGLE_GENERATIVE_AI_BASE_URL || undefined });
// Flash-Lite answers in under a second with no thinking; the bigger Flash was
// slow and often "experiencing high demand" on the free tier. If one model
// fails, the next one is tried.
const MODELS = [process.env.GEMINI_MODEL || "gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-flash-latest"];

export const agentAvailable = () => Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

function clock(iso: string | Date, s: StallState, lang: "es" | "en") {
  return new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: s.timezone,
  }).format(new Date(iso));
}

function instructions(s: StallState, lang: "es" | "en", accounts: ChatAccounts) {
  const left = new Map(menuAvailability(s.dishes, s.ingredients).map((a) => [a.dishId, a.portions]));
  const menu = s.dishes
    .map((d) => {
      const n = s.isOpen ? (left.get(d.id) ?? 0) : 0;
      return `- id=${d.id} | ${d.nameEs} / ${d.nameEn} | $${(d.priceCents / 100).toFixed(2)} ${s.currency} | ${
        n > 0 ? `about ${n} left` : "SOLD OUT"
      }`;
    })
    .join("\n");

  return `You are the order assistant of "${s.name}", a street food stall. Customers write to ask "¿todavía hay?" (is there still...?) and to reserve food for pickup.

Live state right now (${clock(new Date(), s, lang)} local time):
- The stall is ${s.isOpen ? "OPEN" : "CLOSED"}.
- Menu:
${menu}

Rules:
- Answer only from the live state above. Never invent dishes, prices or availability. Portion counts are estimates: say "unos 12" / "about 12", never promise an exact number.
- If the stall is closed or a dish is sold out, say so plainly and suggest what is still available. They can also tap "Avísame" on the page to get a phone alert when it opens or the dish comes back.
- Reserving needs from the customer: the order (dishes and quantities, max 10 per dish) and their first name and one last name, which the stall asks for at pickup if they lose their code. If they have not written both names in this chat, ask for what is missing before summarizing; never guess or invent a name. Before reserving, summarize the order with its total and the pickup time, and ask them to confirm. Only call reserve_order after they clearly say yes.
- How payment works, if they ask or when you summarize: PayPal holds the money now and the stall charges it at pickup. If they don't come, it is charged anyway (unless an order scheduled hours ahead was never confirmed, which is cancelled for free). They can pay with a PayPal account or a card.
${pickupRules(s, lang)}
- After reserve_order succeeds, tell them to tap the PayPal button that appears below your message to finish, and that once they pay they get a 4-digit pickup code to say at the counter. Never write links or URLs.
- If reserve_order fails, explain why in one sentence and offer an alternative.
- Language: reply in ${lang === "es" ? "Mexican Spanish" : "English"}, because that is the language of the customer's last message. If they switch language, switch with them. Use dish names in that language. Be warm and brief: one to three short sentences, no markdown, at most one emoji.
${accountRule(accounts)}${stampRule(s)}- If asked about anything unrelated to the stall, steer back to the menu politely.`;
}

function stampRule(s: StallState) {
  const reward = s.dishes.find((d) => d.id === s.loyalty.rewardDishId);
  if (!reward) return "";
  return `- Stamp card: every order reserved and paid with PayPal, or paid at the stall giving a phone number, earns a stamp; ${s.loyalty.stampsPerReward} stamps earn a free ${reward.nameEs} / ${reward.nameEn}. Mention it only if they ask about rewards or it fits naturally.\n`;
}

/** First name and last name must come from what the customer wrote, so the model can't make them up. */
function nameGiven(name: string, messages: ChatMessage[]) {
  const plain = (x: string) => x.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const words = (x: string) => plain(x).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
  const said = new Set(messages.filter((m) => m.role === "user").flatMap((m) => words(m.content)));
  const given = words(name);
  return given.length >= 2 && given.every((w) => said.has(w));
}

const REST_MS = 60_000;
let restUntil = 0;

export async function chat(
  s: StallState,
  messages: ChatMessage[],
  page: { lang: "es" | "en"; origin: string },
  accounts: ChatAccounts = { required: false, customer: null },
): Promise<AgentReply> {
  // Answer in the language the customer writes in, whatever page they are on.
  const ctx = { ...page, lang: replyLanguage(messages, page.lang) };
  const ids = s.dishes.map((d) => d.id) as [string, ...string[]];
  let reservation: AgentReservation | undefined;
  let pickupChoices: PickupChoices | undefined;
  let needsLogin = false;
  const signedIn = accounts.customer;

  const askToSignIn = tool({
    description: "Shows the customer a button to sign in or create a free account, needed to reserve. Call it when a signed-out customer wants to reserve.",
    inputSchema: z.object({}),
    execute: async () => {
      needsLogin = true;
      return { shown: true };
    },
  });

  const offerPickupTimes = tool({
    description: "Shows the customer buttons to pick up right now or at a free time today. Call it whenever you ask when they want to pick up.",
    inputSchema: z.object({}),
    execute: async () => {
      pickupChoices = choicesFrom(s, pickupOptions(s));
      return {
        asap: pickupChoices.asap.available ? `available, about ${pickupChoices.asap.minutes} min` : "not available",
        times: pickupChoices.times.length ? pickupChoices.times : "none left today",
      };
    },
  });

  const reserveOrder = tool({
    description:
      "Reserve dishes for pickup. Takes the stock now and creates a PayPal payment the customer approves with a button. Call only after the customer confirmed the order.",
    inputSchema: z.object({
      customerName: z
        .string()
        .max(60)
        .optional()
        .describe("Customer's first name and last name, as they wrote them. Leave out if they are signed in."),
      items: z
        .array(z.object({ dishId: z.enum(ids), qty: z.number().int().min(1).max(10) }))
        .min(1)
        .max(8),
      pickupMode: z.enum(["asap", "scheduled"]).describe('"asap" for right now, "scheduled" for a time today'),
      pickupTime: z
        .string()
        .regex(/^([01]?\d|2[0-3]):[0-5]\d$/)
        .optional()
        .describe('24-hour local time like "15:30", required when scheduled'),
    }),
    execute: async ({ customerName, items, pickupMode, pickupTime }) => {
      if (reservation) return { ok: false, error: "A reservation was already created in this message." };
      // Signed in: the account's name. Otherwise both names must come from the chat.
      let name = customerName?.trim() ?? "";
      if (signedIn?.lastName) name = `${signedIn.firstName} ${signedIn.lastName}`;
      else if (signedIn && name && !name.toLowerCase().startsWith(signedIn.firstName.toLowerCase())) name = `${signedIn.firstName} ${name}`;
      if (!signedIn?.lastName && !nameGiven(name, messages))
        return { ok: false, error: "The customer has not told you their first name and last name. Ask for what is missing, then summarize and confirm again." };
      if (pickupMode === "scheduled" && !pickupTime)
        return { ok: false, error: "Ask the customer what time today they want to pick it up." };
      const picked = resolvePickup(s, pickupMode === "asap" ? { mode: "asap" } : { mode: "scheduled", time: pickupTime! });
      if (!picked.ok) {
        pickupChoices = choicesFrom(s, picked.options);
        const why = {
          closed: "The stall is closed now.",
          closing: "It would be ready after closing time.",
          bad_time: "That is not a valid time.",
          too_soon: "That time is too soon for the stall to prepare it.",
          outside_hours: "That time is outside today's opening hours.",
          full: "That time is already full.",
        }[picked.reason];
        return { ok: false, error: `${why} Offer the free times: ${pickupChoices.times.join(", ") || "none today"}.` };
      }
      const res = await startReservation(s, {
        customerName: name,
        customerId: signedIn?.id ?? null,
        lines: items.map((i) => ({ dishId: i.dishId, qty: i.qty })),
        origin: ctx.origin,
        lang: ctx.lang,
        pickup: picked.pickup,
      });
      if (!res.ok) {
        const why = {
          closed: "The stall is closed.",
          short: "Not enough left for that order.",
          payment: "PayPal is not responding right now.",
          error: "Something failed on our side; ask them to try again in a moment.",
        }[res.reason];
        return { ok: false, error: why };
      }
      const dishName = new Map(s.dishes.map((d) => [d.id, ctx.lang === "es" ? d.nameEs : d.nameEn]));
      reservation = {
        id: res.reservation.id,
        approveUrl: res.approveUrl,
        totalCents: res.reservation.totalCents,
        pickupBy: res.reservation.pickupBy,
        pickupMode: res.reservation.pickupMode,
        pickupAt: res.reservation.pickupAt,
        lines: res.reservation.lines.map((l) => ({ name: dishName.get(l.dishId) ?? l.dishId, qty: l.qty })),
      };
      return {
        ok: true,
        total: `$${(reservation.totalCents / 100).toFixed(2)} ${s.currency}`,
        pickup: reservation.pickupMode === "asap" ? `right now, ready about ${clock(reservation.pickupAt!, s, ctx.lang)}` : `at ${clock(reservation.pickupAt!, s, ctx.lang)}`,
        chargedIfNotPickedUpAfter: clock(reservation.pickupBy, s, ctx.lang),
        next: "The customer must tap the PayPal button shown under your reply to confirm.",
      };
    },
  });

  const started = Date.now();
  const run = (modelId: string) =>
    generateText({
      model: google(modelId),
      instructions: instructions(s, ctx.lang, accounts),
      messages,
      tools: !s.isOpen
        ? {}
        : accounts.required && !signedIn
          ? { ask_to_sign_in: askToSignIn }
          : { reserve_order: reserveOrder, offer_pickup_times: offerPickupTimes },
      stopWhen: isStepCount(3),
      temperature: 0.3,
      // Some Gemini models count thinking against this, so keep room.
      maxOutputTokens: 1200,
      // Never leave the customer on "Escribiendo…": give up and say so.
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(15_000),
    });

  let result: Awaited<ReturnType<typeof run>> | undefined;
  let lastError: unknown = "resting after running out of quota";
  for (const modelId of Date.now() < restUntil ? [] : [...new Set(MODELS)]) {
    try {
      result = await run(modelId);
      console.log(`agent: ${modelId}`);
      break;
    } catch (e) {
      lastError = e;
      console.error(`agent: ${modelId} failed: ${describe(e)}`);
    }
  }
  if (!result) {
    // Out of quota or down: answer from the inventory rather than an error,
    // and give Gemini a minute before trying again.
    if (Date.now() >= restUntil) restUntil = Date.now() + REST_MS;
    console.error(`agent: every model failed, answering offline: ${describe(lastError)}`);
    return { reply: offlineReply(s, messages.at(-1)?.content ?? "", ctx.lang), offline: true };
  }
  console.log(`agent: ${result.steps.length} step(s) in ${Date.now() - started} ms`);

  const reply = result.text.trim();
  return {
    reply: reply || (ctx.lang === "es" ? "¿Me lo repites, por favor?" : "Could you say that again?"),
    reservation,
    // A finished reservation needs no more time buttons.
    pickupChoices: reservation ? undefined : pickupChoices,
    needsLogin: needsLogin || undefined,
  };
}

function describe(e: unknown): string {
  if (e && typeof e === "object") {
    const o = e as { statusCode?: number; responseBody?: string; message?: string };
    return `${o.statusCode ?? ""} ${o.message ?? ""} ${o.responseBody?.slice(0, 300) ?? ""}`.trim();
  }
  return String(e);
}
