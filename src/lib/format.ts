// Formatting shared by server and client components.

export const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

const intlLocale = (lang: string) => (lang === "en" ? "en-US" : "es-MX");

export const money = (cents: number, currency: string, lang: string) =>
  new Intl.NumberFormat(intlLocale(lang), {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

export const clock = (iso: string, timeZone: string, lang: string) =>
  new Intl.DateTimeFormat(intlLocale(lang), { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));

export const minutesSince = (iso: string, now = Date.now()) => Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));

export const qty = (n: number, unit: string, lang: string) =>
  `${new Intl.NumberFormat(intlLocale(lang), { maximumFractionDigits: 1 }).format(n)} ${unit}`;
