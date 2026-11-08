
import { Suspense } from "react";
import Link from "next/link";

import {
  notFound,
  redirect,
} from "next/navigation";

import { connection } from "next/server";

import { hasLocale } from "@/dictionaries";
import { currentAccount } from "@/lib/auth/server";
import { admin } from "@/lib/accounts";
import { platformAdmin } from "@/lib/platform-admin";

import {
  PlatformAdminPanel,
  type PlatformBusiness,
} from "@/components/PlatformAdminPanel";

type Props = {
  params: Promise<{ lang: string }>;
};

export default function AdminPage({
  params,
}: Props) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl p-8">
          Cargando administración...
        </main>
      }
    >
      <AdminContent params={params} />
    </Suspense>
  );
}

async function AdminContent({
  params,
}: Props) {
  const { lang } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  await connection();

  const account = await currentAccount();

  if (!account) {
    redirect(`/${lang}/admin/login`);
  }

  const authorized = await platformAdmin();

  if (!authorized) {
    return (
      <main className="mx-auto max-w-lg px-5 py-20">
        <h1 className="text-2xl font-black">
          Acceso restringido
        </h1>

        <p className="mt-3 text-sm text-gray-600">
          Esta sección es exclusiva
          para los socios autorizados
          de Todavía Hay.
        </p>

        <Link
          href={`/${lang}`}
          className="mt-6 inline-block font-bold underline"
        >
          Volver al inicio
        </Link>
      </main>
    );
  }

  // Leer negocios solo después de
  // comprobar el permiso global.
  const { data, error } = await admin()
    .from("businesses")
    .select("id, name, slug, plan")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(
      "No se pudieron cargar los negocios.",
    );
  }

  const businesses: PlatformBusiness[] =
    (data ?? []).map((business) => ({
      id: business.id as string,
      name: business.name as string,
      slug: business.slug as string,
      plan:
        business.plan === "plus"
          ? "plus"
          : business.plan === "medium"
            ? "medium"
            : "basic",
    }));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">

      <header className="mb-9 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#A8321E]">
            Todavía Hay · Socios
          </p>

          <h1 className="mt-3 text-3xl font-black text-[#244D38]">
            Administración de plataforma
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Negocios y planes contratados
          </p>

          <p className="mt-2 text-xs text-gray-500">
            {account.email}
          </p>
        </div>

        <form
          action={`/api/auth/signout?next=/${lang}/admin/login`}
          method="post"
        >
          <button
            type="submit"
            className="rounded-full border border-[#DDD3C7] px-5 py-2.5 text-sm font-semibold"
          >
            Cerrar sesión
          </button>
        </form>
      </header>

      <PlatformAdminPanel
        businesses={businesses}
      />

    </main>
  );
}
