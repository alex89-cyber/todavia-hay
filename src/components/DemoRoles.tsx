// Entrada pública a la demo: un botón por cada vista del sistema.
// Cada botón es un formulario que inicia sesión con la cuenta de prueba.

const ROLES = {
  es: [
    { role: "cliente", icon: "🙋", title: "Cliente", text: "Ve el menú, pregunta \"¿todavía hay?\" en el chat y aparta tu pedido." },
    { role: "dueno", icon: "👩‍🍳", title: "Dueño", text: "Panel completo: pedidos, inventario, menú y recetas, corte de caja y configuración." },
    { role: "mesero", icon: "🧾", title: "Mesero", text: "Abre mesas, toma el pedido, divide la cuenta y cobra." },
    { role: "cocina", icon: "🔥", title: "Cocina", text: "Pantalla de comandas: lo que falta por preparar y botón de Lista." },
  ],
  en: [
    { role: "cliente", icon: "🙋", title: "Customer", text: "Browse the menu, ask \"still have it?\" in the chat and reserve your order." },
    { role: "dueno", icon: "👩‍🍳", title: "Owner", text: "Full dashboard: orders, inventory, menu and recipes, cash-up and settings." },
    { role: "mesero", icon: "🧾", title: "Waiter", text: "Open tables, take orders, split the bill and charge." },
    { role: "cocina", icon: "🔥", title: "Kitchen", text: "Ticket screen: what's left to prepare and a Ready button." },
  ],
} as const;

export function DemoRoles({ lang }: { lang: "es" | "en" }) {
  const es = lang === "es";
  return (
    <section id="demo" className="scroll-mt-20 bg-white px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full bg-[#FCF2E8] px-4 py-2 text-[11px] font-black uppercase tracking-wider text-[#B78261]">
            {es ? "Pruébalo sin registrarte" : "Try it without signing up"}
          </span>
          <h2 className="mt-6 text-3xl font-black leading-tight tracking-[-.04em] sm:text-5xl">
            {es ? "Entra a Birria Doña Lupe" : "Step into Birria Doña Lupe"}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#78877C]">
            {es
              ? "Es un negocio de prueba. Elige cómo quieres verlo; puedes mover todo lo que quieras."
              : "It's a test business. Pick how you want to see it; feel free to change anything."}
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES[lang].map((r) => (
            <form key={r.role} action="/api/demo" method="post" className="flex">
              <input type="hidden" name="role" value={r.role} />
              <input type="hidden" name="lang" value={lang} />
              <button
                type="submit"
                className="flex w-full flex-col items-start gap-3 rounded-[1.5rem] border border-[#DDE7DB] bg-[#FAFBF8] p-6 text-left transition hover:-translate-y-1 hover:border-[#244D38] hover:shadow-lg"
              >
                <span className="text-3xl" aria-hidden>{r.icon}</span>
                <span className="text-lg font-black text-[#24372C]">
                  {es ? "Ver como " : "View as "}
                  {r.title.toLowerCase()}
                </span>
                <span className="text-sm leading-6 text-[#78877C]">{r.text}</span>
                <span className="mt-auto pt-2 text-sm font-black text-[#E68B5C]">{es ? "Entrar →" : "Enter →"}</span>
              </button>
            </form>
          ))}
        </div>
      </div>
    </section>
  );
}
