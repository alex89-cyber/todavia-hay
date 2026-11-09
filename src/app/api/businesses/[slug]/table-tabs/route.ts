import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { admin } from "@/lib/accounts";
import { sameOrigin } from "@/lib/origin";
import { menuAvailability } from "@/lib/inventory";
import { store } from "@/lib/store";
import { canServe, tableAccess } from "@/lib/table-access";

// ==========================================
// TODAVÍA HAY
// CUENTAS DE MESA
// ==========================================
//
// GET  /api/businesses/:slug/table-tabs → mesas, cuentas abiertas y menú
// POST /api/businesses/:slug/table-tabs
//   { action: "open", tableId, partySize }
//   { action: "add", tabId, lines: [{ dishId, qty, note? }] }
//   { action: "cancelItem", itemId }
//   { action: "pay", tabId, method, amountCents? }
//   { action: "cancelTab", tabId }
//
// Cada acción pasa por una función SQL que
// bloquea la cuenta, así dos meseros no se
// pisan. Responde con la foto actualizada.
// ==========================================

type Context = { params: Promise<{ slug: string }> };

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("open"),
    tableId: z.string().uuid(),
    partySize: z.number().int().min(1).max(50),
  }),
  z.object({
    action: z.literal("add"),
    tabId: z.string().uuid(),
    lines: z
      .array(
        z.object({
          dishId: z.string().uuid(),
          qty: z.number().int().min(1).max(99),
          note: z.string().trim().max(140).optional(),
        }),
      )
      .min(1)
      .max(50),
  }),
  z.object({ action: z.literal("cancelItem"), itemId: z.string().uuid() }),
  z.object({
    action: z.literal("pay"),
    tabId: z.string().uuid(),
    method: z.enum(["cash", "card", "transfer"]),
    /** Pago parcial; sin monto se cobra lo que falta. */
    amountCents: z.number().int().min(1).max(100_000_000).optional(),
  }),
  z.object({ action: z.literal("cancelTab"), tabId: z.string().uuid() }),
]);

// Errores de las funciones SQL que el mesero puede entender.
const KNOWN: Record<string, { message: string; status: number }> = {
  table_busy: { message: "Esa mesa ya tiene una cuenta abierta.", status: 409 },
  table_inactive: { message: "Esa mesa está desactivada.", status: 409 },
  table_not_found: { message: "La mesa ya no existe.", status: 404 },
  tab_not_found: { message: "La cuenta ya no existe.", status: 404 },
  tab_closed: { message: "Esa cuenta ya se cerró.", status: 409 },
  item_not_found: { message: "Ese platillo ya no está en la cuenta.", status: 404 },
  closed: { message: "El negocio está cerrado. Abre el día para tomar pedidos.", status: 409 },
  insufficient_stock: { message: "Ya no alcanza el inventario para ese pedido.", status: 409 },
  sold_out: { message: "Uno de los platillos está agotado.", status: 409 },
  dish_not_found: { message: "Uno de los platillos ya no está en el menú.", status: 409 },
  already_paid: {
    message: "Ya se pagó parte de la cuenta; no puede quedar por debajo de lo pagado.",
    status: 409,
  },
  has_payments: { message: "La cuenta ya tiene pagos; no se puede cancelar.", status: 409 },
  invalid_amount: { message: "El monto es mayor a lo que falta por pagar.", status: 409 },
  empty_tab: { message: "La cuenta no tiene platillos. Cancélala en lugar de cobrar.", status: 409 },
};

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function sqlError(message: string) {
  const key = Object.keys(KNOWN).find((k) => message.includes(k));
  return key ? KNOWN[key] : null;
}

export type TabItem = {
  id: string;
  dishId: string;
  qty: number;
  priceCents: number;
  note: string | null;
  createdAt: string;
};

export type OpenTab = {
  id: string;
  tableId: string;
  tableLabel: string;
  partySize: number;
  openedAt: string;
  items: TabItem[];
  totalCents: number;
  /** Pagos ya hechos (cuenta dividida). */
  payments: { id: string; method: "cash" | "card" | "transfer"; amountCents: number; at: string }[];
  paidCents: number;
};

export type TabsSnapshot = {
  isOpen: boolean;
  currency: string;
  tables: {
    id: string;
    name: string;
    capacity: number;
    active: boolean;
    group_id: string | null;
  }[];
  tabs: OpenTab[];
  menu: {
    id: string;
    nameEs: string;
    nameEn: string;
    priceCents: number;
    portions: number;
    soldOut: boolean;
  }[];
};

async function snapshot(slug: string, businessId: string): Promise<TabsSnapshot> {
  const db = admin();

  const [tablesRes, tabsRes, state] = await Promise.all([
    db
      .from("restaurant_tables")
      .select("id, name, capacity, active, group_id")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true }),
    db
      .from("table_tabs")
      .select(
        "id, table_id, table_label, party_size, opened_at, table_tab_items(id, dish_id, qty, price_cents, note, created_at, cancelled_at)",
      )
      .eq("business_id", businessId)
      .eq("status", "open")
      .order("opened_at", { ascending: true }),
    store.get(slug),
  ]);
  if (tablesRes.error) throw tablesRes.error;
  if (tabsRes.error) throw tabsRes.error;

  // Pagos de las cuentas abiertas (cuenta dividida). Va aparte: sales y
  // table_tabs tienen dos llaves entre sí y un embed sería ambiguo.
  const openIds = (tabsRes.data ?? []).map((t) => t.id as string);
  const paysRes = openIds.length
    ? await db
        .from("sales")
        .select("id, method, total_cents, created_at, table_tab_id")
        .in("table_tab_id", openIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (paysRes.error) throw paysRes.error;

  const tabs: OpenTab[] = (tabsRes.data ?? []).map((t) => {
    const items = (
      (t.table_tab_items ?? []) as {
        id: string;
        dish_id: string;
        qty: number;
        price_cents: number;
        note: string | null;
        created_at: string;
        cancelled_at: string | null;
      }[]
    )
      .filter((i) => !i.cancelled_at)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((i) => ({
        id: i.id,
        dishId: i.dish_id,
        qty: i.qty,
        priceCents: i.price_cents,
        note: i.note,
        createdAt: i.created_at,
      }));
    const payments = (paysRes.data ?? [])
      .filter((p) => p.table_tab_id === t.id)
      .map((p) => ({
        id: p.id as string,
        method: p.method as "cash" | "card" | "transfer",
        amountCents: p.total_cents as number,
        at: p.created_at as string,
      }));
    return {
      id: t.id,
      tableId: t.table_id,
      tableLabel: t.table_label,
      partySize: t.party_size,
      openedAt: t.opened_at,
      items,
      totalCents: items.reduce((sum, i) => sum + i.qty * i.priceCents, 0),
      payments,
      paidCents: payments.reduce((sum, p) => sum + p.amountCents, 0),
    };
  });

  const available = state
    ? new Map(menuAvailability(state.dishes, state.ingredients).map((a) => [a.dishId, a.portions]))
    : new Map<string, number>();

  return {
    isOpen: state?.isOpen ?? false,
    currency: state?.currency ?? "MXN",
    tables: tablesRes.data ?? [],
    tabs,
    menu: (state?.dishes ?? []).map((d) => ({
      id: d.id,
      nameEs: d.nameEs,
      nameEn: d.nameEn,
      priceCents: d.priceCents,
      portions: available.get(d.id) ?? 0,
      soldOut: d.soldOut,
    })),
  };
}

export async function GET(_request: Request, context: Context) {
  try {
    const { slug } = await context.params;
    const access = await tableAccess(slug);
    if (!access.ok) return fail(access.message, access.status);

    return NextResponse.json(await snapshot(slug, access.businessId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("table-tabs GET:", error);
    return fail("No se pudieron cargar las mesas.", 500);
  }
}

export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) {
    return fail("Origen no autorizado", 403);
  }

  try {
    const { slug } = await context.params;
    const access = await tableAccess(slug);
    if (!access.ok) return fail(access.message, access.status);
    if (!canServe(access.role)) {
      return fail("Abrir mesas, pedir y cobrar lo hacen los meseros y encargados.", 403);
    }

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("Datos inválidos.", 400);
    const input = parsed.data;
    const db = admin();
    const user = access.userId;

    // Toda cuenta o platillo debe ser de este negocio.
    const tabId =
      input.action === "add" || input.action === "pay" || input.action === "cancelTab"
        ? input.tabId
        : null;
    if (tabId) {
      const { data, error } = await db
        .from("table_tabs")
        .select("id")
        .eq("id", tabId)
        .eq("business_id", access.businessId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return fail(KNOWN.tab_not_found.message, 404);
    }
    if (input.action === "cancelItem") {
      const { data, error } = await db
        .from("table_tab_items")
        .select("id")
        .eq("id", input.itemId)
        .eq("business_id", access.businessId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return fail(KNOWN.item_not_found.message, 404);
    }

    let result: { error: { message: string } | null };
    switch (input.action) {
      case "open":
        result = await db.rpc("open_table_tab", {
          p_business: access.businessId,
          p_table: input.tableId,
          p_party: input.partySize,
          p_user: user,
        });
        break;
      case "add":
        result = await db.rpc("add_table_tab_items", {
          p_tab: input.tabId,
          p_lines: input.lines.map((l) => ({
            dish_id: l.dishId,
            qty: l.qty,
            note: l.note || null,
          })),
          p_user: user,
        });
        break;
      case "cancelItem":
        result = await db.rpc("cancel_table_tab_item", {
          p_item: input.itemId,
          p_user: user,
        });
        break;
      case "pay":
        result = await db.rpc("pay_table_tab", {
          p_tab: input.tabId,
          p_method: input.method,
          p_user: user,
          p_amount: input.amountCents ?? null,
        });
        break;
      case "cancelTab":
        result = await db.rpc("cancel_table_tab", {
          p_tab: input.tabId,
          p_user: user,
        });
        break;
    }

    if (result.error) {
      const known = sqlError(result.error.message);
      if (known) return fail(known.message, known.status);
      throw new Error(result.error.message);
    }

    return NextResponse.json(await snapshot(slug, access.businessId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("table-tabs POST:", error);
    return fail("No se pudo completar la operación.", 500);
  }
}
