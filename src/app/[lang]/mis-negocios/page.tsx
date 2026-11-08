import { Suspense } from "react";
import Link from "next/link";

import {
  notFound,
  redirect,
} from "next/navigation";

import { connection } from "next/server";

import { hasLocale } from "@/dictionaries";

import { currentAccount } from
  "@/lib/auth/server";

import { admin } from
  "@/lib/accounts";

// ==========================================
// TODAVÍA HAY
// MIS NEGOCIOS
// ==========================================
//
// Cada propietario puede administrar
// varios establecimientos con una cuenta.
//
// Solo se muestran negocios donde el
// usuario tiene rol "owner".
// ==========================================

type Props = {
  params: Promise<{
    lang: string;
  }>;
};

type Business = {
  id: string;
  slug: string;
  name: string;
};

export default function MyBusinessesPage({
  params,
}: Props) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-5xl px-4 py-10">
          <p>Cargando tus negocios...</p>
        </main>
      }
    >
      <MyBusinessesContent params={params} />
    </Suspense>
  );
}

async function MyBusinessesContent({
  params,
}: Props) {
  const { lang } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  await connection();

  const me = await currentAccount();

  if (!me) {
    redirect(
      `/${lang}/login?next=${encodeURIComponent(
        `/${lang}/mis-negocios`,
      )}`,
    );
  }

  const db = admin();

  // ========================================
  // BUSCAR NEGOCIOS DEL PROPIETARIO
  // ========================================

  const { data, error } = await db
    .from("business_members")
    .select(
      "business_id, businesses(id, slug, name)",
    )
    .eq("user_id", me.id)
    .eq("role", "owner");

  if (error) {
    throw new Error(
      "No se pudieron consultar tus negocios.",
    );
  }

  const businesses: Business[] = (data ?? [])
    .map((row) =>
      row.businesses as unknown as Business | null,
    )
    .filter(
      (business): business is Business =>
        Boolean(business?.slug),
    );

  // Si dejó de ser propietario,
  // no debe ver esta pantalla.
  if (businesses.length === 0) {
    redirect(`/${lang}/cuenta`);
  }

  const es = lang === "es";

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">

      {/* ENCABEZADO */}

      <header className="mb-9 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#A8321E]">
            Todavía Hay
          </p>

          <h1 className="mt-3 text-3xl font-black text-[#244D38]">
            {es
              ? "Mis negocios"
              : "My businesses"}
          </h1>

          <p className="mt-2 text-sm text-[#78877C]">
            {es
              ? "Selecciona el negocio que quieres administrar."
              : "Choose the business you want to manage."}
          </p>

          <p className="mt-2 text-xs text-[#78877C]">
            {me.email}
          </p>
        </div>

        <form
          action={`/api/auth/signout?next=/${lang}`}
          method="post"
        >
          <button
            type="submit"
            className="rounded-full border border-[#DDE5DA] px-5 py-2.5 text-sm font-semibold"
          >
            {es
              ? "Cerrar sesión"
              : "Sign out"}
          </button>
        </form>
      </header>

      {/* NEGOCIOS */}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {businesses.map((business) => (
          <article
            key={business.id}
            className="flex flex-col rounded-3xl border border-[#E4EAE1] bg-white p-6 shadow-sm"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3E8] text-2xl">
              🏪
            </div>

            <h2 className="mt-5 text-xl font-black text-[#244D38]">
              {business.name}
            </h2>

            <p className="mt-2 text-xs text-[#78877C]">
              {business.slug}
            </p>

            <p className="mt-3 text-sm font-medium text-[#4D6B55]">
              {es
                ? "Acceso de propietario"
                : "Owner access"}
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <Link
                href={`/${lang}/panel/${business.slug}`}
                className="rounded-full bg-[#244D38] px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-[#32684C]"
              >
                {es
                  ? "Administrar negocio"
                  : "Manage business"}
              </Link>

              <Link
                href={`/${lang}/panel/${business.slug}/personal`}
                className="rounded-full border border-[#DDE5DA] px-5 py-3 text-center text-sm font-bold text-[#244D38]"
              >
                {es
                  ? "Personal y empleados"
                  : "Staff and employees"}
              </Link>

              <Link
                href={`/${lang}/${business.slug}`}
                className="text-center text-sm font-semibold text-[#78877C] underline"
              >
                {es
                  ? "Ver página pública"
                  : "View public page"}
              </Link>
            </div>
          </article>
        ))}
      </div>

      {/* INFORMACIÓN */}

      <section className="mt-10 rounded-2xl bg-[#F3F7F0] p-5">
        <h2 className="font-bold text-[#244D38]">
          {es
            ? "Una cuenta, varios negocios"
            : "One account, multiple businesses"}
        </h2>

        <p className="mt-2 text-sm leading-7 text-[#607768]">
          {es
            ? "Puedes administrar todos tus negocios desde esta misma cuenta. Cada establecimiento conserva sus pedidos, inventario, ventas, personal y recompensas por separado."
            : "Manage all your businesses from one account. Orders, inventory, sales, staff and rewards remain separate for each business."}
        </p>
      </section>

    </main>
  );
}
