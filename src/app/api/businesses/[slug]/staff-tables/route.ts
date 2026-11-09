
import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { admin } from "@/lib/accounts";
import { canServe, tableAccess } from "@/lib/table-access";

// ==========================================
// TODAVÍA HAY
// API DE MESAS PARA MESEROS
// ==========================================
//
// Permitido:
// - Consultar mesas.
// - Juntar mesas.
// - Separar mesas.
//
// No permitido:
// - Crear mesas.
// - Editar nombres o capacidades.
// - Activar o desactivar mesas.
//
// La configuración corresponde al dueño.
// ==========================================

type Context = {
  params: Promise<{ slug: string }>;
};

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("join"),
    tableIds: z.array(z.string().uuid()).min(2).max(20),
  }),

  z.object({
    action: z.literal("separate"),
    groupId: z.string().uuid(),
  }),
]);

function fail(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status },
  );
}

// ==========================================
// COMPROBAR ACCESO DEL MESERO
// ==========================================

async function authorize(slug: string) {
  const access = await tableAccess(slug);
  return access.ok
    ? { ok: true as const, businessId: access.businessId }
    : { ok: false as const, message: access.message, status: access.status };
}

async function authorizeServe(slug: string) {
  const access = await tableAccess(slug);
  if (!access.ok) return { ok: false as const, message: access.message, status: access.status };
  if (!canServe(access.role)) {
    return { ok: false as const, message: "Juntar y separar mesas lo hacen los meseros y encargados.", status: 403 };
  }
  return { ok: true as const, businessId: access.businessId };
}

/** Mesas que tienen una cuenta abierta (directa o por su grupo). */
async function busyTableIds(businessId: string): Promise<Set<string>> {
  const db = admin();
  const { data: tabs, error } = await db
    .from("table_tabs")
    .select("table_id")
    .eq("business_id", businessId)
    .eq("status", "open");
  if (error) throw error;
  const busy = new Set((tabs ?? []).map((t) => t.table_id as string));
  if (busy.size === 0) return busy;

  const tables = await listTables(businessId);
  const busyGroups = new Set(
    tables.filter((t) => busy.has(t.id) && t.group_id).map((t) => t.group_id),
  );
  for (const t of tables) {
    if (t.group_id && busyGroups.has(t.group_id)) busy.add(t.id);
  }
  return busy;
}

// ==========================================
// CONSULTAR MESAS
// ==========================================

async function listTables(businessId: string) {
  const { data, error } = await admin()
    .from("restaurant_tables")
    .select("id, name, capacity, active, group_id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

// ==========================================
// GET - VER MESAS
// ==========================================

export async function GET(
  _request: Request,
  context: Context,
) {
  try {
    const { slug } = await context.params;
    const access = await authorize(slug);

    if (!access.ok) {
      return fail(access.message, access.status);
    }

    return NextResponse.json(
      {
        tables: await listTables(access.businessId),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("staff-tables GET:", error);

    return fail(
      "No se pudieron consultar las mesas.",
      500,
    );
  }
}

// ==========================================
// POST - JUNTAR O SEPARAR MESAS
// ==========================================

export async function POST(
  request: Request,
  context: Context,
) {
  try {
    const { slug } = await context.params;
    const access = await authorizeServe(slug);

    if (!access.ok) {
      return fail(access.message, access.status);
    }

    const parsed = Body.safeParse(
      await request.json().catch(() => null),
    );

    if (!parsed.success) {
      return fail("Datos inválidos.", 400);
    }

    const input = parsed.data;
    const db = admin();

    if (input.action === "join") {
      // Evitar seleccionar la misma mesa varias veces.
      if (
        new Set(input.tableIds).size !==
        input.tableIds.length
      ) {
        return fail(
          "Selecciona mesas diferentes.",
          400,
        );
      }

      const busy = await busyTableIds(access.businessId);
      if (input.tableIds.some((id) => busy.has(id))) {
        return fail(
          "Una de las mesas tiene una cuenta abierta. Cóbrala o cancélala antes de juntarla.",
          409,
        );
      }

      // La función SQL realiza la agrupación
      // de forma atómica.
      const { error } = await db.rpc(
        "manage_table_group",
        {
          p_business: access.businessId,
          p_action: "join",
          p_table_ids: input.tableIds,
          p_group_id: null,
        },
      );

      if (error) {
        if (
          error.message.includes("tables_unavailable") ||
          error.message.includes("select_at_least_two_tables")
        ) {
          return fail(
            "Alguna mesa ya está agrupada o no está habilitada. Actualiza e inténtalo nuevamente.",
            409,
          );
        }

        throw error;
      }
    }

    if (input.action === "separate") {
      const tables = await listTables(access.businessId);
      const busy = await busyTableIds(access.businessId);
      if (tables.some((t) => t.group_id === input.groupId && busy.has(t.id))) {
        return fail(
          "Estas mesas tienen una cuenta abierta. Cóbrala o cancélala antes de separarlas.",
          409,
        );
      }

      const { error } = await db.rpc(
        "manage_table_group",
        {
          p_business: access.businessId,
          p_action: "separate",
          p_table_ids: null,
          p_group_id: input.groupId,
        },
      );

      if (error) {
        if (
          error.message.includes("group_not_found")
        ) {
          return fail(
            "El grupo ya no existe.",
            404,
          );
        }

        throw error;
      }
    }

    return NextResponse.json(
      {
        ok: true,
        tables: await listTables(access.businessId),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("staff-tables POST:", error);

    return fail(
      "No se pudo completar la operación.",
      500,
    );
  }
}

// No exportamos PATCH ni DELETE.
// El mesero no puede modificar la
// configuración de las mesas.
