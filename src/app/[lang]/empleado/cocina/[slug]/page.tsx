import "server-only";

import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { currentAccount } from "@/lib/auth/server";
import { hasLocale } from "@/dictionaries";
import { kitchenAccess } from "@/lib/table-access";

import KitchenBoard from "@/components/KitchenBoard";

// ==========================================
// TODAVÍA HAY
// PANTALLA DE COCINA (PLAN PLUS)
// ==========================================

type Props = {
  params: Promise<{ lang: string; slug: string }>;
};

export default function KitchenPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-sm text-gray-600">Cargando cocina…</p>
        </main>
      }
    >
      <KitchenContent params={params} />
    </Suspense>
  );
}

async function KitchenContent({ params }: Props) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  await connection();

  const es = lang === "es";
  const me = await currentAccount();
  if (!me) {
    redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/empleado/cocina/${slug}`)}`);
  }

  const access = await kitchenAccess(slug);
  if (!access.ok) {
    if (access.reason === "not_found") notFound();
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link href={`/${lang}/empleado`} className="font-bold text-[#a3341f]">
          ← {es ? "Volver a mi panel" : "Back to dashboard"}
        </Link>
        <div className="mt-6 rounded-2xl border bg-white p-6">
          <h1 className="text-2xl font-black">
            {access.reason === "plan"
              ? es ? "Cocina no disponible" : "Kitchen unavailable"
              : es ? "Acceso restringido" : "Restricted access"}
          </h1>
          <p className="mt-3 text-gray-600">
            {access.reason === "plan"
              ? es
                ? "La pantalla de cocina está en el plan Plus."
                : "The kitchen screen is part of the Plus plan."
              : es
                ? "No tienes permiso para ver la cocina de este negocio."
                : "You do not have permission to view this kitchen."}
          </p>
        </div>
      </main>
    );
  }

  const backHref = access.role === "owner" ? `/${lang}/panel/${slug}` : `/${lang}/empleado`;

  return (
    <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-8 sm:px-6">
      <header>
        <Link href={backHref} className="text-sm font-bold text-[#a3341f] hover:underline">
          ← {es ? "Volver a mi panel" : "Back to dashboard"}
        </Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-widest text-[#a3341f]">
          {es ? "COCINA" : "KITCHEN"}
        </p>
        <h1 className="mt-2 text-3xl font-black text-[#302018]">
          {es ? "Comandas" : "Tickets"}
        </h1>
        <p className="mt-2 text-sm text-gray-600">{access.businessName}</p>
      </header>

      <KitchenBoard slug={slug} lang={es ? "es" : "en"} />
    </main>
  );
}
