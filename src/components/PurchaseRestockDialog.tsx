
"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { OwnerView } from "@/lib/stall";

// ==========================================
// TODAVÍA HAY
// COMPRAS Y REABASTECIMIENTO DE INVENTARIO
// ==========================================

type Ingredient = OwnerView["ingredients"][number];

type Props = {
  slug: string;
  ingredients: Ingredient[];
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
};

type Unit = "g" | "kg" | "ml" | "l" | "pz";

type PurchaseRow = {
  quantity: string;
  cost: string;
  unit: Unit;
};

type PurchaseItem = {
  ingredientId: string;
  quantity: number;
  totalCostCents: number;
};

// ==========================================
// UNIDADES DE MEDIDA
// ==========================================

const UNIT_LABELS: Record<Unit, string> = {
  g: "Gramos (g)",
  kg: "Kilogramos (kg)",
  ml: "Mililitros (ml)",
  l: "Litros (L)",
  pz: "Piezas (pz)",
};

const UNIT_SHORT: Record<Unit, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "L",
  pz: "pz",
};

const UNIT_FACTORS: Record<Unit, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  pz: 1,
};

function isUnit(value: string): value is Unit {
  return value === "g" ||
    value === "kg" ||
    value === "ml" ||
    value === "l" ||
    value === "pz";
}

function compatibleUnits(unit: string): Unit[] {
  if (unit === "g" || unit === "kg") {
    return ["kg", "g"];
  }

  if (unit === "ml" || unit === "l") {
    return ["l", "ml"];
  }

  return ["pz"];
}

// Se selecciona inicialmente la unidad
// del ingrediente definida en el menú.
function defaultUnit(unit: string): Unit {
  return isUnit(unit) ? unit : "pz";
}

// ==========================================
// CONVERSIÓN DE UNIDADES
// ==========================================

function convertQuantity(
  quantity: number,
  from: Unit,
  to: Unit,
): number {
  const fromUnits = compatibleUnits(from);

  if (!fromUnits.includes(to)) {
    throw new Error("Unidades incompatibles");
  }

  return (
    quantity *
    UNIT_FACTORS[from] /
    UNIT_FACTORS[to]
  );
}

// ==========================================
// FORMATO DE DINERO Y CANTIDADES
// ==========================================

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 3,
  }).format(value);
}

// Convertimos pesos a centavos para
// evitar errores de decimales en dinero.
function parseCostCents(value: string): number | null {
  const clean = value.trim();

  if (!/^\d{1,9}(\.\d{1,2})?$/.test(clean)) {
    return null;
  }

  const [pesos, centavos = ""] = clean.split(".");

  return (
    Number(pesos) * 100 +
    Number(centavos.padEnd(2, "0"))
  );
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function PurchaseRestockDialog({
  slug,
  ingredients,
  onCancel,
  onSuccess,
}: Props) {
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");

  const [rows, setRows] = useState<
    Record<string, PurchaseRow>
  >({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ========================================
  // DATOS DE CADA INGREDIENTE
  // ========================================

  function getRow(ingredient: Ingredient): PurchaseRow {
    return rows[ingredient.id] ?? {
      quantity: "",
      cost: "",
      unit: defaultUnit(ingredient.unit),
    };
  }

  function updateRow(
    ingredient: Ingredient,
    field: keyof PurchaseRow,
    value: string,
  ) {
    setRows((previous) => {
      const current = previous[ingredient.id] ?? {
        quantity: "",
        cost: "",
        unit: defaultUnit(ingredient.unit),
      };

      return {
        ...previous,
        [ingredient.id]: {
          ...current,
          [field]: value,
        },
      };
    });

    setError("");
  }

  // ========================================
  // TOTAL DE LA COMPRA
  // ========================================

  const totalCents = useMemo(() => {
    return ingredients.reduce((total, ingredient) => {
      const row = rows[ingredient.id];

      if (!row || !row.quantity.trim()) {
        return total;
      }

      const cents = parseCostCents(row.cost);

      return total + (cents ?? 0);
    }, 0);
  }, [ingredients, rows]);

  const selectedCount = useMemo(() => {
    return ingredients.filter((ingredient) => {
      const row = rows[ingredient.id];

      return row && row.quantity.trim() !== "";
    }).length;
  }, [ingredients, rows]);

  // ========================================
  // GUARDAR COMPRA
  // ========================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (saving) return;

    setError("");

    const items: PurchaseItem[] = [];

    for (const ingredient of ingredients) {
      const row = getRow(ingredient);

      // Ignorar ingredientes no comprados.
      if (
        !row.quantity.trim() &&
        !row.cost.trim()
      ) {
        continue;
      }

      const quantityText = row.quantity.trim();

      // Evitar números negativos, exponentes
      // y cantidades con demasiados decimales.
      if (!/^\d+(\.\d{1,3})?$/.test(quantityText)) {
        setError(
          `Revisa la cantidad de ${ingredient.name}. ` +
          "Utiliza hasta 3 decimales.",
        );
        return;
      }

      const quantity = Number(quantityText);
      const costCents = parseCostCents(row.cost);

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        quantity > 1_000_000
      ) {
        setError(
          `La cantidad de ${ingredient.name} no es válida.`,
        );
        return;
      }

      if (
        costCents === null ||
        costCents <= 0 ||
        costCents > 1_000_000_000
      ) {
        setError(
          `Ingresa un precio válido para ${ingredient.name}.`,
        );
        return;
      }

      if (!isUnit(ingredient.unit)) {
        setError(
          `La unidad de ${ingredient.name} no está soportada.`,
        );
        return;
      }

      const allowedUnits = compatibleUnits(ingredient.unit);

      if (!allowedUnits.includes(row.unit)) {
        setError(
          `La unidad seleccionada para ${ingredient.name} ` +
          "no es compatible con el inventario.",
        );
        return;
      }

      // Convertir a la unidad del inventario.
      //
      // Ejemplo:
      // Compra 5 kg y el inventario está en g.
      // Se guardan 5000 g.
      const converted = convertQuantity(
        quantity,
        row.unit,
        ingredient.unit,
      );

      // Supabase utiliza una precisión
      // de hasta 3 decimales.
      const rounded =
        Math.round(converted * 1000) / 1000;

      if (
        rounded <= 0 ||
        rounded > 1_000_000 ||
        Math.abs(converted - rounded) > 0.00000001
      ) {
        setError(
          `La cantidad de ${ingredient.name} no puede ` +
          `representarse exactamente en ${ingredient.unit}. ` +
          "Prueba con otra cantidad o unidad.",
        );
        return;
      }

      // Las piezas se registran enteras.
      if (
        ingredient.unit === "pz" &&
        !Number.isInteger(rounded)
      ) {
        setError(
          `${ingredient.name} debe registrarse en piezas enteras.`,
        );
        return;
      }

      items.push({
        ingredientId: ingredient.id,
        quantity: rounded,
        totalCostCents: costCents,
      });
    }

    if (items.length === 0) {
      setError(
        "Selecciona al menos un ingrediente para surtir.",
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(slug)}/purchases`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            supplier: supplier.trim(),
            notes: notes.trim(),
            items,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ??
          "No se pudo registrar la compra.",
        );
        return;
      }

      // La compra ya fue confirmada por el servidor.
      await onSuccess();

    } catch (err) {
      console.error("Error de compra:", err);

      setError(
        "No se pudo confirmar la operación. " +
        "Revisa el historial de Supabase antes " +
        "de volver a registrarla para evitar duplicados.",
      );
    } finally {
      setSaving(false);
    }
  }

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-title"
        className="max-h-[95dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 text-gray-900 shadow-xl sm:rounded-3xl sm:p-7"
      >
        <h2
          id="purchase-title"
          className="text-2xl font-black"
        >
          Surtir inventario
        </h2>

        <p className="mt-2 text-sm text-gray-600">
          Registra los ingredientes comprados, su cantidad,
          unidad de medida y precio.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-5 flex flex-col gap-5"
        >
          {/* PROVEEDOR */}
          <div>
            <label
              htmlFor="purchase-supplier"
              className="mb-2 block text-sm font-bold"
            >
              Proveedor (opcional)
            </label>

            <input
              id="purchase-supplier"
              type="text"
              value={supplier}
              maxLength={120}
              onChange={(event) =>
                setSupplier(event.target.value)
              }
              placeholder="Ej. Carnicería del Centro"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-red-700"
            />
          </div>

          {/* INGREDIENTES */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold">
                Ingredientes comprados
              </h3>

              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                {selectedCount} seleccionados
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {ingredients.map((ingredient) => {
                const row = getRow(ingredient);

                const options = compatibleUnits(
                  ingredient.unit,
                );

                const enteredQuantity =
                  Number(row.quantity);

                const cents = parseCostCents(row.cost);

                const validQuantity =
                  Number.isFinite(enteredQuantity) &&
                  enteredQuantity > 0;

                // Costo unitario según la unidad
                // que eligió el dueño para comprar.
                const unitPrice =
                  validQuantity &&
                  cents !== null &&
                  cents > 0
                    ? (cents / 100) / enteredQuantity
                    : null;

                let convertedQuantity: number | null = null;

                if (
                  validQuantity &&
                  isUnit(ingredient.unit) &&
                  options.includes(row.unit)
                ) {
                  convertedQuantity = convertQuantity(
                    enteredQuantity,
                    row.unit,
                    ingredient.unit,
                  );
                }

                return (
                  <div
                    key={ingredient.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4"
                  >
                    {/* NOMBRE Y EXISTENCIA */}
                    <div className="mb-4">
                      <p className="font-bold">
                        {ingredient.name}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Existencia actual:{" "}
                        {formatQuantity(ingredient.stock)}{" "}
                        {UNIT_SHORT[
                          defaultUnit(ingredient.unit)
                        ]}
                      </p>
                    </div>

                    {/* CANTIDAD Y UNIDAD */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`qty-${ingredient.id}`}
                          className="mb-1 block text-sm font-semibold"
                        >
                          Cantidad comprada
                        </label>

                        <input
                          id={`qty-${ingredient.id}`}
                          type="text"
                          inputMode="decimal"
                          value={row.quantity}
                          onChange={(event) =>
                            updateRow(
                              ingredient,
                              "quantity",
                              event.target.value,
                            )
                          }
                          placeholder="Ej. 5"
                          disabled={saving}
                          className="w-full rounded-xl border border-gray-300 px-3 py-3 outline-none focus:border-red-700 disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`unit-${ingredient.id}`}
                          className="mb-1 block text-sm font-semibold"
                        >
                          Unidad de compra
                        </label>

                        <select
                          id={`unit-${ingredient.id}`}
                          value={row.unit}
                          onChange={(event) =>
                            updateRow(
                              ingredient,
                              "unit",
                              event.target.value,
                            )
                          }
                          disabled={saving}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 outline-none focus:border-red-700 disabled:opacity-50"
                        >
                          {options.map((unit) => (
                            <option
                              key={unit}
                              value={unit}
                            >
                              {UNIT_LABELS[unit]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* COSTO */}
                    <div className="mt-3">
                      <label
                        htmlFor={`cost-${ingredient.id}`}
                        className="mb-1 block text-sm font-semibold"
                      >
                        Total pagado ($)
                      </label>

                      <input
                        id={`cost-${ingredient.id}`}
                        type="text"
                        inputMode="decimal"
                        value={row.cost}
                        onChange={(event) =>
                          updateRow(
                            ingredient,
                            "cost",
                            event.target.value,
                          )
                        }
                        placeholder="Ej. 800.00"
                        disabled={saving}
                        className="w-full rounded-xl border border-gray-300 px-3 py-3 outline-none focus:border-red-700 disabled:opacity-50"
                      />
                    </div>

                    {/* RESULTADOS AUTOMÁTICOS */}
                    {validQuantity && (
                      <div className="mt-4 rounded-xl bg-gray-50 p-3">
                        {unitPrice !== null && (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm text-gray-600">
                              Precio unitario
                            </span>

                            <span className="font-bold text-green-700">
                              {formatMoney(unitPrice)}
                              /{UNIT_SHORT[row.unit]}
                            </span>
                          </div>
                        )}

                        {convertedQuantity !== null &&
                          row.unit !== ingredient.unit && (
                            <p className="mt-2 text-xs text-gray-600">
                              Se agregarán{" "}
                              <strong>
                                {formatQuantity(convertedQuantity)}{" "}
                                {ingredient.unit}
                              </strong>{" "}
                              al inventario.
                            </p>
                          )}

                        {convertedQuantity !== null && (
                          <p className="mt-2 text-xs text-gray-500">
                            Existencia estimada después
                            de comprar:{" "}
                            {formatQuantity(
                              ingredient.stock +
                              convertedQuantity,
                            )}{" "}
                            {ingredient.unit}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* OBSERVACIONES */}
          <div>
            <label
              htmlFor="purchase-notes"
              className="mb-2 block text-sm font-bold"
            >
              Observaciones (opcional)
            </label>

            <textarea
              id="purchase-notes"
              value={notes}
              rows={2}
              maxLength={500}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Ej. Compra para el fin de semana"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-red-700"
            />
          </div>

          {/* RESUMEN */}
          <div className="rounded-2xl bg-gray-100 p-5">
            <p className="text-sm font-semibold text-gray-600">
              Total de la compra
            </p>

            <p className="mt-1 text-3xl font-black">
              {formatMoney(totalCents / 100)}
            </p>

            <p className="mt-2 text-xs text-gray-500">
              Este importe se registrará como compra
              de inventario, no como ingreso por ventas.
            </p>
          </div>

          {/* ERRORES */}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          {/* BOTONES */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-xl border border-gray-300 px-4 py-3 font-bold disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                selectedCount === 0 ||
                totalCents <= 0
              }
              className="rounded-xl bg-red-800 px-4 py-3 font-bold text-white disabled:opacity-50"
            >
              {saving
                ? "Guardando..."
                : "Registrar compra"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
