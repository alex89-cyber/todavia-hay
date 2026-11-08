
import { NextResponse } from "next/server";
import { z } from "zod";

import { admin } from "@/lib/accounts";
import { currentAccount } from "@/lib/auth/server";
import { isOwner } from "@/lib/owner-auth";

const ExpenseSchema = z.object({
  category: z.enum([
    "rent",
    "electricity",
    "water",
    "gas",
    "payroll",
    "transport",
    "maintenance",
    "supplies",
    "other",
  ]),
  description: z.string().trim().min(2).max(250),
  amountCents: z.number().int().positive().max(1000000000),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type Context = {
  params: Promise<{ slug: string }>;
};

async function authorizedBusiness(slug: string) {
  const user = await currentAccount();

  if (!user || !(await isOwner(slug))) {
    return null;
  }

  const { data, error } = await admin()
    .from("businesses")
    .select("id, currency, timezone")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;

  return data ? { ...data, userId: user.id } : null;
}

// Leer registros paginados para no depender
// del límite de 1,000 filas de Supabase.
async function readRows(
  table: string,
  businessId: string,
) {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 500;

  for (let offset = 0; offset < 50000; offset += pageSize) {
    const { data, error } = await admin()
      .from(table)
      .select("*")
      .eq("business_id", businessId)
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    rows.push(...(data ?? []));

    if ((data?.length ?? 0) < pageSize) {
      return rows;
    }
  }

  throw new Error("Demasiados registros para esta consulta.");
}

export async function GET(
  _request: Request,
  context: Context,
) {
  try {
    const { slug } = await context.params;
    const business = await authorizedBusiness(slug);

    if (!business) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 },
      );
    }

    const [
      purchaseRows,
      itemRows,
      expenseRows,
    ] = await Promise.all([
      readRows("inventory_purchases", business.id),
      readRows("inventory_purchase_items", business.id),
      readRows("business_expenses", business.id),
    ]);

    const costs = new Map<string, number>();
    const counts = new Map<string, number>();

    for (const row of itemRows) {
      const id = String(row.purchase_id);
      costs.set(
        id,
        (costs.get(id) ?? 0) +
          Number(row.total_cost_cents ?? 0),
      );
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    const purchases = purchaseRows.map((row) => ({
      id: String(row.id),
      purchasedAt: String(row.purchased_at),
      supplier: row.supplier
        ? String(row.supplier)
        : null,
      notes: row.notes ? String(row.notes) : null,
      totalCents: costs.get(String(row.id)) ?? 0,
      itemCount: counts.get(String(row.id)) ?? 0,
    }));

    const expenses = expenseRows.map((row) => ({
      id: String(row.id),
      category: String(row.category),
      description: String(row.description),
      amountCents: Number(row.amount_cents ?? 0),
      expenseDate: String(row.expense_date),
      createdAt: String(row.created_at),
    }));

    return NextResponse.json(
      {
        currency: business.currency,
        timezone: business.timezone,
        purchases,
        expenses,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("finance GET:", error);

    return NextResponse.json(
      { error: "No se pudieron cargar las finanzas." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: Context,
) {
  try {
    const { slug } = await context.params;
    const business = await authorizedBusiness(slug);

    if (!business) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 },
      );
    }

    const parsed = ExpenseSchema.safeParse(
      await request.json().catch(() => null),
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Revisa los datos del gasto." },
        { status: 400 },
      );
    }

    const input = parsed.data;

    const { data, error } = await admin()
      .from("business_expenses")
      .insert({
        business_id: business.id,
        category: input.category,
        description: input.description,
        amount_cents: input.amountCents,
        expense_date: input.expenseDate,
        created_by: business.userId,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json(
      { ok: true, id: data.id },
      { status: 201 },
    );
  } catch (error) {
    console.error("finance POST:", error);

    return NextResponse.json(
      { error: "No se pudo guardar el gasto." },
      { status: 500 },
    );
  }
}
