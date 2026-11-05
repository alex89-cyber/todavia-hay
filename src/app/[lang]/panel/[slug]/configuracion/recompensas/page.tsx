
import Link from "next/link";
import { Suspense } from "react";

import LoyaltySettingsEditor from "@/components/LoyaltySettingsEditor";

// ==========================================
// ¿TODAVÍA HAY?
// PÁGINA DE CONFIGURACIÓN DE RECOMPENSAS
//
// Compatible con Next.js 16 y Cache Components.
// ==========================================

type Props = {
  params: Promise<{
    lang: string;
    slug: string;
  }>;
};

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================

export default function RecompensasPage({
  params,
}: Props) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center bg-[#FFF9F3] px-4 py-10">
          <div className="rounded-2xl border border-[#E8D7C8] bg-white px-8 py-6 text-center shadow-sm">
            <p className="font-semibold text-[#38251D]">
              Cargando configuración de recompensas...
            </p>
          </div>
        </main>
      }
    >
      <RecompensasContent params={params} />
    </Suspense>
  );
}

// ==========================================
// CONTENIDO DINÁMICO
//
// Los parámetros se leen dentro de Suspense
// para permitir el prerenderizado del shell.
// ==========================================

async function RecompensasContent({
  params,
}: Props) {
  const { lang, slug } = await params;

  const safeLang = lang === "en" ? "en" : "es";

  const es = safeLang === "es";

  const basePath =
    `/${safeLang}/panel/${encodeURIComponent(slug)}`;

  const publicHref =
    `/${safeLang}/${encodeURIComponent(slug)}`;

  return (
    <main className="min-h-screen bg-[#FFF9F3] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">

        {/* NAVEGACIÓN */}

        <nav className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`${basePath}/configuracion`}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E8D7C8] bg-white px-4 py-3 text-sm font-semibold text-[#A42B15] transition hover:bg-[#FFF1E7]"
          >
            <span aria-hidden="true">
              ←
            </span>

            {es
              ? "Volver a configuración"
              : "Back to settings"}
          </Link>

          <Link
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[#E8D7C8] bg-white px-4 py-3 text-sm font-semibold text-[#A42B15] transition hover:bg-[#FFF1E7]"
          >
            {es
              ? "Ver página pública"
              : "View public page"}

            <span aria-hidden="true">
              ↗
            </span>
          </Link>
        </nav>

        {/* ENCABEZADO */}

        <header className="rounded-3xl border border-[#E8D7C8] bg-white p-6 shadow-sm sm:p-8">

          <div className="mb-3 inline-flex rounded-full bg-[#FFF0E5] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#A42B15]">
            {es
              ? "Personalización del negocio"
              : "Business customization"}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-[#38251D] sm:text-4xl">
            {es
              ? "🎁 Tus recompensas"
              : "🎁 Your rewards"}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#80695C] sm:text-base">
            {es
              ? "Diseña el programa de fidelidad de tu negocio. Elige cuántos sellos necesitan tus clientes, qué premio recibirán y cuánto tiempo tienen para conseguirlo."
              : "Design your business loyalty program. Choose how many stamps customers need, what reward they receive, and how long they have to earn it."}
          </p>

          {/* INFORMACIÓN */}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">

            <div className="rounded-2xl bg-[#FFF8F1] p-4">
              <span
                className="text-2xl"
                aria-hidden="true"
              >
                ⭐
              </span>

              <h2 className="mt-2 text-sm font-bold text-[#38251D]">
                {es
                  ? "Sellos personalizados"
                  : "Custom stamps"}
              </h2>

              <p className="mt-1 text-xs leading-5 text-[#80695C]">
                {es
                  ? "Tú eliges cuántos sellos necesita cada cliente."
                  : "Choose how many stamps each customer needs."}
              </p>
            </div>

            <div className="rounded-2xl bg-[#FFF8F1] p-4">
              <span
                className="text-2xl"
                aria-hidden="true"
              >
                📅
              </span>

              <h2 className="mt-2 text-sm font-bold text-[#38251D]">
                {es
                  ? "Fechas de vencimiento"
                  : "Expiration dates"}
              </h2>

              <p className="mt-1 text-xs leading-5 text-[#80695C]">
                {es
                  ? "Configura periodos semanales, mensuales o sin vencimiento."
                  : "Set weekly, monthly or unlimited periods."}
              </p>
            </div>

            <div className="rounded-2xl bg-[#FFF8F1] p-4">
              <span
                className="text-2xl"
                aria-hidden="true"
              >
                🎁
              </span>

              <h2 className="mt-2 text-sm font-bold text-[#38251D]">
                {es
                  ? "Premios a tu manera"
                  : "Your rewards"}
              </h2>

              <p className="mt-1 text-xs leading-5 text-[#80695C]">
                {es
                  ? "Escoge el premio y cuánto tiempo tendrá el cliente para canjearlo."
                  : "Choose the reward and its redemption deadline."}
              </p>
            </div>

          </div>
        </header>

        {/* EDITOR REAL */}

        <LoyaltySettingsEditor slug={slug} />

        {/* INFORMACIÓN ADICIONAL */}

        <aside className="rounded-2xl border border-[#E8D7C8] bg-white p-5">

          <h2 className="font-bold text-[#38251D]">
            {es
              ? "Información importante"
              : "Important information"}
          </h2>

          <p className="mt-2 text-sm leading-6 text-[#80695C]">
            {es
              ? "Los cambios del programa de recompensas deben conservar los sellos acumulados por tus clientes y respetar los premios obtenidos anteriormente."
              : "Changes to the rewards program must preserve customers' accumulated stamps and previously earned rewards."}
          </p>

        </aside>

      </div>
    </main>
  );
}
