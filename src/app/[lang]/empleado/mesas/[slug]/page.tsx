
import "server-only";

import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { currentAccount } from "@/lib/auth/server";
import { hasLocale } from "@/dictionaries";
import { canConfigure, tableAccess } from "@/lib/table-access";

import RestaurantTables from "@/components/RestaurantTables";
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
  const isOwnerRole = access.role === "owner";
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
          {isOwnerRole
            ? es ? "Tus mesas" : "Your tables"
            : es ? "Abrir mesa, pedir y cobrar" : "Open, order and charge"}
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          {business.name}
          {isOwnerRole &&
            (es
              ? " · Aquí agregas y editas mesas y ves cómo están. Los meseros las atienden desde su panel."
              : " · Add and edit tables and see how they are doing. Waiters serve them from their dashboard.")}
        </p>
      </header>

      {isOwnerRole ? (
        <>
          <div className="mt-8">
            <RestaurantTables slug={slug} lang={lang} />
          </div>

          <section className="mt-10">
            <h2 className="text-xl font-black text-[#302018]">
              {es ? "Cómo están ahora" : "Right now"}
            </h2>
            <StaffTablesManager slug={slug} lang={es ? "es" : "en"} readOnly />
          </section>
        </>
      ) : (
        <>
          <StaffTablesManager slug={slug} lang={es ? "es" : "en"} />

          {canConfigure(access.role) && (
            <details className="mt-10 rounded-2xl border border-[#eaded3] bg-white p-4">
              <summary className="cursor-pointer text-sm font-bold text-[#302018]">
                {es ? "Agregar o editar mesas" : "Add or edit tables"}
              </summary>
              <div className="mt-4">
                <RestaurantTables slug={slug} lang={lang} />
              </div>
            </details>
          )}
        </>
      )}
    </main>
  );
}
