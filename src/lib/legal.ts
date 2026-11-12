
export const LEGAL_VERSION = "2026-11-12";

export type LegalRole =
  | "customer"
  | "employee"
  | "owner";

export function legalTermsPath(
  lang: "es" | "en",
  role: LegalRole,
) {
  return `/${lang}/legal/terminos/${role}`;
}

export function privacyPath(
  lang: "es" | "en",
) {
  return `/${lang}/legal/privacidad`;
}
