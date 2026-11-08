
import { NextResponse } from "next/server";
import { z } from "zod";

import { admin } from "@/lib/accounts";
import { currentAccount } from "@/lib/auth/server";
import { isOwner } from "@/lib/owner-auth";

const PurchaseSchema = z.object({
  supplier: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),

  items: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      quantity: z.number().positive().max(1_000_000),
      totalCostCents: z.number().int().positive().max(1_000_000_000),
    }),
  ).min(1).max(100),
}).superRefine((value, ctx) => {
  const ids = value.items.map((item) => item.ingredientId);

  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({
      code: "custom",
      message: "Hay ingredientes repetidos en la compra.",
      path: ["items"],
    });
  }
});


export async function POST(
  request: Request,
  context: {
    params: Promise<{ slug: string }>;
  },
) {
  try {
    const { slug } = await context.params;


    // No permitir compras de usuarios sin sesión
    // ni de empleados con rol distinto de owner.
    const user = await currentAccount();

    if (!user || !(await isOwner(slug))) {
      return NextResponse.json(
        { error: "Solo el propietario puede registrar compras." },
        { status: 403 },
      );
    }

    const input = PurchaseSchema.safeParse(
      await request.json().catch(() => null),
    );

    if (!input.success) {
      return NextResponse.json(
        {
          error: "Revisa las cantidades y los costos de la compra.",
        },
        { status: 400 },
      );
    }

    const db = admin();

    const { data: business, error: businessError } = await db
      .from("businesses")
      .select("id, is_open")
      .eq("slug", slug)
      .maybeSingle();

    if (businessError) {
      throw businessError;
    }

    if (!business) {
      return NextResponse.json(
        { error: "No se encontró el negocio." },
        { status: 404 },
      );
    }

    if (!business.is_open) {
      return NextResponse.json(
        { error: "Primero debes abrir la jornada." },
        { status: 409 },
      );
    }

    // Confirmar que los ingredientes pertenecen
    // al restaurante antes de llamar a Supabase.
    const ingredientIds = input.data.items.map(
      (item) => item.ingredientId,
    );

    const { data: ingredients, error: ingredientsError } =
      await db
        .from("ingredients")
        .select("id")
        .eq("business_id", business.id)
        .in("id", ingredientIds);

    if (ingredientsError) {
      throw ingredientsError;
    }

    if ((ingredients?.length ?? 0) !== ingredientIds.length) {
      return NextResponse.json(
        { error: "Uno o más ingredientes no pertenecen al negocio." },
        { status: 400 },
      );
    }

    // La función SQL registra el costo y aumenta
    // las existencias en la misma transacción.
    const { data: purchaseId, error: purchaseError } =
      await db.rpc("register_inventory_purchase", {
        p_business: business.id,
        p_created_by: user.id,
        p_supplier: input.data.supplier || null,
        p_notes: input.data.notes || null,
        p_items: input.data.items.map((item) => ({
          ingredient_id: item.ingredientId,
          quantity: item.quantity,
          total_cost_cents: item.totalCostCents,
        })),
      });

    if (purchaseError) {
      console.error("Error al registrar compra:", purchaseError);

      return NextResponse.json(
        { error: "No se pudo registrar la compra. Revisa los registros del servidor." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        purchaseId,
        message: "Compra registrada e inventario actualizado.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Error en API de compras:", error);

    return NextResponse.json(
      { error: "Ocurrió un error al registrar la compra." },
      { status: 500 },
    );
  }
}
