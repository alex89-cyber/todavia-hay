
"use client";

import { useCallback, useEffect, useState } from "react";

type RestaurantTable = {
  id: string;
  active: boolean;
};

type Props = {
  slug: string;
  lang: string;
};

export default function ActiveTablesSummary({
  slug,
  lang,
}: Props) {
  const es = lang !== "en";

  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(slug)}/tables`,
        {
          cache: "no-store",
          credentials: "same-origin",
        },
      );

      if (!response.ok) {
        throw new Error("No se pudieron consultar las mesas.");
      }

      const data: {
        tables?: RestaurantTable[];
      } = await response.json();

      const active = (data.tables ?? []).filter(
        (table) => table.active,
      ).length;

      setTotal(active);
      setError(false);
    } catch (err) {
      console.error("Error al consultar mesas:", err);
      setError(true);
    }
  }, [slug]);

  useEffect(() => {
    void load();

    // Actualizar al regresar a la pestaña.
    function onFocus() {
      void load();
    }

    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  return (
    <section className="px-4 pt-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#eaded3] bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#a63822]">
            {es ? "Restaurante" : "Restaurant"}
          </p>

          <h2 className="mt-1 text-lg font-black text-[#302018]">
            {es ? "Mesas activas" : "Active tables"}
          </h2>

          <p className="mt-1 text-xs text-[#806b5d]">
            {es
              ? "Mesas habilitadas en tu restaurante"
              : "Tables enabled at your restaurant"}
          </p>
        </div>

        <div
          className="text-right"
          aria-live="polite"
        >
          <p className="text-4xl font-black tabular-nums text-[#a63822]">
            {error ? "—" : total ?? "…"}
          </p>

          <p className="mt-1 text-xs text-[#806b5d]">
            {error
              ? es
                ? "No disponible"
                : "Unavailable"
              : es
                ? "mesas activas"
                : "active tables"}
          </p>
        </div>
      </div>
    </section>
  );
}
