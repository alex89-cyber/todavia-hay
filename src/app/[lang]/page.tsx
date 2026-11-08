
import { LoginDropdown } from "@/components/LoginDropdown";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/dictionaries";
import { ContactSection } from "@/components/ContactSection";

export default async function Home({
  params,
}: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const t = await getDictionary(lang);
  const es = lang === "es";

  // Destinos de las demostraciones.
  const demoHref = `/${lang}/birria-dona-lupe`;
  const businessDemoHref = "#contacto";

  const features = [
    {
      icon: "📦",
      number: "01",
      title: es ? "Inventario inteligente" : "Smart inventory",
      description: es
        ? "Conoce tus existencias y cuántos platillos puedes preparar."
        : "Track your ingredients and know how many dishes you can prepare.",
    },
    {
      icon: "🍽️",
      number: "02",
      title: es ? "Menú en tiempo real" : "Live digital menu",
      description: es
        ? "Tus clientes siempre saben qué está disponible."
        : "Your customers always know what's available.",
    },
    {
      icon: "✨",
      number: "03",
      title: es ? "Todo conectado" : "Everything connected",
      description: es
        ? "Inventario, ventas, apartados y recompensas en un solo lugar."
        : "Inventory, sales, reservations and rewards in one place.",
    },
  ];

  return (
    <main className="relative min-w-0 flex-1 overflow-hidden bg-[#FAF9F6] text-[#24372C]">
      <style>{`
        @keyframes th-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-13px); }
        }
        @keyframes th-float-alt {
          0%, 100% { transform: translateY(0) rotate(-6deg); }
          50% { transform: translateY(10px) rotate(-3deg); }
        }
        @keyframes th-fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes th-pop {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .th-float { animation: th-float 6s ease-in-out infinite; }
        .th-float-alt { animation: th-float-alt 7s ease-in-out infinite; }
        .th-fade-up { animation: th-fade-up .85s ease-out both; }
        .th-delay-1 { animation-delay: .15s; }
        .th-delay-2 { animation-delay: .3s; }
        .th-pop { animation: th-pop 4s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .th-float, .th-float-alt, .th-fade-up, .th-pop {
            animation: none !important;
          }
        }
      `}</style>

      {/* ==========================================
          NAVEGACIÓN
      ========================================== */}

      <header className="relative z-30 border-b border-[#E9EAE3] bg-[#FAF9F6]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-5 sm:px-8 lg:px-12">
          <Link
            href={`/${lang}`}
            className="group flex min-w-0 items-center gap-3"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#244D38] text-lg text-white transition-transform duration-300 group-hover:-rotate-12">
              ✳
            </span>
            <span className="truncate text-lg font-black tracking-[-0.05em] sm:text-xl">
              ¿Todavía hay<span className="text-[#E68B5C]">?</span>
            </span>
          </Link>

          <nav className="flex shrink-0 items-center gap-2 sm:gap-5">
            <a
              href="#experiencias"
              className="hidden text-sm font-semibold text-[#456051] hover:text-[#E68B5C] md:inline"
            >
              {es ? "Cómo funciona" : "How it works"}
            </a>

            <a
              href="#contacto"
              className="hidden text-sm font-semibold text-[#456051] hover:text-[#E68B5C] sm:inline"
            >
              {es ? "Contacto" : "Contact"}
            </a>

            <Link
              href={es ? "/en" : "/es"}
              className="rounded-full border border-[#E4E7DE] px-3 py-2 text-xs font-bold transition hover:bg-white"
            >
              {es ? "EN" : "ES"}
            </Link>

            {/* MENÚ CON LOS 4 ACCESOS */}
            <LoginDropdown lang={lang} />
          </nav>
        </div>
      </header>

      {/* ==========================================
          PORTADA
      ========================================== */}

      <section className="relative isolate">
        <div className="pointer-events-none absolute -left-32 top-32 h-72 w-72 rounded-full bg-[#E9F0E6] blur-3xl" />
        <div className="pointer-events-none absolute -right-28 bottom-0 h-80 w-80 rounded-full bg-[#F7E9DE] blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-20 sm:px-8 sm:py-24 lg:grid-cols-[1.03fr_0.97fr] lg:gap-14 lg:px-12 lg:py-32">
          <div className="relative z-10">
            <span className="th-fade-up inline-flex items-center gap-2 rounded-full border border-[#DCE7DA] bg-[#EDF5EA] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-[#60A876]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#426A4D]">
                {es
                  ? "El futuro de tu negocio de comida"
                  : "The future of your food business"}
              </span>
            </span>

            <h1 className="th-fade-up th-delay-1 mt-7 max-w-3xl text-[3.4rem] font-black leading-[1.03] tracking-[-0.07em] sm:text-7xl lg:text-[5.25rem]">
              {es ? (
                <>
                  Lo bueno
                  <br />
                  <span className="text-[#E68B5C]">no debería</span>
                  <br />
                  acabarse.
                </>
              ) : (
                <>
                  Good food
                  <br />
                  <span className="text-[#E68B5C]">deserves</span>
                  <br />
                  better.
                </>
              )}
            </h1>

            <p className="th-fade-up th-delay-2 mt-7 max-w-lg text-base leading-8 text-[#708076] sm:text-lg">
              {es
                ? "Tu negocio bajo control y tus clientes siempre informados. Conecta inventario, ventas, menú digital y apartados en una sola plataforma."
                : "Keep your business in control and customers informed. Connect inventory, sales, digital menus and reservations in one platform."}
            </p>

            <div className="th-fade-up th-delay-2 mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#experiencias"
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[#244D38] px-7 py-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(36,77,56,.15)] transition hover:-translate-y-1 hover:bg-[#32684C]"
              >
                {es ? "Descubrir la plataforma" : "Discover the platform"} ↗
              </a>

              {/* MISMO MENÚ DE INICIO DE SESIÓN */}
              <LoginDropdown lang={lang} variant="hero" />
            </div>

            <a
              href="#contacto"
              className="th-fade-up th-delay-2 mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#607768] underline decoration-[#E68B5C] decoration-2 underline-offset-4 hover:text-[#244D38]"
            >
              {es
                ? "¿Te interesa la plataforma? Hablemos"
                : "Interested in the platform? Let's talk"} ↗
            </a>

            <div className="mt-10 flex flex-wrap gap-4 text-xs font-semibold text-[#79877B]">
              <span>✓ {es ? "Inventario inteligente" : "Smart inventory"}</span>
              <span>✓ {es ? "Menú en vivo" : "Live menu"}</span>
              <span>✓ {es ? "Todo conectado" : "Connected operations"}</span>
            </div>
          </div>

          {/* ======================================
              ILUSTRACIÓN DE AMBAS EXPERIENCIAS
          ====================================== */}

          <div className="relative mx-auto flex w-full max-w-[560px] items-center justify-center py-12">
            <div className="absolute h-[92%] w-[92%] rounded-full bg-[#EAF0E6]" />
            <div className="absolute h-[74%] w-[74%] rounded-full border border-[#CFDDCA]" />
            <div className="absolute h-[56%] w-[56%] rounded-full border border-dashed border-[#C1D5BE]" />

            <div className="th-float absolute left-0 top-5 z-20 rounded-2xl bg-white p-4 text-4xl shadow-xl">
              🥑
            </div>

            <div className="th-float-alt absolute right-0 top-10 z-20 rounded-2xl bg-white p-4 text-4xl shadow-xl">
              🍋
            </div>

            <div className="relative z-10 my-10 flex w-[87%] max-w-[440px] flex-col gap-3">
              <div className="-rotate-3 rounded-[2rem] border border-white bg-white p-5 shadow-[0_25px_55px_rgba(31,62,42,.12)] transition-transform duration-500 group-hover:rotate-0 sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-[#EAF3E8] p-3 text-2xl">
                      👩‍🍳
                    </span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#95A095]">
                        {es ? "PANEL DEL NEGOCIO" : "BUSINESS DASHBOARD"}
                      </p>
                      <p className="mt-1 text-sm font-black">
                        {es ? "Todo bajo control" : "Everything in control"}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#E9F5EA] px-2 py-1 text-[10px] font-bold text-[#438D53]">
                    ● LIVE
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    ["📦", es ? "Stock" : "Stock", "78%"],
                    ["📊", es ? "Ventas" : "Sales", "↗"],
                    ["🍽️", es ? "Menú" : "Menu", "✓"],
                  ].map(([icon, title, value]) => (
                    <div
                      key={title}
                      className="rounded-xl bg-[#F4F7F2] p-3 text-center"
                    >
                      <div className="text-xl">{icon}</div>
                      <p className="mt-2 text-[10px] text-[#879889]">
                        {title}
                      </p>
                      <p className="mt-1 font-black">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center">
                <span className="th-pop rounded-full bg-[#244D38] px-4 py-2 text-xl text-white shadow-lg">
                  ↕
                </span>
              </div>

              <div className="rotate-3 rounded-[2rem] border border-white bg-white p-5 shadow-[0_25px_55px_rgba(31,62,42,.12)] transition-transform duration-500 hover:rotate-0 sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#95A095]">
                      {es ? "VISTA DEL CLIENTE" : "CUSTOMER VIEW"}
                    </p>
                    <p className="mt-1 text-sm font-black">
                      {es ? "Siempre informado" : "Always informed"}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#E9F5EA] px-3 py-1 text-[10px] font-bold text-[#438D53]">
                    {es ? "Disponible" : "Available"}
                  </span>
                </div>
                <div className="mt-5 flex items-center gap-4 rounded-xl bg-[#F8F3E9] p-3">
                  <span className="rounded-xl bg-[#F5E2CB] p-3 text-4xl">
                    🥗
                  </span>
                  <div>
                    <p className="text-sm font-black">
                      {es ? "Menú actualizado" : "Updated menu"}
                    </p>
                    <p className="mt-1 text-xs text-[#829187]">
                      {es
                        ? "Consulta y aparta favoritos"
                        : "Browse and reserve favorites"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="th-float absolute bottom-0 right-1 z-20 rounded-2xl bg-[#FCEBDF] px-4 py-3 text-sm font-bold text-[#B97953] shadow-xl">
              {es ? "Sincronizados ✨" : "In sync ✨"}
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
          FRANJA
      ========================================== */}

      <section className="border-y border-[#E6ECE3] bg-[#F0F4ED]">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-7 text-center sm:grid-cols-3 sm:px-8 lg:px-12">
          {[
            es ? "Menos desperdicio" : "Less food waste",
            es ? "Más control" : "More control",
            es ? "Mejores experiencias" : "Better experiences",
          ].map((text, index) => (
            <div
              key={text}
              className="flex items-center justify-center gap-3 text-sm font-bold text-[#43664C]"
            >
              <span className="text-lg text-[#E68B5C]">
                {index === 0 ? "✳" : index === 1 ? "✦" : "♡"}
              </span>
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* ==========================================
          FUNCIONALIDADES
      ========================================== */}

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#E68B5C]">
              {es ? "Simple, pero poderoso" : "Simple, yet powerful"}
            </p>
            <h2 className="mt-5 text-4xl font-black leading-tight tracking-[-.05em] text-[#244D38] sm:text-5xl">
              {es
                ? "Todo lo que necesitas, nada que te complique."
                : "Everything you need. Nothing you don't."}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-[#7D8A80]">
              {es
                ? "Pensado para conectar la operación diaria del negocio con la experiencia de sus clientes."
                : "Built to connect your daily business operations with the customer experience."}
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.number}
                className="group flex min-h-[270px] flex-col rounded-[2rem] border border-[#E9EEE7] bg-[#FBFCFA] p-7 transition-all duration-500 hover:-translate-y-2 hover:border-[#C7DDC7] hover:bg-[#F2F8F0] hover:shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-2xl bg-[#EDF3EA] p-3 text-3xl transition-transform group-hover:-rotate-12">
                    {feature.icon}
                  </span>
                  <span className="text-xs font-black text-[#BAC7BC]">
                    {feature.number}
                  </span>
                </div>
                <h3 className="mt-9 text-xl font-black">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#7D8A80]">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ==========================================
          DOS EXPERIENCIAS
      ========================================== */}

      <section
        id="experiencias"
        className="scroll-mt-20 bg-[#F4F6F1] px-5 py-20 sm:px-8 lg:px-12 lg:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="rounded-full bg-[#E8F0E3] px-4 py-2 text-[11px] font-black uppercase tracking-wider text-[#54815B]">
              {es
                ? "Dos experiencias. Un solo sistema."
                : "Two experiences. One system."}
            </span>
            <h2 className="mt-7 text-4xl font-black leading-tight tracking-[-.05em] sm:text-5xl">
              {es ? (
                <>
                  Tu negocio bajo control.
                  <br />
                  <span className="text-[#E68B5C]">
                    Tus clientes informados.
                  </span>
                </>
              ) : (
                <>
                  Your business in control.
                  <br />
                  <span className="text-[#E68B5C]">
                    Your customers in the know.
                  </span>
                </>
              )}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#78877C]">
              {es
                ? "Mira la página de un puesto real y pídenos una demostración del panel para tu negocio."
                : "See a real stall's page and ask us for a demo of the dashboard for your business."}
            </p>
          </div>

          <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-2">
            {/* TARJETA DEL NEGOCIO */}

            <article className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-[#DDE7DB] bg-white shadow-sm transition hover:-translate-y-2 hover:shadow-xl">
              <div className="relative flex h-[350px] items-center justify-center overflow-hidden bg-[#E6EEE3] p-7 sm:p-9">
                <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border-[35px] border-white/40" />

                <div className="relative mx-auto flex h-[280px] w-full max-w-sm rotate-[-3deg] flex-col justify-center rounded-[1.6rem] border border-white bg-white p-5 shadow-[0_18px_40px_rgba(31,62,42,.12)] transition-transform duration-500 group-hover:rotate-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black">
                      {es ? "Inventario" : "Inventory"}
                    </p>
                    <span className="rounded-full bg-[#E9F5EA] px-3 py-1 text-[10px] font-bold text-[#438D53]">
                      ● LIVE
                    </span>
                  </div>

                  {[
                    {
                      emoji: "🍅",
                      label: es ? "Ingredientes" : "Ingredients",
                      width: "78%",
                      color: "#69AA78",
                    },
                    {
                      emoji: "🧀",
                      label: es ? "Existencias" : "Stock levels",
                      width: "55%",
                      color: "#E6A36C",
                    },
                    {
                      emoji: "🥬",
                      label: es ? "Disponibilidad" : "Availability",
                      width: "90%",
                      color: "#69AA78",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="mt-5 flex items-center gap-3"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F4F7F2] text-2xl">
                        {item.emoji}
                      </span>
                      <div className="flex-1">
                        <p className="text-xs font-bold">{item.label}</p>
                        <div className="mt-2 h-2 rounded-full bg-[#E8EFE8]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: item.width,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-1 flex-col p-7 sm:p-9">
                <span className="text-xs font-black uppercase tracking-[.15em] text-[#79A184]">
                  {es ? "PARA QUIEN ADMINISTRA" : "FOR BUSINESS OWNERS"}
                </span>
                <h3 className="mt-3 text-3xl font-black tracking-tight">
                  {es ? "Vista del negocio" : "Business dashboard"}
                </h3>
                <p className="mt-4 text-sm leading-7 text-[#78877C]">
                  {es
                    ? "Administra inventario, recetas, ventas, apartados y cortes de caja desde un solo panel."
                    : "Manage inventory, recipes, sales, reservations and cash-up from one dashboard."}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {(es
                    ? ["Inventario", "Ventas", "Recetas", "Apartados"]
                    : ["Inventory", "Sales", "Recipes", "Reservations"]
                  ).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[#F0F5EE] px-3 py-2 text-xs font-semibold text-[#597361]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-auto pt-9">
                  <Link
                    href={businessDemoHref}
                    className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#244D38] px-6 py-4 text-sm font-black text-white transition hover:bg-[#32684C]"
                  >
                    {es
                      ? "Pedir una demostración"
                      : "Request a demo"} ↗
                  </Link>
                  <p className="mt-3 text-center text-xs text-[#93A096]">
                    {es
                      ? "Te mostramos el panel con tu propio menú"
                      : "We'll show you the dashboard with your own menu"}
                  </p>
                </div>
              </div>
            </article>

            {/* TARJETA DEL CLIENTE */}

            <article className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-[#EFE2D5] bg-white shadow-sm transition hover:-translate-y-2 hover:shadow-xl">
              <div className="relative flex h-[350px] items-center justify-center overflow-hidden bg-[#F8E9DB] p-7 sm:p-9">
                <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full border-[35px] border-white/40" />

                <div className="relative mx-auto flex h-[280px] w-full max-w-sm rotate-[3deg] flex-col justify-center rounded-[1.6rem] border border-white bg-white p-5 shadow-[0_18px_40px_rgba(103,60,36,.12)] transition-transform duration-500 group-hover:rotate-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black">
                      {es ? "Menú digital" : "Digital menu"}
                    </p>
                    <span className="rounded-full bg-[#E9F5EA] px-3 py-1 text-[10px] font-bold text-[#438D53]">
                      ● LIVE
                    </span>
                  </div>

                  <div className="mt-5 flex items-center gap-4 rounded-2xl bg-[#FAF5EC] p-3">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#F4E2CB] text-4xl">
                      🥗
                    </span>
                    <div>
                      <p className="text-sm font-black">
                        {es ? "Platillo disponible" : "Dish available"}
                      </p>
                      <p className="mt-1 text-xs text-[#7D8A80]">
                        {es ? "Menú actualizado" : "Updated menu"}
                      </p>
                      <span className="mt-2 inline-block rounded-full bg-[#E9F5EA] px-2 py-1 text-[10px] font-bold text-[#438D53]">
                        ✓ {es ? "Hay" : "Available"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4 rounded-2xl bg-[#FAF5EC] p-3">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#F4E2CB] text-3xl">
                      🥪
                    </span>
                    <div>
                      <p className="text-sm font-black">
                        {es ? "Consulta tu menú" : "Browse the menu"}
                      </p>
                      <p className="mt-1 text-xs text-[#7D8A80]">
                        {es ? "Descubre y aparta" : "Discover and reserve"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-7 sm:p-9">
                <span className="text-xs font-black uppercase tracking-[.15em] text-[#D59772]">
                  {es ? "PARA QUIEN COMPRA" : "FOR CUSTOMERS"}
                </span>
                <h3 className="mt-3 text-3xl font-black tracking-tight">
                  {es ? "Vista del cliente" : "Customer experience"}
                </h3>
                <p className="mt-4 text-sm leading-7 text-[#78877C]">
                  {es
                    ? "Consulta platillos disponibles, realiza apartados y recibe actualizaciones sin tener que preguntar."
                    : "Browse available dishes, make reservations and stay informed without having to ask."}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {(es
                    ? ["Menú", "Disponibilidad", "Apartados", "Notificaciones"]
                    : ["Menu", "Availability", "Reservations", "Notifications"]
                  ).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[#FCF2E8] px-3 py-2 text-xs font-semibold text-[#B78261]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-auto pt-9">
                  <Link
                    href={demoHref}
                    className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-[#D4DCCF] bg-[#FAFBF8] px-6 py-4 text-sm font-black text-[#244D38] transition hover:border-[#244D38] hover:bg-[#EDF4E9]"
                  >
                    {es
                      ? "Ver experiencia del cliente"
                      : "Explore customer experience"} ↗
                  </Link>
                  <p className="mt-3 text-center text-xs text-[#93A096]">
                    {es
                      ? "Birria Doña Lupe, un puesto en vivo"
                      : "Birria Doña Lupe, a live stall"}
                  </p>
                </div>
              </div>
            </article>
          </div>

          {/* EXPLICACIÓN DE CONEXIÓN */}

          <div className="mt-12 rounded-[2rem] border border-[#DDE7DB] bg-white p-6 sm:p-9">
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-wider text-[#6B9D78]">
                {es ? "Así trabajan juntas" : "How they work together"}
              </p>
              <h3 className="mt-3 text-2xl font-black sm:text-3xl">
                {es
                  ? "Una acción. Todo actualizado."
                  : "One action. Everything updated."}
              </h3>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: "📦",
                  title: es ? "El negocio registra" : "The business updates",
                  text: es
                    ? "Actualiza ingredientes, existencias y ventas."
                    : "Updates ingredients, stock and sales.",
                },
                {
                  icon: "↔",
                  title: es ? "El sistema calcula" : "The system calculates",
                  text: es
                    ? "Recalcula cuántas porciones se pueden preparar."
                    : "Recalculates how many portions can be prepared.",
                },
                {
                  icon: "📱",
                  title: es ? "El cliente lo ve" : "The customer sees it",
                  text: es
                    ? "Consulta el menú con disponibilidad actualizada."
                    : "Browses the menu with updated availability.",
                },
              ].map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-2xl bg-[#F7F9F5] p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-xl bg-[#E8F0E3] p-3 text-2xl">
                      {step.icon}
                    </span>
                    <span className="text-xs font-black text-[#A8B8A9]">
                      0{index + 1}
                    </span>
                  </div>
                  <h4 className="mt-5 font-black">{step.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-[#78877C]">
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
          INVENTARIO
      ========================================== */}

      <section className="bg-[#FAF9F6] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div className="relative order-2 flex min-h-[350px] items-center justify-center lg:order-1">
            <div className="absolute h-80 w-80 rounded-full bg-[#E3EDE1] sm:h-[390px] sm:w-[390px]" />
            <div className="th-float relative z-10 w-[76%] max-w-[350px] rotate-[-5deg] rounded-[2rem] border border-white bg-white p-6 shadow-[0_25px_55px_rgba(31,62,42,.12)]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black">
                  {es ? "Inventario" : "Inventory"}
                </span>
                <span className="rounded-full bg-[#E9F5EA] px-3 py-1 text-[10px] font-bold text-[#438D53]">
                  ● LIVE
                </span>
              </div>
              {[
                ["🍅", es ? "Ingredientes" : "Ingredients", "78%", "#69AA78"],
                ["🧀", es ? "Existencias" : "Stock levels", "55%", "#E6A36C"],
                ["🥬", es ? "Disponibilidad" : "Availability", "90%", "#69AA78"],
              ].map(([icon, label, width, color]) => (
                <div key={label} className="mt-5 flex items-center gap-4">
                  <span className="rounded-2xl bg-[#FFF3E8] p-3 text-3xl">
                    {icon}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{label}</p>
                    <div className="mt-2 h-2 rounded-full bg-[#E8EFE8]">
                      <div
                        className="h-full rounded-full"
                        style={{ width, backgroundColor: color }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <span className="th-float-alt absolute bottom-0 right-0 z-20 rounded-2xl bg-[#FCE9D8] p-4 text-4xl shadow-xl">
              🥕
            </span>
          </div>

          <div className="order-1 lg:order-2">
            <span className="rounded-full bg-[#E8F0E3] px-4 py-2 text-[11px] font-black uppercase tracking-wider text-[#54815B]">
              {es ? "Más fácil, todos los días" : "Easier, every day"}
            </span>
            <h2 className="mt-6 text-4xl font-black leading-tight tracking-[-.055em] sm:text-5xl">
              {es ? (
                <>
                  Tú haces la comida.
                  <br />
                  <span className="text-[#E68B5C]">
                    Nosotros las cuentas.
                  </span>
                </>
              ) : (
                <>
                  You make the food.
                  <br />
                  <span className="text-[#E68B5C]">
                    We handle the numbers.
                  </span>
                </>
              )}
            </h2>
            <p className="mt-6 max-w-lg text-base leading-8 text-[#78877C]">
              {es
                ? "Olvídate de calcular a mano cuántas porciones quedan. Registra tus ingredientes y deja que la plataforma te ayude a mantener todo organizado."
                : "Forget counting remaining portions by hand. Track ingredients and let the platform help you keep everything organized."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={businessDemoHref}
                className="rounded-2xl bg-[#244D38] px-6 py-4 text-sm font-black text-white hover:bg-[#32684C]"
              >
                {es ? "Pedir una demostración" : "Request a demo"} ↗
              </Link>
              <Link
                href={demoHref}
                className="rounded-2xl border border-[#D4DCCF] bg-white px-6 py-4 text-sm font-black hover:border-[#244D38]"
              >
                {es ? "Ver menú del cliente" : "View customer menu"} ↗
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
          LLAMADO A LA ACCIÓN
      ========================================== */}

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-[#244D38] px-6 py-16 text-center text-white sm:px-12 sm:py-24">
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full border-[35px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full border-[45px] border-white/10" />

          <span className="relative rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider">
            ¿Todavía hay?
          </span>

          <h2 className="relative mx-auto mt-7 max-w-3xl text-4xl font-black leading-tight tracking-[-.055em] sm:text-6xl">
            {es
              ? "Que no se te escape ninguna oportunidad."
              : "Make every opportunity count."}
          </h2>

          <p className="relative mx-auto mt-6 max-w-xl text-base leading-8 text-[#D5E5D6]">
            {es
              ? "Conoce una manera más sencilla de conectar tu cocina, tu inventario y tus clientes."
              : "Discover an easier way to connect your kitchen, inventory and customers."}
          </p>

          <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={businessDemoHref}
              className="rounded-2xl bg-white px-8 py-4 text-sm font-black text-[#244D38] transition hover:-translate-y-1"
            >
              {es ? "Pedir una demostración" : "Request a demo"} ↗
            </Link>
            <Link
              href={demoHref}
              className="rounded-2xl border border-white/35 bg-white/10 px-8 py-4 text-sm font-black text-white transition hover:-translate-y-1"
            >
              {es ? "Ver un puesto en vivo" : "See a live stall"} ↗
            </Link>
            <a
              href="#contacto"
              className="rounded-2xl border border-white/35 bg-white/10 px-8 py-4 text-sm font-black text-white transition hover:-translate-y-1"
            >
              {es ? "Contáctanos" : "Contact us"} ↗
            </a>
          </div>
        </div>
      </section>

      {/* ==========================================
          CONTACTO
      ========================================== */}

      <ContactSection lang={lang} />

      {/* ==========================================
          FOOTER
      ========================================== */}

      <footer className="border-t border-[#E7EBE4] bg-[#FAF9F6]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <div>
            <p className="text-lg font-black">
              ¿Todavía hay<span className="text-[#E68B5C]">?</span>
            </p>
            <p className="mt-1 text-xs text-[#8D9A8D]">
              {es
                ? "Hecho para quienes alimentan al mundo."
                : "Made for the people who feed the world."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm font-semibold text-[#66806D]">
            <Link href={businessDemoHref} className="hover:text-[#244D38]">
              {es ? "Pedir demostración" : "Request a demo"}
            </Link>

            <Link href={demoHref} className="hover:text-[#244D38]">
              {t.demoLink}
            </Link>

            <Link
              href={`/${lang}/negocios/login`}
              className="hover:text-[#244D38]"
            >
              {es ? "Acceso para negocios" : "Business login"}
            </Link>

            <a href="#contacto" className="hover:text-[#244D38]">
              {es ? "Contacto" : "Contact"}
            </a>

            <Link
              href={es ? "/en" : "/es"}
              className="hover:text-[#244D38]"
            >
              {t.switchLang}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
