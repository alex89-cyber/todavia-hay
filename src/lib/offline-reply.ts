import { menuAvailability } from "./inventory";
import type { StallState } from "./stall";

// When Gemini is out of quota or down, the chat still answers "¿todavía hay?"
// straight from the inventory instead of showing an error. It can't reserve.

const plain = (x: string) =>
  x.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const words = (x: string) => plain(x).match(/[a-z0-9]+/g) ?? [];

/** Dish words a customer would write ("quesabirrias", "tacos", "consome"). */
function mentions(dishName: string, said: string[]) {
  const keys = words(dishName).filter((w) => w.length > 3 && !["plato", "orden", "vaso", "order", "plate", "with"].includes(w));
  return keys.some((k) => said.some((w) => w.startsWith(k.slice(0, 5)) && k.startsWith(w.slice(0, 5))));
}

export function offlineReply(
  s: StallState,
  lastMessage: string,
  lang: "es" | "en",
): string {
  const es = lang === "es";
  const busy = es
    ? "Nuestro asistente está saturado ahorita, así que no puedo apartar. Intenta en un minuto o pide directo en el puesto."
    : "Our assistant is overloaded right now, so I can't reserve. Try again in a minute or order at the stall.";
  if (!s.isOpen)
    return es
      ? `${s.name} está cerrado ahorita. Toca "Avísame" y te llega un aviso cuando abra.`
      : `${s.name} is closed right now. Tap "Notify me" to get an alert when it opens.`;

  const left = new Map(menuAvailability(s.dishes, s.ingredients).map((a) => [a.dishId, a.portions]));
  const said = words(lastMessage);
  const asked = s.dishes.filter((d) => mentions(d.nameEs, said) || mentions(d.nameEn, said));
  const line = (d: StallState["dishes"][number]) => {
    const name = es ? d.nameEs : d.nameEn;
    const n = left.get(d.id) ?? 0;
    if (n <= 0) return es ? `${name}: ya se acabó.` : `${name}: sold out.`;
    return es ? `${name}: quedan unas ${n}.` : `${name}: about ${n} left.`;
  };
  const info = asked.length
    ? asked.map(line).join(" ")
    : (es ? "Hoy hay: " : "Today we have: ") +
      s.dishes
        .filter((d) => (left.get(d.id) ?? 0) > 0)
        .map((d) => (es ? d.nameEs : d.nameEn))
        .join(", ") +
      ".";
  return `${info} ${busy}`;
}
