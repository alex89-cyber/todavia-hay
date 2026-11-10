
import { Suspense } from "react";
import Link from "next/link";

import {
  notFound,
  redirect,
} from "next/navigation";

import { connection } from "next/server";

import { hasLocale } from "@/dictionaries";

import { authEnabled } from "@/lib/auth/config";
import { currentAccount } from "@/lib/auth/server";

import {
  admin,
  accountCards,
  accountOrders,
} from "@/lib/accounts";

import { money } from "@/lib/format";
import { ProfileForm } from "@/components/ProfileForm";

// ==========================================
// TODAVÍA HAY
// CUENTA Y REDIRECCIÓN POR ROLES
// ==========================================
//
// CLIENTE:
// - Explorar negocios
// - Mi perfil
// - Mis recompensas
// - Mis pedidos
//
// PROPIETARIO:
// - Un negocio: panel del negocio
// - Varios negocios: Mis negocios
//
// EMPLEADO:
// - Mesero, cocina, encargado o staff
// - Panel de trabajo
//
// Los roles se comprueban en Supabase.
// ==========================================

type Props = {
  params: Promise<{
    lang: string;
  }>;
};

const STATUS: Record<string, string> = {
  held: "Pendiente",
  authorized: "Apartado",
  captured: "Entregado y pagado",
  seated: "Comió en el negocio",
  voided: "Cancelado",
  expired: "Vencido",
  ready: "Listo",
  pending: "Pendiente",
  preparing: "En preparación",
};

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================

export default function AccountPage({
  params,
}: Props) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Suspense
        fallback={
          <p className="text-muted">
            Cargando cuenta...
          </p>
        }
      >
        <AccountContent params={params} />
      </Suspense>
    </main>
  );
}

// ==========================================
// CONTENIDO DE LA CUENTA
// ==========================================

async function AccountContent({
  params,
}: Props) {
  const { lang } = await params;

  if (!hasLocale(lang) || !authEnabled()) {
    notFound();
  }

  await connection();

  // ========================================
  // VERIFICAR SESIÓN
  // ========================================

  const me = await currentAccount();

  if (!me) {
    redirect(
      `/${lang}/login?next=${encodeURIComponent(
        `/${lang}/cuenta`,
      )}`,
    );
  }

  const db = admin();

  // ========================================
  // CONSULTAR ROLES DEL USUARIO
  // ========================================

  const { data: memberRows, error: roleError } =
    await db
      .from("business_members")
      .select("role, businesses(slug, name)")
      .eq("user_id", me.id);

  if (roleError) {
    console.error(
      "Error consultando roles:",
      roleError.message,
    );

    throw new Error(
      "No se pudieron verificar los permisos de tu cuenta.",
    );
  }

  // ========================================
  // IDENTIFICAR NEGOCIOS DEL PROPIETARIO
  // ========================================

  const ownedBusinesses = (memberRows ?? [])
    .filter((row) => row.role === "owner")
    .map(
      (row) =>
        row.businesses as unknown as {
          slug: string;
          name: string;
        } | null,
    )
    .filter(
      (
        business,
      ): business is {
        slug: string;
        name: string;
      } => Boolean(business?.slug),
    );

  // ========================================
  // PROPIETARIO DE UN NEGOCIO
  // ========================================

  if (ownedBusinesses.length === 1) {
    redirect(
      `/${lang}/panel/${encodeURIComponent(
        ownedBusinesses[0].slug,
      )}`,
    );
  }

  // ========================================
  // PROPIETARIO DE VARIOS NEGOCIOS
  // ========================================

  if (ownedBusinesses.length > 1) {
    redirect(`/${lang}/mis-negocios`);
  }

  // ========================================
  // IDENTIFICAR EMPLEADOS
  // ========================================

  const employeeRoles = [
    "manager",
    "waiter",
    "kitchen",
    "staff",
  ];

  const isEmployee = (memberRows ?? []).some(
    (row) =>
      employeeRoles.includes(
        row.role as string,
      ),
  );

  // ========================================
  // REDIRIGIR EMPLEADOS
  // ========================================

  if (isEmployee) {
    redirect(`/${lang}/empleado`);
  }

  // ========================================
  // REDIRIGIR SUPERADMINISTRADORES
  // ========================================

  const { data: platformRole, error: platformError } =
    await db
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", me.id)
      .maybeSingle();

  if (platformError) {
    throw new Error(
      "No se pudo verificar el acceso a la plataforma.",
    );
  }

  if (platformRole) {
    redirect(`/${lang}/admin`);
  }

  // ========================================
  // CUENTA NORMAL DE CLIENTE
  // ========================================

  const es = lang === "es";

  const [cards, orders] = await Promise.all([
    accountCards(me.id),
    accountOrders(me.id),
  ]);

  function when(iso: string) {
    return new Intl.DateTimeFormat(
      es ? "es-MX" : "en-US",
      {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Mexico_City",
      },
    ).format(new Date(iso));
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ====================================
          ENCABEZADO DEL CLIENTE
         ==================================== */}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">
            {es ? "Mi cuenta" : "My account"}
          </h1>

          <p className="mt-1 text-sm text-muted">
            {me.email}
          </p>
        </div>

        <form
          action={`/api/auth/signout?next=/${lang}`}
          method="post"
        >
          <button
            type="submit"
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold"
          >
            {es ? "Cerrar sesión" : "Sign out"}
          </button>
        </form>
      </header>

      {/* ====================================
          EXPLORAR NEGOCIOS
         ==================================== */}

      <section className="overflow-hidden rounded-3xl border border-[#DCE8D7] bg-[#EDF4E9] p-6 sm:p-7">

        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
            🍽️
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-widest text-[#54815B]">
              {es
                ? "Descubre Todavía Hay"
                : "Discover Todavía Hay"}
            </p>

            <h2 className="mt-2 text-2xl font-black text-[#244D38]">
              {es
                ? "¿Qué se te antoja hoy?"
                : "What are you craving today?"}
            </h2>

            <p className="mt-3 text-sm leading-7 text-[#607768]">
              {es
                ? "Explora los negocios disponibles en Todavía Hay, consulta sus menús y realiza tus pedidos desde un solo lugar."
                : "Explore businesses on Todavía Hay, browse their menus and place orders in one place."}
            </p>
          </div>
        </div>

        <Link
          href={`/${lang}/negocios`}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#244D38] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#32684C]"
        >
          <span aria-hidden="true">🔎</span>

          {es
            ? "Explorar negocios"
            : "Explore businesses"}

          <span aria-hidden="true">→</span>
        </Link>
      </section>

      {/* ====================================
          ACCESOS RÁPIDOS
         ==================================== */}

      <section className="grid grid-cols-2 gap-3">

        <a
          href="#mis-sellos"
          className="rounded-2xl border border-[#E7D9CC] bg-white p-4 transition hover:border-[#244D38]"
        >
          <span className="text-2xl">⭐</span>

          <h2 className="mt-3 font-black text-[#244D38]">
            {es ? "Mis sellos" : "My stamps"}
          </h2>

          <p className="mt-1 text-xs text-[#786B62]">
            {es
              ? "Consulta tus recompensas."
              : "Check your rewards."}
          </p>
        </a>

        <a
          href="#mis-pedidos"
          className="rounded-2xl border border-[#E7D9CC] bg-white p-4 transition hover:border-[#244D38]"
        >
          <span className="text-2xl">🧾</span>

          <h2 className="mt-3 font-black text-[#244D38]">
            {es ? "Mis pedidos" : "My orders"}
          </h2>

          <p className="mt-1 text-xs text-[#786B62]">
            {es
              ? "Consulta tus compras."
              : "View your orders."}
          </p>
        </a>
      </section>

      {/* ====================================
          PERFIL DEL CLIENTE
         ==================================== */}

      <ProfileForm
        lang={lang}
        initial={{
          firstName: me.firstName,
          lastName: me.lastName,
          phone: me.phone,
        }}
      />

      {/* ====================================
          RECOMPENSAS DEL CLIENTE
         ==================================== */}

      <section
        id="mis-sellos"
        className="scroll-mt-8 rounded-3xl border border-line bg-surface p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">
            {es ? "Mis sellos" : "My stamps"}
          </h2>

          <span className="text-xl">⭐</span>
        </div>

        {cards.length === 0 ? (
          <div className="mt-4">
            <p className="text-sm leading-6 text-muted">
              {es
                ? "Todavía no tienes sellos. Los pedidos entregados y pagados pueden generar recompensas según las reglas del negocio."
                : "You don't have any stamps yet. Eligible delivered and paid orders can earn rewards."}
            </p>

            <Link
              href={`/${lang}/negocios`}
              className="mt-4 inline-block text-sm font-bold text-[#A8321E] underline"
            >
              {es
                ? "Descubrir restaurantes"
                : "Discover restaurants"}
            </Link>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {cards.map((card) => (
              <li
                key={card.slug}
                className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"
              >
                <Link
                  href={`/${lang}/${card.slug}`}
                  className="font-semibold text-brand underline"
                >
                  {card.name}
                </Link>

                <span className="font-bold">
                  ⭐ {card.stamps}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ====================================
          HISTORIAL DE PEDIDOS
         ==================================== */}

      <section
        id="mis-pedidos"
        className="scroll-mt-8 rounded-3xl border border-line bg-surface p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">
            {es ? "Mis pedidos" : "My orders"}
          </h2>

          <span className="text-xl">🧾</span>
        </div>

        {orders.length === 0 ? (
          <div className="mt-4">
            <p className="text-sm leading-6 text-muted">
              {es
                ? "Todavía no has realizado pedidos desde tu cuenta."
                : "You haven't placed any orders from your account yet."}
            </p>

            <Link
              href={`/${lang}/negocios`}
              className="mt-4 inline-block text-sm font-bold text-[#A8321E] underline"
            >
              {es
                ? "Explorar negocios"
                : "Explore businesses"}
            </Link>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {orders.map((order) => {
              const status =
                STATUS[order.status] ??
                order.status;

              return (
                <li
                  key={order.id}
                  className="rounded-xl border border-line p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">

                    <div>
                      <Link
                        href={`/${lang}/${order.slug}`}
                        className="font-semibold text-brand underline"
                      >
                        {order.business}
                      </Link>

                      {order.orderNumber !== null && (
                        <p className="mt-1 text-sm">
                          Pedido #{order.orderNumber}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-muted">
                        {when(order.createdAt)}
                      </p>

                      {order.pickupAt && (
                        <p className="mt-1 text-xs text-muted">
                          {es ? "Recogida: " : "Pickup: "}
                          {when(order.pickupAt)}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="font-bold">
                        {money(
                          order.totalCents,
                          "MXN",
                          lang,
                        )}
                      </p>

                      <p className="mt-2 text-xs text-muted">
                        {status}
                      </p>
                    </div>

                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ====================================
          VOLVER AL DIRECTORIO
         ==================================== */}

      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <Link
          href={`/${lang}/negocios`}
          className="text-sm font-bold text-[#244D38] underline"
        >
          {es
            ? "🍽️ Explorar todos los negocios"
            : "🍽️ Explore all businesses"}
        </Link>

        <Link
          href={`/${lang}`}
          className="text-sm font-semibold text-brand underline"
        >
          {es
            ? "Volver a Todavía Hay"
            : "Back to Todavía Hay"}
        </Link>
      </div>

    </div>
  );
}
