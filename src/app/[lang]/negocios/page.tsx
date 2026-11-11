
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { hasLocale } from "@/dictionaries";
import { admin } from "@/lib/accounts";
import { currentAccount } from "@/lib/auth/server";
import { InstallAppButton } from "@/components/InstallAppButton";

type Props = {
  params: Promise<{ lang: string }>;
};

type BusinessSettings = {
  logoUrl?: string | null;
  taglineEs?: string | null;
  taglineEn?: string | null;
  descriptionEs?: string | null;
  descriptionEn?: string | null;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default function BusinessesPage({
  params,
}: Props) {
  return (
    <Suspense
      fallback={
        <p className="p-8">Cargando negocios...</p>
      }
    >
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

  const es = lang === "es";

  // Consultamos únicamente los datos necesarios.
  // Cada negocio tiene su propia configuración.
  const { data, error } = await admin()
    .from("businesses")
    .select("id, name, slug, settings")
    .order("name");

  if (error) {
    throw new Error(
      "No se pudieron cargar los negocios.",
    );
  }

  // Acceso directo al panel para empleados o dueños.
  const me = await currentAccount();
  let panel: string | null = null;

  if (me) {
    const { data: roles } = await admin()
      .from("business_members")
      .select("role")
      .eq("user_id", me.id);

    const list = (roles ?? []).map(
      (role) => role.role as string,
    );

    if (list.some((role) => role !== "owner")) {
      panel = `/${lang}/empleado`;
    } else if (list.includes("owner")) {
      panel = `/${lang}/mis-negocios`;
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12">
      <header className="mb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={me ? `/${lang}/cuenta` : `/${lang}`}
            className="text-sm font-bold text-[#244D38] underline"
          >
            {me
              ? es
                ? "← Mi cuenta"
                : "← My account"
              : "← Todavía Hay"}
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <InstallAppButton
              lang={es ? "es" : "en"}
            />

            {panel && (
              <Link
                href={panel}
                className="rounded-full bg-[#244D38] px-4 py-2 text-sm font-bold text-white hover:bg-[#32684C]"
              >
                {es ? "Mi panel" : "My dashboard"}
              </Link>
            )}

            <Link
              href={me ? `/${lang}/cuenta` : `/${lang}/login`}
              className="rounded-full border border-[#244D38] px-4 py-2 text-sm font-bold text-[#244D38]"
            >
              {me
                ? es
                  ? "Mi cuenta"
                  : "My account"
                : es
                  ? "Iniciar sesión"
                  : "Sign in"}
            </Link>
          </div>
        </div>

        <p className="mt-8 text-xs font-bold uppercase tracking-widest text-[#A8321E]">
          {es
            ? "DESCUBRE Y DISFRUTA"
            : "DISCOVER AND ENJOY"}
        </p>

        <h1 className="mt-3 text-4xl font-black text-[#244D38]">
          {es
            ? "Explora negocios"
            : "Explore businesses"}
        </h1>

        <p className="mt-3 text-[#708076]">
          {es
            ? "Descubre restaurantes, conoce sus especialidades y encuentra tu próximo lugar favorito."
            : "Discover restaurants, explore their specialties and find your next favorite place."}
        </p>
      </header>

      {(data ?? []).length === 0 ? (
        <div className="rounded-3xl border bg-white p-8">
          {es
            ? "Todavía no hay negocios para mostrar."
            : "There are no businesses to display yet."}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((business) => {
            const settings =
              (business.settings ?? {}) as BusinessSettings;

            const logoUrl = clean(settings.logoUrl);

            const tagline =
              clean(
                es
                  ? settings.taglineEs
                  : settings.taglineEn,
              ) ||
              clean(
                es
                  ? settings.taglineEn
                  : settings.taglineEs,
              );

            const description =
              clean(
                es
                  ? settings.descriptionEs
                  : settings.descriptionEn,
              ) ||
              clean(
                es
                  ? settings.descriptionEn
                  : settings.descriptionEs,
              );

            const initials =
              business.name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((word: string) => word.charAt(0))
                .join("")
                .toUpperCase() || "TH";

            return (
              <article
                key={business.id}
                className="flex h-full flex-col rounded-3xl border border-[#E4EAE1] bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              >
                {/* LOGO DEL RESTAURANTE */}

                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-[#EDF3EA]">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt={`Logo de ${business.name}`}
                      className="h-full w-full object-contain p-1"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-2xl font-black text-[#244D38]">
                      {initials}
                    </span>
                  )}
                </div>

                {/* NOMBRE DEL RESTAURANTE */}

                <h2 className="mt-5 text-xl font-black text-[#244D38]">
                  {business.name}
                </h2>

                {/* ESLOGAN */}

                {tagline && (
                  <p className="mt-2 text-sm font-bold leading-6 text-[#A8321E]">
                    {tagline}
                  </p>
                )}

                {/* DESCRIPCIÓN */}

                <p className="mt-3 line-clamp-4 text-sm leading-6 text-[#708076]">
                  {description ||
                    (es
                      ? "Descubre los platillos y especialidades que este restaurante tiene para ti."
                      : "Discover this restaurant's dishes and specialties.")}
                </p>

                {/* ENLACE AL NEGOCIO */}

                <Link
                  href={`/${lang}/${business.slug}`}
                  className="mt-auto block pt-6"
                >
                  <span className="block rounded-full bg-[#244D38] px-5 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-[#32684C]">
                    {es
                      ? "Ver restaurante"
                      : "View restaurant"}
                  </span>
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
