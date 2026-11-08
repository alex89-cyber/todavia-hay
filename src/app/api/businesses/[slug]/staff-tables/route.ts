
import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { admin } from "@/lib/accounts";
import { currentAccount } from "@/lib/auth/server";

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
  const me = await currentAccount();

  if (!me) {
    return {
      ok: false as const,
      message: "Debes iniciar sesión.",
      status: 401,
    };
  }

  const db = admin();

  const { data: business, error: businessError } =
    await db
      .from("businesses")
      .select("id, plan")
      .eq("slug", slug)
      .maybeSingle();

  if (businessError) throw businessError;

  if (!business) {
    return {
      ok: false as const,
      message: "Restaurante no encontrado.",
      status: 404,
    };
  }

  const { data: membership, error: memberError } =
    await db
      .from("business_members")
      .select("role")
      .eq("business_id", business.id)
      .eq("user_id", me.id)
      .in("role", ["waiter", "manager"])
      .maybeSingle();

  if (memberError) throw memberError;

  if (!membership) {
    return {
      ok: false as const,
      message: "No tienes permiso para gestionar mesas.",
      status: 403,
    };
  }

  if (business.plan !== "medium") {
    return {
      ok: false as const,
      message: "Esta función requiere el plan Medium.",
      status: 403,
    };
  }

  return {
    ok: true as const,
    businessId: business.id as string,
  };
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
    const access = await authorize(slug);

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
