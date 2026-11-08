
import "server-only";

import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { admin } from "@/lib/accounts";
import { currentAccount } from "@/lib/auth/server";
import { hasLocale } from "@/dictionaries";

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

  const db = admin();

  // Consultar el negocio.
  const { data: business, error: businessError } =
    await db
      .from("businesses")
      .select("id, name, plan")
      .eq("slug", slug)
      .maybeSingle();

  if (businessError) {
    throw new Error("No se pudo cargar el restaurante.");
  }

  if (!business) {
    notFound();
  }

  // Validar al empleado.
  const { data: membership, error: memberError } =
    await db
      .from("business_members")
      .select("role")
      .eq("business_id", business.id)
      .eq("user_id", me.id)
      .in("role", ["waiter", "manager"])
      .maybeSingle();

  if (memberError) {
    throw new Error("No se pudieron verificar los permisos.");
  }

  if (!membership) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href={`/${lang}/empleado`}
          className="font-bold text-[#a3341f]"
        >
          ← Volver a mi panel
        </Link>

        <div className="mt-6 rounded-2xl border bg-white p-6">
          <h1 className="text-2xl font-black">
            {es ? "Acceso restringido" : "Restricted access"}
          </h1>

          <p className="mt-3 text-gray-600">
            {es
              ? "No tienes permisos para gestionar las mesas de este restaurante."
              : "You do not have permission to manage tables."}
          </p>
        </div>
      </main>
    );
  }

  if (business.plan !== "medium") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href={`/${lang}/empleado`}
          className="font-bold text-[#a3341f]"
        >
          ← Volver a mi panel
        </Link>

        <div className="mt-6 rounded-2xl border bg-white p-6">
          <h1 className="text-2xl font-black">
            {es ? "Mesas no disponibles" : "Tables unavailable"}
          </h1>

          <p className="mt-3 text-gray-600">
            {es
              ? "Esta función está habilitada para el plan Medium."
              : "This feature is available on the Medium plan."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <header>
        <Link
          href={`/${lang}/empleado`}
          className="text-sm font-bold text-[#a3341f] hover:underline"
        >
          ← {es ? "Volver a mi panel" : "Back to dashboard"}
        </Link>

        <p className="mt-6 text-xs font-bold uppercase tracking-widest text-[#a3341f]">
          {es ? "PANEL DEL MESERO" : "WAITER DASHBOARD"}
        </p>

        <h1 className="mt-2 text-3xl font-black text-[#302018]">
          {es ? "Mesas del restaurante" : "Restaurant tables"}
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
