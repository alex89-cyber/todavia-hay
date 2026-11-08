
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

import {
  StaffManager,
  type StaffMember,
} from "@/components/StaffManager";

// ==========================================
// TODAVÍA HAY
// PANEL DE PERSONAL
// ACCESO SEGÚN PLAN CONTRATADO
// ==========================================

type Props = {
  params: Promise<{
    lang: string;
    slug: string;
  }>;
};

type BusinessPlan = "basic" | "medium" | "plus";

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================
//
// Suspense permite que Next.js cargue
// los datos dinámicos de la sesión y
// de Supabase correctamente.
// ==========================================

export default function PersonalPage({
  params,
}: Props) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          <p className="text-sm text-[#786B62]">
            Cargando administración de personal...
          </p>
        </main>
      }
    >
      <PersonalContent params={params} />
    </Suspense>
  );
}

// ==========================================
// CONTENIDO PROTEGIDO
// ==========================================

async function PersonalContent({
  params,
}: Props) {
  const { lang, slug } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  await connection();

  // ========================================
  // COMPROBAR SESIÓN
  // ========================================

  const me = await currentAccount();

  if (!me) {
    redirect(
      `/${lang}/negocios/login`,
    );
  }

  const db = admin();

  // ========================================
  // CONSULTAR NEGOCIO Y PLAN
  // ========================================

  const {
    data: business,
    error: businessError,
  } = await db
    .from("businesses")
    .select("id, name, plan")
    .eq("slug", slug)
    .maybeSingle();

  if (businessError) {
    throw new Error(
      "No se pudo consultar el negocio.",
    );
  }

  if (!business) {
    notFound();
  }

  // ========================================
  // COMPROBAR PROPIETARIO
  // ========================================
  //
  // Únicamente el propietario puede
  // administrar empleados.
  //
  // Un mesero o encargado no obtiene
  // estos permisos automáticamente.
  // ========================================

  const {
    data: owner,
    error: ownerError,
  } = await db
    .from("business_members")
    .select("role")
    .eq("business_id", business.id)
    .eq("user_id", me.id)
    .eq("role", "owner")
    .maybeSingle();

  if (ownerError) {
    throw new Error(
      "No se pudieron verificar los permisos.",
    );
  }

  if (!owner) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <h1 className="text-2xl font-black">
          Acceso restringido
        </h1>

        <p className="mt-3 text-sm text-[#786B62]">
          Solo el propietario de este
          negocio puede administrar
          al personal.
        </p>

        <Link
          href={`/${lang}`}
          className="mt-6 inline-block text-sm font-bold text-[#A8321E] underline"
        >
          Volver al inicio
        </Link>
      </main>
    );
  }

  // ========================================
  // COMPROBAR PLAN CONTRATADO
  // ========================================

  const plan = business.plan as BusinessPlan;

  if (
    plan !== "basic" &&
    plan !== "medium" &&
    plan !== "plus"
  ) {
    throw new Error(
      "El negocio no tiene un plan válido.",
    );
  }

  // ========================================
  // PLAN BÁSICO: BLOQUEAR PERSONAL
  // ========================================
  //
  // No eliminamos empleados.
  // No modificamos business_members.
  // No borramos cuentas de Supabase.
  // Solo bloqueamos la función.
  // ========================================

  if (plan === "basic") {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">

        <Link
          href={`/${lang}/panel/${slug}`}
          className="text-sm font-semibold text-[#A8321E] underline"
        >
          ← Volver al panel
        </Link>

        <header className="mb-8 mt-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#A8321E]">
            Administración del negocio
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Personal
          </h1>

          <p className="mt-2 text-sm text-[#786B62]">
            {business.name}
          </p>
        </header>

        <section className="rounded-3xl border border-[#E7D9CC] bg-white p-7 shadow-sm sm:p-9">

          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F1EA] text-3xl">
            🔒
          </div>

          <div className="mt-6 inline-flex rounded-full bg-[#F3EDE5] px-4 py-2 text-xs font-bold text-[#8F654E]">
            Plan Básico
          </div>

          <h2 className="mt-5 text-2xl font-black text-[#244D38]">
            Gestión de empleados
          </h2>

          <p className="mt-4 text-sm leading-7 text-[#786B62]">
            Tu negocio actualmente tiene
            contratado el plan Básico.
            La administración de empleados
            está disponible en los planes
            Medium y Plus.
          </p>

          <div className="mt-6 rounded-2xl bg-[#EDF4E9] p-5">
            <p className="font-bold text-[#244D38]">
              Tus empleados están protegidos
            </p>

            <p className="mt-2 text-sm leading-6 text-[#607768]">
              Si anteriormente utilizabas
              Medium o Plus, tus empleados,
              sus cuentas y sus permisos
              permanecen guardados.
              No perderás esta información
              por cambiar de plan.
            </p>

            <p className="mt-3 text-sm leading-6 text-[#607768]">
              Cuando vuelvas a contratar
              Medium o Plus, podrás recuperar
              la administración de tu personal
              sin registrarlos nuevamente.
            </p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">

            <div className="rounded-2xl border border-[#E7D9CC] p-4">
              <p className="text-sm font-black text-[#244D38]">
                Medium
              </p>

              <p className="mt-2 text-xs leading-5 text-[#786B62]">
                Meseros, encargados, mesas
                abiertas y cobros.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E7D9CC] p-4">
              <p className="text-sm font-black text-[#244D38]">
                Plus
              </p>

              <p className="mt-2 text-xs leading-5 text-[#786B62]">
                Todas las funciones de
                Medium y operación de cocina.
              </p>
            </div>
          </div>

          <Link
            href={`/${lang}/panel/${slug}`}
            className="mt-7 flex w-full items-center justify-center rounded-full bg-[#244D38] px-6 py-3.5 text-sm font-bold text-white hover:bg-[#32684C]"
          >
            Volver al panel del negocio
          </Link>
        </section>
      </main>
    );
  }

  // ========================================
  // MEDIUM Y PLUS: CONSULTAR PERSONAL
  // ========================================

  const {
    data: rows,
    error: membersError,
  } = await db
    .from("business_members")
    .select("user_id, role")
    .eq("business_id", business.id)
    .order("created_at", {
      ascending: true,
    });

  if (membersError) {
    throw new Error(
      "No se pudo consultar el personal.",
    );
  }

  const members: StaffMember[] =
    await Promise.all(
      (rows ?? []).map(async (row) => {
        const { data } =
          await db.auth.admin.getUserById(
            row.user_id,
          );

        return {
          id: row.user_id as string,
          email:
            data.user?.email ??
            "Cuenta sin correo disponible",
          role: row.role as string,
        };
      }),
    );

  // ========================================
  // PANTALLA DE PERSONAL
  // ========================================

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">

      <Link
        href={`/${lang}/panel/${slug}`}
        className="text-sm font-semibold text-[#A8321E] underline"
      >
        ← Volver al panel
      </Link>

      <header className="mb-8 mt-6">
        <p className="text-xs font-bold uppercase tracking-widest text-[#A8321E]">
          Administración del negocio
        </p>

        <h1 className="mt-2 text-3xl font-black">
          Personal
        </h1>

        <p className="mt-2 text-sm text-[#786B62]">
          {business.name}
        </p>

        <span className="mt-4 inline-flex rounded-full bg-[#EDF4E9] px-4 py-2 text-xs font-bold text-[#244D38]">
          {plan === "plus"
            ? "Plan Plus"
            : "Plan Medium"}
        </span>
      </header>

      {/* ====================================
          ADMINISTRADOR DE PERSONAL
         ==================================== */}

      <StaffManager
        slug={slug}
        members={members}
      />

      {/* ====================================
          INFORMACIÓN DEL PLAN
         ==================================== */}

      {plan === "medium" && (
        <section className="mt-6 rounded-2xl border border-[#E7D9CC] bg-[#FAF7F2] p-5">
          <p className="text-sm font-bold text-[#244D38]">
            Funciones de tu plan
          </p>

          <p className="mt-2 text-sm leading-6 text-[#786B62]">
            Puedes administrar meseros y
            encargados. La incorporación
            de personal de cocina está
            disponible en el plan Plus.
          </p>
        </section>
      )}

    </main>
  );
}
