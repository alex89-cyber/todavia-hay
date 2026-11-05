
"use client";

import type { ReactNode } from "react";

type Props = {
  reservations: ReactNode;
  pin: ReactNode;
  hasReservations: boolean;
  lang: string;
};

export function OwnerOperationsPanel({
  reservations,
  pin,
  hasReservations,
  lang,
}: Props) {
  const es = lang !== "en";

  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-4 px-4 pt-7 sm:px-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)] lg:gap-5 lg:px-8">
      {/* IZQUIERDA: APARTADOS REALES */}
      <div className="min-w-0 overflow-hidden rounded-3xl border border-[#eaded3] bg-white shadow-sm">
        {hasReservations ? (
          <div className="[&>section]:px-5 [&>section]:pb-6 [&>section]:pt-5 sm:[&>section]:px-6">
            {reservations}
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a63822]">
              {es ? "Pedidos" : "Orders"}
            </p>

            <h2 className="mt-2 text-2xl font-black text-[#302018]">
              {es ? "Apartados" : "Reservations"}
            </h2>

            <p className="mt-3 rounded-2xl bg-[#fff8f2] p-4 text-sm text-[#80695d]">
              {es
                ? "Todavía no hay apartados registrados."
                : "No reservations yet."}
            </p>
          </div>
        )}
      </div>

      {/* DERECHA: PIN DEL NEGOCIO */}
      <div className="min-w-0">
        {pin}
      </div>
    </div>
  );
}
