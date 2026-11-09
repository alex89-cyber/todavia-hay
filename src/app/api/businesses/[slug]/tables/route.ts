
import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { admin } from "@/lib/accounts";
import { canConfigure, tableAccess } from "@/lib/table-access";

type Context = {
  params: Promise<{ slug: string }>;
};

const CreateTable = z.object({
  name: z.string().trim().min(1).max(50),
  capacity: z.number().int().min(1).max(50),
});

const UpdateTable = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(50).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  active: z.boolean().optional(),
}).refine(
  (value) =>
    value.name !== undefined ||
    value.capacity !== undefined ||
    value.active !== undefined,
  "No hay cambios",
);

async function getBusiness(slug: string) {
  const access = await tableAccess(slug);
  if (!access.ok) {
    return { error: access.reason === "not_found" ? ("not_found" as const) : ("forbidden" as const) };
  }
  if (!canConfigure(access.role)) {
    return { error: "forbidden" as const };
  }
  return { id: access.businessId };
}


function fail(
  error: string | undefined,
  status: number,
) {
  return NextResponse.json(
    {
      error: error ?? "Error inesperado.",
    },
    { status },
  );
}


export async function GET(
  _request: Request,
  context: Context,
) {
  try {
    const { slug } = await context.params;
    const business = await getBusiness(slug);

    if ("error" in business) {
      return fail(
        business.error,
        business.error === "forbidden" ? 403 : 404,
      );
    }

    const { data, error } = await admin()
      .from("restaurant_tables")
      .select("id, name, capacity, active, created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json(
      { tables: data ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("tables GET:", error);
    return fail("No se pudieron cargar las mesas.", 500);
  }
}

export async function POST(
  request: Request,
  context: Context,
) {
  try {
    const { slug } = await context.params;
    const business = await getBusiness(slug);

    if ("error" in business) {
      return fail(
        business.error,
        business.error === "forbidden" ? 403 : 404,
      );
    }

    const parsed = CreateTable.safeParse(
      await request.json().catch(() => null),
    );

    if (!parsed.success) {
      return fail("Revisa el nombre y la capacidad.", 400);
    }

    const { count, error: countError } = await admin()
      .from("restaurant_tables")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id);

    if (countError) throw countError;

    if ((count ?? 0) >= 100) {
      return fail("Máximo 100 mesas por restaurante.", 400);
    }

    const { data, error } = await admin()
      .from("restaurant_tables")
      .insert({
        business_id: business.id,
        name: parsed.data.name,
        capacity: parsed.data.capacity,
        active: true,
      })
      .select("id, name, capacity, active, created_at")
      .single();

    if (error?.code === "23505") {
      return fail("Ya existe una mesa con ese nombre.", 409);
    }

    if (error) throw error;

    return NextResponse.json(
      { table: data },
      { status: 201 },
    );
  } catch (error) {
    console.error("tables POST:", error);
    return fail("No se pudo crear la mesa.", 500);
  }
}

export async function PATCH(
  request: Request,
  context: Context,
) {
  try {
    const { slug } = await context.params;
    const business = await getBusiness(slug);

    if ("error" in business) {
      return fail(
        business.error,
        business.error === "forbidden" ? 403 : 404,
      );
    }

    const parsed = UpdateTable.safeParse(
      await request.json().catch(() => null),
    );

    if (!parsed.success) {
      return fail("Datos de mesa inválidos.", 400);
    }

    const { id, ...changes } = parsed.data;

    const { data: existing, error: findError } =
      await admin()
        .from("restaurant_tables")
        .select("id, active, capacity")
        .eq("id", id)
        .eq("business_id", business.id)
        .maybeSingle();

    if (findError) throw findError;

    if (!existing) {
      return fail("Mesa no encontrada.", 404);
    }

    // No desactivar ni reducir la capacidad de una
    // mesa comprometida con solicitudes confirmadas.
    if (
      changes.active === false ||
      (changes.capacity !== undefined &&
        changes.capacity < existing.capacity)
    ) {
      const { data: requests, error: requestError } =
        await admin()
          .from("dine_in_requests")
          .select("id, party_size")
          .eq("business_id", business.id)
          .eq("table_id", id)
          .in("status", ["confirmed", "arrived"])
          .limit(100);

      if (requestError) throw requestError;

      if (
        changes.active === false &&
        (requests?.length ?? 0) > 0
      ) {
        return fail(
          "La mesa tiene solicitudes activas.",
          409,
        );
      }

      if (
        changes.capacity !== undefined &&
        (requests ?? []).some(
          (row) => row.party_size > changes.capacity!,
        )
      ) {
        return fail(
          "La capacidad es menor que una reserva activa.",
          409,
        );
      }
    }

    const { data, error } = await admin()
      .from("restaurant_tables")
      .update(changes)
      .eq("id", id)
      .eq("business_id", business.id)
      .select("id, name, capacity, active, created_at")
      .single();

    if (error?.code === "23505") {
      return fail("Ya existe una mesa con ese nombre.", 409);
    }

    if (error) throw error;

    return NextResponse.json({ table: data });
  } catch (error) {
    console.error("tables PATCH:", error);
    return fail("No se pudo actualizar la mesa.", 500);
  }
}
