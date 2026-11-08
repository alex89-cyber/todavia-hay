
"use client";

import Link from "next/link";

type Props = {
  slug: string;
  lang: "es" | "en";
  signedIn: boolean;
};

/**
 * TODAVÍA HAY
 *
 * Invitación a registrarse para acumular recompensas.
 *
 * - Solo se muestra si el cliente no inició sesión.
 * - No depende de Gemini.
 * - Conserva el negocio de origen.
 * - El registro sigue siendo opcional.
 * - Las tarjetas se administran por negocio.
 */

export function RewardsChatInvite({
  slug,
  lang,
  signedIn,
}: Props) {
  // Si ya inició sesión, no mostrar invitación.
  if (signedIn) {
    return null;
  }

  const es = lang === "es";

  // Página del negocio a la que regresará el cliente.
  const back =
    `/${lang}/${encodeURIComponent(slug)}#chat`;

  // Guardar el destino en el parámetro next.
  const next = encodeURIComponent(back);

  const registerUrl =
    `/${lang}/registro?next=${next}`;

  const loginUrl =
    `/${lang}/login?next=${next}`;

  return (
    <aside
      aria-label={
        es
          ? "Programa de recompensas"
          : "Rewards program"
      }
      className="rounded-2xl border border-[#E8D7C9] bg-[#FFF8F2] p-4 text-[#402B22]"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="text-2xl"
        >
          🎁
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {es
              ? "¡No olvides tus recompensas!"
              : "Don't forget your rewards!"}
          </p>

          <p className="mt-1 text-sm leading-6">
            {es
              ? "Crea tu cuenta gratis para acumular sellos en este negocio y consultar tus pedidos. Puedes ordenar sin registrarte."
              : "Create a free account to earn stamps at this business and see your orders. You can order without registering."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {/* Registro de clientes */}
            <Link
              href={registerUrl}
              className="rounded-full bg-[#A8321E] px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
            >
              {es
                ? "Crear cuenta"
                : "Create account"}
            </Link>

            {/* Inicio de sesión */}
            <Link
              href={loginUrl}
              className="rounded-full border border-[#D8BFB2] bg-white px-4 py-2 text-sm font-bold transition hover:bg-[#FFF0E6]"
            >
              {es
                ? "Ya tengo cuenta"
                : "I have an account"}
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
