
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { hasLocale } from "@/dictionaries";
import { admin } from "@/lib/accounts";

type Props = {
  params: Promise<{ lang: string }>;
};

export default function BusinessesPage({
  params,
}: Props) {
  return (
    <Suspense fallback={
      <p className="p-8">Cargando negocios...</p>
    }>
      <BusinessDirectory params={params} />
    </Suspense>
  );
}

async function BusinessDirectory({
  params,
}: Props) {
  const { lang } = await params;

  if (!hasLocale(lang)) notFound();

  await connection();

  const { data, error } = await admin()
    .from("businesses")
    .select("id, name, slug")
    .order("name");

  if (error) {
    throw new Error(
      "No se pudieron cargar los negocios."
    );
  }

  const es = lang === "es";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12">
      <header className="mb-10">
        <Link
          href={`/${lang}`}
          className="text-sm font-bold text-[#244D38] underline"
        >
          ← Todavía Hay
        </Link>

        <p className="mt-8 text-xs font-bold uppercase tracking-widest text-[#A8321E]">
          {es ? "Descubre y disfruta" : "Discover"}
        </p>

        <h1 className="mt-3 text-4xl font-black text-[#244D38]">
          {es
            ? "Explora negocios"
            : "Explore businesses"}
        </h1>

        <p className="mt-3 text-[#708076]">
          {es
            ? "Encuentra restaurantes, consulta sus menús y descubre qué tienen disponible."
            : "Find restaurants, explore menus and check availability."}
        </p>
      </header>

      {(data ?? []).length === 0 ? (
        <div className="rounded-3xl border bg-white p-8">
          Todavía no hay negocios para mostrar.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((business) => (
            <article
              key={business.id}
              className="flex flex-col rounded-3xl border border-[#E4EAE1] bg-white p-6 shadow-sm"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EDF3EA] text-3xl">
                🍽️
              </div>

              <h2 className="mt-5 text-xl font-black text-[#244D38]">
                {business.name}
              </h2>

              <p className="mt-2 text-sm text-[#708076]">
                {es
                  ? "Consulta su menú y disponibilidad."
                  : "Browse menu and availability."}
              </p>

              <Link
                href={`/${lang}/${business.slug}`}
                className="mt-6 rounded-full bg-[#244D38] px-5 py-3 text-center text-sm font-bold text-white hover:bg-[#32684C]"
              >
                {es
                  ? "Ver restaurante"
                  : "View restaurant"}
              </Link>
            </article>
          ))}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link
          href={`/${lang}/cuenta`}
          className="text-sm font-bold text-[#A8321E] underline"
        >
          {es
            ? "Ir a mi cuenta"
            : "My account"}
        </Link>
      </div>
    </main>
  );
}
