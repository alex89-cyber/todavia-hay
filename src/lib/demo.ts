import "server-only";

// ==========================================
// DEMO PÚBLICA
// ==========================================
//
// Cualquiera puede entrar a un negocio de prueba
// (Birria Doña Lupe) como dueño, mesero, cocina o
// cliente, sin crear cuenta. Sirve para que un
// negocio interesado vea cómo funciona todo.
//
// DEMO_SLUG en Render cambia el negocio de prueba.
// DEMO_SLUG=off apaga la demo pública.
// ==========================================

export function demoSlug(): string | null {
  const v = (process.env.DEMO_SLUG ?? "birria-dona-lupe").trim();
  return !v || v === "off" ? null : v;
}

export const isDemoBusiness = (slug: string) => slug === demoSlug();

export const DEMO_ROLES = ["dueno", "mesero", "cocina", "cliente"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

/** Cuentas fijas de la demo. Los correos no existen: nunca se les manda nada. */
export const DEMO_ACCOUNTS: Record<
  DemoRole,
  { email: string; firstName: string; lastName: string; member: "owner" | "waiter" | "kitchen" | null }
> = {
  dueno: { email: "demo-dueno@example.com", firstName: "Dueño", lastName: "Demo", member: "owner" },
  mesero: { email: "demo-mesero@example.com", firstName: "Mesero", lastName: "Demo", member: "waiter" },
  cocina: { email: "demo-cocina@example.com", firstName: "Cocina", lastName: "Demo", member: "kitchen" },
  cliente: { email: "demo-cliente@example.com", firstName: "Cliente", lastName: "Demo", member: null },
};

export const isDemoEmail = (email: string | null | undefined) =>
  Boolean(email) && Object.values(DEMO_ACCOUNTS).some((a) => a.email === email);

/** A dónde llega cada rol después de entrar. */
export function demoLanding(role: DemoRole, lang: string, slug: string): string {
  switch (role) {
    case "dueno":
      return `/${lang}/panel/${slug}`;
    case "mesero":
      return `/${lang}/empleado/mesas/${slug}`;
    case "cocina":
      return `/${lang}/empleado/cocina/${slug}`;
    case "cliente":
      return `/${lang}/${slug}`;
  }
}
