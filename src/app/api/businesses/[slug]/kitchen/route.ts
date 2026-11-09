import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { admin } from "@/lib/accounts";
import { sameOrigin } from "@/lib/origin";
import { kitchenStage, pickupSettings, prepStartsAt } from "@/lib/pickup";
import { loadStall, markReady } from "@/lib/reservations";
import { shortName, type StallState } from "@/lib/stall";
import { canCook, kitchenAccess } from "@/lib/table-access";

// ==========================================
// TODAVÍA HAY
// PANTALLA DE COCINA (PLAN PLUS)
// ==========================================
//
// GET  → comandas pendientes y las listas de
//        los últimos minutos (mesas + apartados)
// POST { action: "ready", ticketId }        (mesa)
// POST { action: "ready", reservationId }   (apartado)
//
// Ver: dueño, encargado y cocina.
// Marcar lista: solo cocina.
// ==========================================

type Context = { params: Promise<{ slug: string }> };

/** Las listas se quedan en pantalla este tiempo. */
const READY_VISIBLE_MS = 5 * 60_000;

export type KitchenItem = {
  name: string;
  qty: number;
  note: string | null;
  cancelled: boolean;
};

export type KitchenTicket = {
  /** "t:<id>" para mesa, "r:<id>" para apartado. */
  key: string;
  kind: "table" | "pickup";
  label: string;
  status: "pending" | "ready";
  /** Desde cuándo espera la cocina. */
  since: string;
  readyAt: string | null;
  items: KitchenItem[];
};

export type KitchenSnapshot = {
  canMark: boolean;
  tickets: KitchenTicket[];
};

const Body = z.union([
  z.object({ action: z.literal("ready"), ticketId: z.string().uuid() }),
  z.object({ action: z.literal("ready"), reservationId: z.string().min(1).max(80) }),
]);

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** ¿Este platillo pasa por cocina? Sin sección = sí. */
function toKitchen(state: StallState) {
  const sections = new Map((state.sections ?? []).map((s) => [s.id, s.toKitchen]));
  const dishes = new Map(state.dishes.map((d) => [d.id, d]));
  return (dishId: string) => {
    const section = dishes.get(dishId)?.sectionId;
    return section ? (sections.get(section) ?? true) : true;
  };
}

async function snapshot(
  slug: string,
  businessId: string,
  canMark: boolean,
  lang: "es" | "en",
): Promise<KitchenSnapshot> {
  const db = admin();
  const now = Date.now();
  const recent = new Date(now - READY_VISIBLE_MS).toISOString();

  const [ticketsRes, state] = await Promise.all([
    db
      .from("kitchen_tickets")
      .select(
        "id, label, status, created_at, ready_at, table_tab_items(dish_id, qty, note, cancelled_at, created_at)",
      )
      .eq("business_id", businessId)
      .or(`status.eq.pending,and(status.in.(ready,served),ready_at.gte."${recent}")`)
      .order("created_at", { ascending: true }),
    loadStall(slug),
  ]);
  if (ticketsRes.error) throw ticketsRes.error;

  const dishName = new Map(
    (state?.dishes ?? []).map((d) => [d.id, lang === "es" ? d.nameEs : d.nameEn || d.nameEs]),
  );
  const name = (id: string) => dishName.get(id) ?? (lang === "es" ? "Platillo" : "Dish");

  const tickets: KitchenTicket[] = (ticketsRes.data ?? []).map((t) => ({
    key: `t:${t.id}`,
    kind: "table",
    label: t.label as string,
    status: t.status === "pending" ? "pending" : "ready",
    since: t.created_at as string,
    readyAt: (t.ready_at as string | null) ?? null,
    items: (
      (t.table_tab_items ?? []) as {
        dish_id: string;
        qty: number;
        note: string | null;
        cancelled_at: string | null;
        created_at: string;
      }[]
    )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((i) => ({
        name: name(i.dish_id),
        qty: i.qty,
        note: i.note,
        cancelled: Boolean(i.cancelled_at),
      })),
  }));

  // Apartados: cuando toca empezar a prepararlos (mismas etapas de Recoger).
  if (state) {
    const pickup = pickupSettings(state);
    const kitchen = toKitchen(state);
    for (const r of state.reservations) {
      if (r.status !== "authorized") continue;
      const stage = kitchenStage(r, pickup, new Date(now));
      const readyRecent = stage === "ready" && r.readyAt && Date.parse(r.readyAt) >= now - READY_VISIBLE_MS;
      if (stage !== "to_prepare" && !readyRecent) continue;
      const lines = r.lines.filter((l) => kitchen(l.dishId));
      if (!lines.length) continue;
      tickets.push({
        key: `r:${r.id}`,
        kind: "pickup",
        label: `${lang === "es" ? "Recoger" : "Pickup"}${r.orderNumber ? ` #${r.orderNumber}` : ""} · ${shortName(r.customerName)}`,
        status: stage === "ready" ? "ready" : "pending",
        since: prepStartsAt(r, pickup).toISOString(),
        readyAt: r.readyAt,
        items: lines.map((l) => ({ name: name(l.dishId), qty: l.qty, note: null, cancelled: false })),
      });
    }
  }

  tickets.sort((a, b) => a.since.localeCompare(b.since));
  return { canMark, tickets };
}

export async function GET(request: Request, context: Context) {
  try {
    const { slug } = await context.params;
    const access = await kitchenAccess(slug);
    if (!access.ok) return fail(access.message, access.status);
    const lang = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "es";

    return NextResponse.json(await snapshot(slug, access.businessId, canCook(access.role), lang), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("kitchen GET:", error);
    return fail("No se pudo cargar la cocina.", 500);
  }
}

export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return fail("Origen no autorizado", 403);

  try {
    const { slug } = await context.params;
    const access = await kitchenAccess(slug);
    if (!access.ok) return fail(access.message, access.status);
    if (!canCook(access.role)) {
      return fail("Solo la persona de cocina marca las comandas como listas.", 403);
    }

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("Datos inválidos.", 400);
    const input = parsed.data;
    const lang = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "es";

    if ("ticketId" in input) {
      const { error } = await admin().rpc("mark_kitchen_ticket", {
        p_ticket: input.ticketId,
        p_business: access.businessId,
        p_status: "ready",
        p_user: access.userId,
      });
      if (error) {
        if (error.message.includes("ticket_not_found")) return fail("La comanda ya no existe.", 404);
        if (error.message.includes("ticket_not_pending")) {
          return fail("Esa comanda ya estaba lista o se canceló.", 409);
        }
        throw new Error(error.message);
      }
    } else {
      const state = await loadStall(slug);
      if (!state?.reservations.some((r) => r.id === input.reservationId)) {
        return fail("Ese apartado ya no existe.", 404);
      }
      if (!(await markReady(slug, input.reservationId))) {
        return fail("Ese apartado ya no está activo.", 409);
      }
    }

    return NextResponse.json(await snapshot(slug, access.businessId, true, lang), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("kitchen POST:", error);
    return fail("No se pudo completar la operación.", 500);
  }
}
