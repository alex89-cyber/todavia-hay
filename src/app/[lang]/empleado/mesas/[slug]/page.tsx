
import "server-only";

import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { currentAccount } from "@/lib/auth/server";
import { hasLocale } from "@/dictionaries";
import { tableAccess } from "@/lib/table-access";

import StaffTablesManager from "@/components/StaffTablesManager";

type Props = {
  params: Promise<{
    lang: string;
    slug: string;
  }>;
};

export default function EmployeeTablesPage({
  params,
}: Props) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-sm text-gray-600">
            Cargando mesas del restaurante...
          </p>
        </main>
      }
    >
      <EmployeeTablesContent params={params} />
    </Suspense>
  );
}

async function EmployeeTablesContent({
  params,
}: Props) {
  const { lang, slug } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  await connection();

  const es = lang === "es";
  const me = await currentAccount();

  if (!me) {
    redirect(
      `/${lang}/login?next=${encodeURIComponent(
        `/${lang}/empleado/mesas/${slug}`,
      )}`,
    );
  }

  const access = await tableAccess(slug);

  if (!access.ok) {
    if (access.reason === "not_found") notFound();

    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href={`/${lang}/empleado`}
          className="font-bold text-[#a3341f]"
        >
          ← {es ? "Volver a mi panel" : "Back to dashboard"}
        </Link>

        <div className="mt-6 rounded-2xl border bg-white p-6">
          <h1 className="text-2xl font-black">
            {access.reason === "plan"
              ? es ? "Mesas no disponibles" : "Tables unavailable"
              : es ? "Acceso restringido" : "Restricted access"}
          </h1>

          <p className="mt-3 text-gray-600">
            {access.reason === "plan"
              ? es
                ? "Las mesas están en los planes Medium y Plus."
                : "Tables are part of the Medium and Plus plans."
              : es
                ? "No tienes permisos para gestionar las mesas de este restaurante."
                : "You do not have permission to manage tables."}
          </p>
        </div>
      </main>
    );
  }

  const business = { name: access.businessName };
  const backHref =
    access.role === "owner" ? `/${lang}/panel/${slug}` : `/${lang}/empleado`;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <header>
        <Link
          href={backHref}
          className="text-sm font-bold text-[#a3341f] hover:underline"
        >
          ← {es ? "Volver a mi panel" : "Back to dashboard"}
        </Link>

        <p className="mt-6 text-xs font-bold uppercase tracking-widest text-[#a3341f]">
          {es ? "MESAS" : "TABLES"}
        </p>

        <h1 className="mt-2 text-3xl font-black text-[#302018]">
          {es ? "Abrir mesa, pedir y cobrar" : "Open, order and charge"}
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          {business.name}
        </p>
      </header>

      <StaffTablesManager
        slug={slug}
        lang={es ? "es" : "en"}
      />
    </main>
  );
}
