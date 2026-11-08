
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { connection } from "next/server";

import {
  type Confirmation,
  PublicStall,
  type StampCardInfo,
} from "@/components/PublicStall";

import {
  heldOrder,
  heldOrders,
} from "@/lib/holds";

import {
  getDictionary,
  hasLocale,
} from "@/dictionaries";

import { vapidPublicKey } from "@/lib/push";

import {
  HOLDS_COOKIE,
  PAYER_COOKIE,
  publicSnapshot,
  type StallState,
} from "@/lib/stall";

import { loadStall } from "@/lib/reservations";
import { store } from "@/lib/store";

import { currentAccount } from "@/lib/auth/server";
import { authEnabled } from "@/lib/auth/config";
import { accountCard } from "@/lib/accounts";

// ==========================================
// TODAVÍA HAY
// PÁGINA PÚBLICA DEL NEGOCIO
// ==========================================
//
// - Pedidos sin PayPal
// - Pago contra entrega
// - NIP de recogida
// - Tarjetas de recompensas
// - Teléfono opcional
// - Compatible con cuentas futuras
// - Datos actualizados desde Supabase
//
// ==========================================

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================

export default function StallPage({
  params,
  searchParams,
}: PageProps<"/[lang]/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <p className="text-muted">…</p>
        }
      >
        <Stall
          params={params}
          searchParams={searchParams}
        />
      </Suspense>
    </main>
  );
}

// ==========================================
// CARGAR INFORMACIÓN DEL NEGOCIO
// ==========================================

async function Stall({
  params,
  searchParams,
}: {
  params: PageProps<
    "/[lang]/[slug]"
  >["params"];

  searchParams: PageProps<
    "/[lang]/[slug]"
  >["searchParams"];
}) {
  const { lang, slug } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  // Obtener datos recientes por solicitud.
  await connection();

  const state = await loadStall(slug);

  if (!state) {
    notFound();
  }

  const t = await getDictionary(lang);
  const jar = await cookies();
  const search = await searchParams;

  // ========================================
  // CONFIRMACIÓN DE RESERVACIÓN
  // ========================================

  const confirmation = await confirmationFor(
    state,
    lang,
    search.apartado,
  );

  // ========================================
  // CLIENTE AUTENTICADO
  // ========================================

  const me = await currentAccount();

  // ========================================
  // PEDIDOS DEL CLIENTE
  // ========================================

  const holds = heldOrders(
    state,
    lang,
    jar.get(HOLDS_COOKIE)?.value,
    me?.id ?? null,
  );

  // Mantener compatibilidad con enlaces
  // existentes de confirmación.
  if (
    confirmation?.kind === "reserved" &&
    !holds.some(
      (hold) =>
        hold.id === confirmation.id,
    )
  ) {
    const {
      kind,
      name,
      ...hold
    } = confirmation;

    void kind;
    void name;

    holds.unshift(hold);
  }

  // ========================================
  // IDENTIFICADOR DE RECOMPENSAS
  // ========================================

  // Si el cliente inició sesión,
  // usamos su tarjeta de cuenta.
  //
  // Si no inició sesión, solo utilizamos
  // la tarjeta ya asociada a su navegador.
  //
  // NO buscamos tarjetas por nombre.
  // NO suponemos que todas las reservas
  // de un navegador pertenecen al mismo
  // cliente.
  //
  // En el futuro se puede vincular el
  // teléfono verificado con una cuenta.

  const payerId = me
    ? accountCard(me.id)
    : jar.get(PAYER_COOKIE)?.value;

  // ========================================
  // CONSULTAR SELLOS REALES
  // ========================================

  const stampCard = await stampCardFor(
    state,
    lang,
    payerId,
  );

  // ========================================
  // RENDERIZAR PÁGINA
  // ========================================

  return (
    <>
      <nav className="mb-4 flex justify-end gap-4 text-sm">
        {authEnabled() && !me && (
          <Link
            className="font-semibold text-brand underline"
            href={`/${lang}/registro?next=${encodeURIComponent(`/${lang}/${slug}#chat`)}`}
          >
            {lang === "es" ? "Crear cuenta" : "Sign up"}
          </Link>
        )}
        {authEnabled() && (
          <Link
            className="font-semibold text-brand underline"
            href={
              me
                ? `/${lang}/cuenta`
                : `/${lang}/login?next=${encodeURIComponent(
                    `/${lang}/${slug}`,
                  )}`
            }
          >
            {me
              ? lang === "es"
                ? "Mi cuenta"
                : "My account"
              : lang === "es"
                ? "Entrar"
                : "Sign in"}
          </Link>
        )}

        <Link
          className="text-muted underline"
          href={`/${
            lang === "es" ? "en" : "es"
          }/${slug}`}
        >
          {t.switchLang}
        </Link>
      </nav>

      <PublicStall
        initial={publicSnapshot(state)}
        lang={lang}
        timezone={state.timezone}
        confirmation={confirmation}
        holds={holds}
        stampCard={stampCard}
        vapidKey={vapidPublicKey()}
        signedIn={!!me}
        t={t}
      />
    </>
  );
}

// ==========================================
// CONFIRMACIÓN DE PEDIDO
// ==========================================

// Conserva compatibilidad con el parámetro
// ?apartado=... de la aplicación.
//
// No realiza cobros por PayPal.
//
// Esta función solo lee el pedido.

async function confirmationFor(
  state: StallState,
  lang: "es" | "en",
  value: string | string[] | undefined,
): Promise<Confirmation | null> {
  if (
    typeof value !== "string" ||
    !value
  ) {
    return null;
  }

  if (value === "cancelled") {
    return {
      kind: "cancelled",
    };
  }

  if (value === "error") {
    return {
      kind: "error",
    };
  }

  const reservation = await store
    .getReservation(state.slug, value)
    .catch(() => null);

  if (
    !reservation ||
    reservation.status === "voided" ||
    reservation.status === "expired"
  ) {
    return {
      kind: "error",
    };
  }

  // Se conserva el formato utilizado
  // por la interfaz existente.
  return {
    kind: "reserved",
    name: reservation.customerName,
    ...heldOrder(
      state,
      lang,
      reservation,
    ),
  };
}

// ==========================================
// CONSULTAR TARJETA DE SELLOS
// ==========================================

async function stampCardFor(
  state: StallState,
  lang: "es" | "en",
  payerId: string | undefined,
): Promise<StampCardInfo | null> {
  // Obtener el premio configurado.
  const reward = state.dishes.find(
    (dish) =>
      dish.id ===
      state.loyalty.rewardDishId,
  );

  if (!reward) {
    return null;
  }

  // null indica que todavía no tenemos
  // una tarjeta identificada.
  //
  // Es diferente de tener 0 sellos.

  let have: number | null = null;

  if (payerId) {
    try {
      // Consultar el número real de sellos
      // de la tarjeta asociada.
      have = await store.stamps(
        state.slug,
        payerId,
      );
    } catch (error) {
      console.error(
        "No se pudieron consultar los sellos:",
        error,
      );

      have = null;
    }
  }

  return {
    have,
    perReward:
      state.loyalty.stampsPerReward,

    reward:
      lang === "es"
        ? reward.nameEs
        : reward.nameEn,
  };
}
