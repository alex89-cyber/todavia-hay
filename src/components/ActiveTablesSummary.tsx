"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { TabsSnapshot } from "@/app/api/businesses/[slug]/table-tabs/route";

// Resumen de mesas en el panel del dueño: cuántas están ocupadas y cuánto
// llevan sus cuentas. Toca para ir a Mesas.

type Props = {
  slug: string;
  lang: string;
};

export default function ActiveTablesSummary({ slug, lang }: Props) {
  const es = lang !== "en";
  const [data, setData] = useState<TabsSnapshot | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(slug)}/table-tabs`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(String(response.status));
      setData((await response.json()) as TabsSnapshot);
      setError(false);
    } catch (err) {
      console.error("Error al consultar mesas:", err);
      setError(true);
    }
  }, [slug]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 30_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const active = data ? data.tables.filter((t) => t.active).length : 0;
  const busy = data ? data.tabs.length : 0;
  const open = data ? data.tabs.reduce((sum, t) => sum + t.totalCents - t.paidCents, 0) : 0;
  const money = new Intl.NumberFormat(es ? "es-MX" : "en-US", {
    style: "currency",
    currency: data?.currency ?? "MXN",
  });

  return (
    <section className="px-4 pt-6 sm:px-6 lg:px-8">
      <Link
        href={`/${es ? "es" : "en"}/empleado/mesas/${slug}`}
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#eaded3] bg-white p-5 shadow-sm transition hover:border-[#a63822]"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#a63822]">
            {es ? "Mesas" : "Tables"}
          </p>
          <h2 className="mt-1 text-lg font-black text-[#302018]">
            {es ? "Mesas ocupadas" : "Busy tables"}
          </h2>
          <p className="mt-1 text-xs text-[#806b5d]">
            {error
              ? es
                ? "No disponible"
                : "Unavailable"
              : busy > 0
                ? es
                  ? `${money.format(open / 100)} por cobrar`
                  : `${money.format(open / 100)} to collect`
                : es
                  ? "Toca para agregar o editar mesas"
                  : "Tap to add or edit tables"}
          </p>
        </div>

        <p className="text-4xl font-black tabular-nums text-[#a63822]" aria-live="polite">
          {error || !data ? "—" : `${busy}/${active}`}
        </p>
      </Link>
    </section>
  );
}
