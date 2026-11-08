
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Plan = "basic" | "medium" | "plus";

export type PlatformBusiness = {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
};

const PLAN_NAMES: Record<Plan, string> = {
  basic: "Básico",
  medium: "Medium",
  plus: "Plus",
};

function BusinessCard({
  business,
}: {
  business: PlatformBusiness;
}) {
  const router = useRouter();

  const [plan, setPlan] =
    useState<Plan>(business.plan);

  const [saved, setSaved] =
    useState<Plan>(business.plan);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function savePlan() {
    if (loading || plan === saved) return;

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/platform/plans",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            businessId: business.id,
            plan,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "No se pudo actualizar el plan.",
        );
      }

      setSaved(plan);
      setMessage("Plan actualizado correctamente.");

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="rounded-3xl border border-[#E3E8E0] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-3xl">🏪</div>

          <h3 className="mt-3 text-lg font-black text-[#244D38]">
            {business.name}
          </h3>

          <p className="mt-1 break-all text-xs text-gray-500">
            {business.slug}
          </p>
        </div>

        <span className="rounded-full bg-[#EAF3E8] px-3 py-1 text-xs font-bold text-[#244D38]">
          {PLAN_NAMES[saved]}
        </span>
      </div>

      <div className="mt-6">
        <label
          htmlFor={`plan-${business.id}`}
          className="text-sm font-bold"
        >
          Plan contratado
        </label>

        <select
          id={`plan-${business.id}`}
          value={plan}
          disabled={loading}
          onChange={(event) =>
            setPlan(event.target.value as Plan)
          }
          className="mt-2 w-full rounded-xl border border-[#DDD3C7] bg-[#FAF7F2] px-4 py-3"
        >
          <option value="basic">
            Básico — Solo propietario
          </option>

          <option value="medium">
            Medium — Empleados y mesas
          </option>

          <option value="plus">
            Plus — Incluye cocina
          </option>
        </select>
      </div>

      <button
        type="button"
        onClick={savePlan}
        disabled={loading || plan === saved}
        className="mt-4 w-full rounded-full bg-[#244D38] px-5 py-3 font-bold text-white disabled:opacity-40"
      >
        {loading
          ? "Guardando..."
          : "Guardar plan"}
      </button>

      {message && (
        <p
          role="status"
          className="mt-3 text-sm font-semibold text-green-700"
        >
          {message}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 text-sm font-semibold text-red-700"
        >
          {error}
        </p>
      )}
    </article>
  );
}

export function PlatformAdminPanel({
  businesses,
}: {
  businesses: PlatformBusiness[];
}) {
  const [search, setSearch] = useState("");

  const filtered = businesses.filter(
    (business) =>
      `${business.name} ${business.slug}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );

  const totals = {
    basic: businesses.filter(
      (b) => b.plan === "basic",
    ).length,

    medium: businesses.filter(
      (b) => b.plan === "medium",
    ).length,

    plus: businesses.filter(
      (b) => b.plan === "plus",
    ).length,
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Negocios",
            value: businesses.length,
          },
          {
            label: "Básico",
            value: totals.basic,
          },
          {
            label: "Medium",
            value: totals.medium,
          },
          {
            label: "Plus",
            value: totals.plus,
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-[#E3E8E0] bg-white p-5"
          >
            <p className="text-xs text-gray-500">
              {metric.label}
            </p>

            <p className="mt-2 text-3xl font-black text-[#244D38]">
              {metric.value}
            </p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-xl font-black">
          Administrar negocios
        </h2>

        <p className="mt-2 text-sm text-gray-600">
          Selecciona el plan contratado
          por cada establecimiento.
        </p>

        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Buscar negocio..."
          className="mt-5 w-full rounded-xl border border-[#DDD3C7] bg-white px-4 py-3 outline-none focus:border-[#244D38]"
        />

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {filtered.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="mt-6 text-sm text-gray-500">
            No se encontraron negocios.
          </p>
        )}
      </section>
    </div>
  );
}
