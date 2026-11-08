
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

const STATUS_NAMES: Record<string, string> = {
  held: "Pendiente",
  authorized: "Apartado",
  captured: "Entregado",
  voided: "Cancelado",
  expired: "Vencido",
  ready: "Listo",
  pending: "Pendiente",
  preparing: "Preparando",
};

function pesos(cents: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(cents / 100);
}

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
        "role, businesses(id, slug, name)",
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

  const { data: orders, error: ordersError } =
    await db
      .from("reservations")
      .select(
        "id, business_id, order_number, status, total_cents, created_at",
      )
      .in("business_id", businessIds)
      .order("created_at", {
        ascending: false,
      })
      .limit(40);

  if (ordersError) {
    throw new Error(
      "No se pudieron cargar los pedidos.",
    );
  }

  const pending = (orders ?? []).filter(
    (order) =>
      ![
        "captured",
        "voided",
        "expired",
      ].includes(order.status as string),
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
            Pedidos recientes
          </p>

          <p className="mt-2 text-3xl font-black">
            {(orders ?? []).length}
          </p>
        </div>
      </section>

      {/* PEDIDOS */}

      <section
        id="pedidos"
        className="mt-8 rounded-3xl border border-[#E8DDCF] bg-white p-5 sm:p-6"
      >
        <div>
          <h2 className="text-xl font-black">
            Pedidos del negocio
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Aquí aparecen los últimos
            pedidos registrados en tus
            establecimientos autorizados.
          </p>
        </div>

        {(orders ?? []).length === 0 ? (
          <p className="mt-6 rounded-xl bg-[#FAF6F1] p-4 text-sm">
            Todavía no hay pedidos para
            mostrar.
          </p>
        ) : (
          <div className="mt-5 divide-y divide-[#EEE5DA]">
            {(orders ?? []).map((order) => {
              const business =
                staffMemberships.find(
                  (item) =>
                    item.business.id ===
                    order.business_id,
                )?.business;

              const date =
                new Intl.DateTimeFormat(
                  "es-MX",
                  {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone:
                      "America/Mexico_City",
                  },
                ).format(
                  new Date(order.created_at),
                );

              return (
                <article
                  key={order.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-black">
                      Pedido{" "}
                      {order.order_number
                        ? `#${order.order_number}`
                        : ""}
                    </p>

                    <p className="mt-1 text-sm text-gray-600">
                      {business?.name ??
                        "Establecimiento"}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {date}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-black">
                      {pesos(
                        Number(
                          order.total_cents ?? 0,
                        ),
                      )}
                    </p>

                    <p className="mt-2 text-xs font-bold text-[#A8321E]">
                      {STATUS_NAMES[
                        order.status as string
                      ] ??
                        order.status}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* FUNCIONES FUTURAS */}

      <section className="mt-8">
        <h2 className="text-xl font-black">
          Herramientas del personal
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: "🍽️",
              title: "Mesas",
              description:
                "Tomar órdenes directamente desde las mesas.",
            },
            {
              icon: "👨‍🍳",
              title: "Cocina",
              description:
                "Gestionar la preparación y marcar pedidos listos.",
            },
            {
              icon: "💳",
              title: "Cobros",
              description:
                "Registrar pagos y entregas de pedidos.",
            },
            {
              icon: "🔔",
              title: "Notificaciones",
              description:
                "Recibir alertas de pedidos nuevos.",
            },
          ].map((tool) => (
            <div
              key={tool.title}
              className="rounded-2xl border border-[#E8DDCF] bg-[#FAF8F5] p-5"
            >
              <p className="text-3xl">
                {tool.icon}
              </p>

              <h3 className="mt-3 font-black">
                {tool.title}
              </h3>

              <p className="mt-2 text-sm text-gray-600">
                {tool.description}
              </p>

              <p className="mt-3 text-xs font-semibold text-[#A8321E]">
                Próximamente
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-gray-500">
        Acceso por correo y contraseña.
        El NIP rápido de seis dígitos
        todavía no está habilitado.
      </p>
    </main>
  );
}
    