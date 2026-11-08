
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Lang = "es" | "en";

type Purchase = {
  id: string;
  purchasedAt: string;
  supplier: string | null;
  notes: string | null;
  totalCents: number;
  itemCount: number;
};

type Expense = {
  id: string;
  category: string;
  description: string;
  amountCents: number;
  expenseDate: string;
  createdAt: string;
};

type FinanceData = {
  currency: string;
  timezone: string;
  purchases: Purchase[];
  expenses: Expense[];
};

type Props = {
  slug: string;
  lang: Lang;
  date?: string;
};

const CATEGORIES = [
  ["rent", "Renta"],
  ["electricity", "Electricidad"],
  ["water", "Agua"],
  ["gas", "Gas"],
  ["payroll", "Sueldos"],
  ["transport", "Transporte"],
  ["maintenance", "Mantenimiento"],
  ["supplies", "Suministros"],
  ["other", "Otros"],
] as const;

function localDate(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function categoryName(category: string, lang: Lang) {
  const found = CATEGORIES.find(([id]) => id === category);

  if (lang === "en") {
    const translations: Record<string, string> = {
      rent: "Rent",
      electricity: "Electricity",
      water: "Water",
      gas: "Gas",
      payroll: "Payroll",
      transport: "Transport",
      maintenance: "Maintenance",
      supplies: "Supplies",
      other: "Other",
    };

    return translations[category] ?? category;
  }

  return found?.[1] ?? category;
}

function toCents(value: string): number | null {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value.trim())) {
    return null;
  }

  const [whole, decimals = ""] = value.trim().split(".");

  return Number(whole) * 100 +
    Number(decimals.padEnd(2, "0"));
}

function Card({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[#eadfd3] bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-[#806b5d]">
        {label}
      </p>

      <p className="mt-2 break-words text-2xl font-black text-[#a3341f]">
        {value}
      </p>

      <p className="mt-1 text-xs text-[#806b5d]">
        {description}
      </p>
    </div>
  );
}

export default function FinanceOverview({
  slug,
  lang,
  date,
}: Props) {
  const es = lang === "es";

  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [category, setCategory] = useState("rent");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");

  const money = useCallback(
    (cents: number) =>
      new Intl.NumberFormat(
        es ? "es-MX" : "en-US",
        {
          style: "currency",
          currency: data?.currency ?? "MXN",
        },
      ).format(cents / 100),
    [data?.currency, es],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(slug)}/finance`,
        { cache: "no-store" },
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Error de consulta");
      }

      setData(json);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron consultar las finanzas.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (date) {
      setExpenseDate(date);
    } else {
      setExpenseDate(
        new Date().toLocaleDateString("en-CA"),
      );
    }
  }, [date]);

  const purchases = useMemo(
    () =>
      (data?.purchases ?? []).filter((purchase) => {
        if (!date) return true;

        return localDate(
          purchase.purchasedAt,
          data!.timezone,
        ) === date;
      }),
    [data, date],
  );

  const expenses = useMemo(
    () =>
      (data?.expenses ?? []).filter(
        (expense) =>
          !date || expense.expenseDate === date,
      ),
    [data, date],
  );

  const purchasesCents = purchases.reduce(
    (total, purchase) => total + purchase.totalCents,
    0,
  );

  const expensesCents = expenses.reduce(
    (total, expense) => total + expense.amountCents,
    0,
  );

  const movements = useMemo(() => {
    const all = [
      ...purchases.map((purchase) => ({
        id: `purchase-${purchase.id}`,
        at: purchase.purchasedAt,
        type: "purchase" as const,
        title: purchase.supplier
          ? `${es ? "Compra" : "Purchase"} · ${purchase.supplier}`
          : es ? "Compra de inventario" : "Inventory purchase",
        subtitle: `${purchase.itemCount} ${
          es ? "ingredientes" : "ingredients"
        }`,
        amountCents: purchase.totalCents,
      })),

      ...expenses.map((expense) => ({
        id: `expense-${expense.id}`,
        at: expense.expenseDate + "T12:00:00Z",
        type: "expense" as const,
        title: expense.description,
        subtitle: categoryName(expense.category, lang),
        amountCents: expense.amountCents,
      })),
    ];

    return all.sort((a, b) => b.at.localeCompare(a.at));
  }, [purchases, expenses, es, lang]);

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amountCents = toCents(amount);

    if (!amountCents || amountCents <= 0) {
      setError(
        es ? "Ingresa un importe válido." : "Enter a valid amount.",
      );
      return;
    }

    if (!description.trim() || !expenseDate) {
      setError(
        es
          ? "Completa la descripción y la fecha."
          : "Enter a description and date.",
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(slug)}/finance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            category,
            description: description.trim(),
            amountCents,
            expenseDate,
          }),
        },
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Error al guardar");
      }

      setShowForm(false);
      setDescription("");
      setAmount("");

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo confirmar el gasto. Revisa el historial antes de repetirlo.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-b border-[#eadfd3] bg-[#fbf6ef] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-screen-2xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#a3341f]">
              {es ? "Finanzas" : "Finances"}
            </p>

            <h2 className="mt-1 text-2xl font-black text-[#302018]">
              {es
                ? "Compras y gastos del restaurante"
                : "Restaurant purchases and expenses"}
            </h2>

            <p className="mt-1 text-sm text-[#806b5d]">
              {date
                ? `${es ? "Movimientos del" : "Movements for"} ${date}`
                : es
                  ? "Historial general de movimientos"
                  : "All recorded movements"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-xl border border-[#eadfd3] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"
            >
              {es ? "Actualizar" : "Refresh"}
            </button>

            <button
              type="button"
              onClick={() => setShowForm((value) => !value)}
              className="rounded-xl bg-[#a3341f] px-4 py-3 text-sm font-bold text-white"
            >
              {es ? "+ Registrar gasto" : "+ Add expense"}
            </button>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        )}

        {showForm && (
          <form
            onSubmit={saveExpense}
            className="mb-5 grid gap-3 rounded-2xl border border-[#eadfd3] bg-white p-4 sm:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-sm font-semibold">
                {es ? "Categoría" : "Category"}
              </label>

              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
                className="w-full rounded-xl border p-3"
              >
                {CATEGORIES.map(([id]) => (
                  <option key={id} value={id}>
                    {categoryName(id, lang)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">
                {es ? "Fecha del gasto" : "Expense date"}
              </label>

              <input
                type="date"
                required
                value={expenseDate}
                onChange={(event) =>
                  setExpenseDate(event.target.value)
                }
                className="w-full rounded-xl border p-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">
                {es ? "Descripción" : "Description"}
              </label>

              <input
                required
                minLength={2}
                maxLength={250}
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Ej. Pago de electricidad"
                className="w-full rounded-xl border p-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">
                {es ? "Importe ($)" : "Amount ($)"}
              </label>

              <input
                required
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                placeholder="1200.00"
                className="w-full rounded-xl border p-3"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#a3341f] px-5 py-3 font-bold text-white disabled:opacity-50"
              >
                {saving
                  ? es ? "Guardando..." : "Saving..."
                  : es ? "Guardar gasto" : "Save expense"}
              </button>
            </div>
          </form>
        )}

        {loading && !data ? (
          <p className="rounded-xl bg-white p-5 text-sm text-[#806b5d]">
            {es ? "Cargando finanzas..." : "Loading finances..."}
          </p>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card
                label={es ? "Compras de inventario" : "Inventory purchases"}
                value={money(purchasesCents)}
                description={
                  `${purchases.length} ${
                    es ? "compras registradas" : "recorded purchases"
                  }`
                }
              />

              <Card
                label={es ? "Gastos operativos" : "Operating expenses"}
                value={money(expensesCents)}
                description={
                  `${expenses.length} ${
                    es ? "gastos registrados" : "recorded expenses"
                  }`
                }
              />

              <Card
                label={es ? "Salidas de dinero" : "Cash outflows"}
                value={money(purchasesCents + expensesCents)}
                description={
                  es
                    ? "Compras más gastos del periodo"
                    : "Purchases plus expenses"
                }
              />
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[#eadfd3] bg-white">
              <div className="border-b border-[#eadfd3] p-4">
                <h3 className="font-bold text-[#302018]">
                  {es ? "Historial de movimientos" : "Movement history"}
                </h3>
              </div>

              {movements.length === 0 ? (
                <p className="p-5 text-sm text-[#806b5d]">
                  {es
                    ? "Todavía no hay compras ni gastos registrados en este periodo."
                    : "There are no recorded purchases or expenses for this period."}
                </p>
              ) : (
                <div className="max-h-72 overflow-auto">
                  <table className="w-full min-w-[500px] text-left text-sm">
                    <thead className="sticky top-0 bg-[#fbf6ef]">
                      <tr>
                        <th className="p-3">{es ? "Fecha" : "Date"}</th>
                        <th className="p-3">{es ? "Concepto" : "Description"}</th>
                        <th className="p-3">{es ? "Tipo" : "Type"}</th>
                        <th className="p-3 text-right">{es ? "Importe" : "Amount"}</th>
                      </tr>
                    </thead>

                    <tbody>
                      {movements.map((movement) => (
                        <tr
                          key={movement.id}
                          className="border-t border-[#f0e6dc]"
                        >
                          <td className="p-3">
                            {movement.type === "expense"
                              ? movement.at.slice(0, 10)
                              : localDate(
                                  movement.at,
                                  data.timezone,
                                )}
                          </td>

                          <td className="p-3">
                            <span className="font-semibold">
                              {movement.title}
                            </span>
                            <span className="block text-xs text-[#806b5d]">
                              {movement.subtitle}
                            </span>
                          </td>

                          <td className="p-3">
                            {movement.type === "purchase"
                              ? es ? "Inventario" : "Inventory"
                              : es ? "Gasto" : "Expense"}
                          </td>

                          <td className="p-3 text-right font-bold">
                            −{money(movement.amountCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-[#806b5d]">
              {es
                ? "Las compras y gastos son salidas de dinero. No equivalen automáticamente a la utilidad: para calcularla necesitamos el costo de los ingredientes efectivamente consumidos."
                : "Purchases and expenses are cash outflows, not automatically profit. Profit requires the cost of ingredients actually consumed."}
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}
