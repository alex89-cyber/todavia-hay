
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

// ==========================================
// TODAVÍA HAY
// PANEL DE EMPLEADOS
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
  plan: string;
};

type Membership = {
  business: Business;
  role: string;
};

const ROLE_NAMES: Record<string, string> = {
  owner: "Propietario",
  manager: "Encargado",
  waiter: "Mesero",
  kitchen: "Cocina",
  staff: "Empleado",
};

// ==========================================
// PÁGINA
// ==========================================

export default function EmployeePage({
  params,
}: Props) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl p-6">
          Cargando panel de empleados...
        </main>
      }
    >
      <EmployeeContent params={params} />
    </Suspense>
  );
}

async function EmployeeContent({
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
        `/${lang}/empleado`,
      )}`,
    );
  }

  const db = admin();

  // ========================================
  // CONSULTAR NEGOCIOS AUTORIZADOS
  // ========================================

  const { data: memberRows, error: memberError } =
    await db
      .from("business_members")
      .select(
        "role, businesses(id, slug, name, plan)",
      )
      .eq("user_id", me.id);

  if (memberError) {
    throw new Error(
      "No se pudieron verificar tus permisos.",
    );
  }

  const memberships: Membership[] =
    (memberRows ?? [])
      .map((row) => ({
        business: row.businesses as unknown as
          Business | null,
        role: row.role as string,
      }))
      .filter(
        (row): row is Membership =>
          Boolean(row.business?.id) &&
          [
            "owner",
            "manager",
            "waiter",
            "kitchen",
            "staff",
          ].includes(row.role),
      );

  // Propietario sin roles operativos:
  // usar su panel administrativo.
  const staffMemberships = memberships.filter(
    (item) => item.role !== "owner",
  );

  if (
    staffMemberships.length === 0 &&
    memberships.some(
      (item) => item.role === "owner",
    )
  ) {
    redirect(`/${lang}/mis-negocios`);
  }

  // ========================================
  // SIN NEGOCIOS ASIGNADOS
  // ========================================

  if (staffMemberships.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <h1 className="text-2xl font-black">
          Sin acceso a negocios
        </h1>

        <p className="mt-3 text-sm text-gray-600">
          Tu cuenta funciona, pero todavía
          no tienes un perfil de empleado
          asignado a un negocio.
        </p>

        <Link
          href={`/${lang}/cuenta`}
          className="mt-5 inline-block font-bold underline"
        >
          Volver a mi cuenta
        </Link>
      </main>
    );
  }

  // ========================================
  // CONSULTAR PEDIDOS
  // ========================================
  //
  // Solo pedidos de negocios donde
  // está autorizado el empleado.
  //
  // No exponemos teléfonos, datos
  // personales ni NIP de recogida.

  const businessIds = staffMemberships.map(
    (item) => item.business.id,
  );

  // Hoy, en hora de México.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
  }).format(new Date());
  const dayStart = new Date(`${today}T00:00:00-06:00`).toISOString();

  const [ordersRes, tabsRes] = await Promise.all([
    db
      .from("reservations")
      .select("id, status, created_at")
      .in("business_id", businessIds)
      .gte("created_at", dayStart),
    db
      .from("table_tabs")
      .select("id, status, opened_at")
      .in("business_id", businessIds)
      .or(`status.eq.open,opened_at.gte.${dayStart}`),
  ]);

  if (ordersRes.error || tabsRes.error) {
    throw new Error(
      "No se pudieron cargar los pedidos.",
    );
  }

  // Pedidos = apartados de la app + cuentas de mesa.
  const orders = ordersRes.data ?? [];
  const tabs = tabsRes.data ?? [];

  const pending =
    orders.filter(
      (order) =>
        ![
          "captured",
          "voided",
          "expired",
        ].includes(order.status as string),
    ).length +
    tabs.filter((tab) => tab.status === "open").length;

  const totalToday =
    orders.length +
    tabs.filter(
      (tab) =>
        tab.status !== "cancelled" &&
        (tab.opened_at as string) >= dayStart,
    ).length;

  const es = lang === "es";

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">

      {/* ENCABEZADO */}

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#A8321E]">
            Todavía Hay · Personal
          </p>

          <h1 className="mt-2 text-3xl font-black text-[#244D38]">
            {es
              ? "Mi panel de trabajo"
              : "My staff dashboard"}
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            {me.email}
          </p>
        </div>

        <form
          action={`/api/auth/signout?next=/${lang}/login`}
          method="post"
        >
          <button
            type="submit"
            className="rounded-full border border-[#DDD3C7] px-5 py-2.5 text-sm font-bold"
          >
            Cerrar sesión
          </button>
        </form>
      </header>

      {/* NEGOCIOS ASIGNADOS */}

      <section className="mt-8">
        <h2 className="text-xl font-black">
          Mis establecimientos
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {staffMemberships.map((item) => (
            <article
              key={item.business.id}
              className="rounded-3xl border border-[#E8DDCF] bg-white p-5"
            >
              <div className="text-3xl">
                🏪
              </div>

              <h3 className="mt-3 text-lg font-black">
                {item.business.name}
              </h3>

              <p className="mt-2 text-sm text-[#806D5D]">
                Perfil:{" "}
                {ROLE_NAMES[item.role] ??
                  item.role}
              </p>

              <p className="mt-3 text-xs text-gray-500">
                Tienes acceso únicamente a
                las funciones autorizadas
                para este establecimiento.
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* RESUMEN */}

      <section className="mt-8 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[#F5E9DF] p-5">
          <p className="text-sm text-[#806D5D]">
            Pedidos activos
          </p>

          <p className="mt-2 text-3xl font-black">
            {pending}
          </p>
        </div>

        <div className="rounded-2xl bg-[#EAF3E8] p-5">
          <p className="text-sm text-[#4E7057]">
            Pedidos totales de hoy
          </p>

          <p className="mt-2 text-3xl font-black">
            {totalToday}
          </p>
        </div>
      </section>

            
        {/* ACCESO REAL A MESAS PARA MESEROS Y ENCARGADOS */}
        <section className="mt-8">
        <h2 className="text-xl font-black">
            Mesas del restaurante
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {staffMemberships
            .filter(
                (item) =>
                (item.role === "waiter" ||
                    item.role === "manager") &&
                (item.business.plan === "medium" ||
                    item.business.plan === "plus"),
            )
            .map((item) => (
                <Link
                key={item.business.id}
                href={`/${lang}/empleado/mesas/${item.business.slug}`}
                className="block rounded-2xl border border-[#eaded3] bg-white p-5 transition hover:border-[#a3341f] hover:shadow-md"
                >
                <p className="text-3xl">🍽️</p>

                <h3 className="mt-3 font-black">
                    Mesas · {item.business.name}
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                    Consultar las mesas habilitadas y su capacidad.
                </p>

                <p className="mt-3 text-sm font-bold text-[#a3341f]">
                    Abrir mesas →
                </p>
                </Link>
            ))}
        </div>
        </section>


    </main>
  );
}
