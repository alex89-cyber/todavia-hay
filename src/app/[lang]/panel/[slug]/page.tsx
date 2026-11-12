
import { Suspense } from "react";
import Link from "next/link";

import { notFound } from "next/navigation";
import { connection } from "next/server";

import { PanelNoAccess } from "@/components/PanelNoAccess";
import { OwnerPanel } from "@/components/OwnerPanel";

import {
  getDictionary,
  hasLocale,
} from "@/dictionaries";

import { ownerView } from "@/lib/stall";
import { businessHasKitchen, businessHasTables } from "@/lib/table-access";

import {
  isOwner,
  ownerPinRequired,
} from "@/lib/owner-auth";

import { loadStall } from "@/lib/reservations";
import { vapidPublicKey } from "@/lib/push";

// ==========================================
// TODAVÍA HAY
// PANEL ADMINISTRATIVO DEL NEGOCIO
// ==========================================
//
// Funciones:
// - Verificar acceso del propietario.
// - Mostrar el panel actual.
// - Acceder a Personal y empleados.
// - Conservar pedidos e inventario.
// - Conservar ventas y recompensas.
//
// ==========================================

type PanelRouteProps = {
  params: Promise<{
    lang: string;
    slug: string;
  }>;
};

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================

export default function PanelPage({
  params,
}: PanelRouteProps) {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col">
      <Suspense
        fallback={
          <p className="p-4 text-muted">
            Cargando panel...
          </p>
        }
      >
        <Panel params={params} />
      </Suspense>
    </main>
  );
}

// ==========================================
// CONTENIDO DEL PANEL
// ==========================================

async function Panel({
  params,
}: {
  params: PanelRouteProps["params"];
}) {
  const { lang, slug } = await params;

  // Verificar idioma.
  if (!hasLocale(lang)) {
    notFound();
  }

  await connection();

  // Cargar información del negocio.
  const state = await loadStall(slug);

  if (!state) {
    notFound();
  }

  // Cargar traducciones.
  const t = await getDictionary(lang);

  // ========================================
  // VERIFICAR ACCESO
  // ========================================

  const authorized = await isOwner(slug);

  if (!authorized) {
    return (
      <PanelNoAccess
        lang={lang}
        stallName={state.name}
        back={`/${lang}/panel/${slug}`}
      />
    );
  }

  // ========================================
  // PANEL DEL PROPIETARIO
  // ========================================

  return (
    <div className="flex w-full flex-col">

      {/* ====================================
          ACCESO A PERSONAL Y EMPLEADOS
         ==================================== */}

      <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center justify-end gap-3 px-4 pt-5 sm:px-6">

        <Link
          href={`/${lang}/panel/${slug}/personal`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#244D38] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#32684C]"
        >
          <span aria-hidden="true">
            👥
          </span>

          <span>
            {lang === "es"
              ? "Personal y empleados"
              : "Staff and employees"}
          </span>
        </Link>

      </div>

      {/* ====================================
          PANEL ACTUAL DEL NEGOCIO
         ==================================== */}

      <OwnerPanel
        initial={ownerView(state)}
        lang={lang}
        timezone={state.timezone}
        t={t}
        canSignOut={ownerPinRequired()}
        vapidKey={vapidPublicKey()}
        tablesEnabled={await businessHasTables(slug)}
        kitchenEnabled={await businessHasKitchen(slug)}
      />

    </div>
  );
}
