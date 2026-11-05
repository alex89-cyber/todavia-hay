// Which language the customer writes in, so the chat answers in it.

const SPANISH = new Set(
  "el la los las de del que y en un una por para con no si sí hay todavía tienes tienen cuánto cuanto cuántos quiero dame apártame aparta me mi nombre gracias hola buenas está esta son soy porfa favor claro órale orale sale va".split(" "),
);
const ENGLISH = new Set(
  "the a an is are do does you your have has any still how much many want i i'm im my name please thanks thank hi hello can could reserve order for of and what yes yeah sure".split(" "),
);

function guess(text: string): "es" | "en" | null {
  const t = text.toLowerCase();
  if (/[¿¡]/.test(t)) return "es";
  const words = t.match(/[a-záéíóúüñ']+/g) ?? [];
  const es = words.filter((w) => SPANISH.has(w)).length;
  const en = words.filter((w) => ENGLISH.has(w)).length;
  return en > es ? "en" : es > en ? "es" : null;
}

/**
 * The language of the customer's latest message that gives a clue (a bare
 * name or number doesn't); the page language when none does.
 */
export function replyLanguage(
  messages: { role: string; content: string }[],
  fallback: "es" | "en",
): "es" | "en" {
  for (const m of messages.filter((m) => m.role === "user").reverse()) {
    const lang = guess(m.content);
    if (lang) return lang;
  }
  return fallback;
}
