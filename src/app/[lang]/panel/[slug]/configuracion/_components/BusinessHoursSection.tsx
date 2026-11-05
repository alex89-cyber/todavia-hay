
"use client";

import type {
  StallOpeningHour,
  StallSettings,
} from "@/lib/stall";

import { Section } from "./ConfigurationFields";

// ==========================================
// DÍAS DE LA SEMANA
// ==========================================

const DAYS = [
  ["Domingo", "Sunday"],
  ["Lunes", "Monday"],
  ["Martes", "Tuesday"],
  ["Miércoles", "Wednesday"],
  ["Jueves", "Thursday"],
  ["Viernes", "Friday"],
  ["Sábado", "Saturday"],
] as const;

// JavaScript usa domingo = 0 y sábado = 6.

const DEFAULT_HOURS: StallOpeningHour[] =
  DAYS.map((_, day) => ({
    day,
    enabled: day !== 0,
    open: "09:00",
    close: "18:00",
  }));

type Props = {
  lang: "es" | "en";
  settings: StallSettings;
  onSettingsChange: (
    patch: Partial<StallSettings>,
  ) => void;
  disabled?: boolean;
};

// ==========================================
// HORARIO POR DÍA
// ==========================================

function DayHoursRow({
  day,
  hour,
  lang,
  disabled,
  onChange,
}: {
  day: number;
  hour: StallOpeningHour;
  lang: "es" | "en";
  disabled: boolean;
  onChange: (
    patch: Partial<StallOpeningHour>,
  ) => void;
}) {
  const es = lang === "es";

  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        hour.enabled
          ? "border-[#eaded3] bg-white"
          : "border-[#eee6df] bg-[#f8f5f2]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-[#302018]">
            {DAYS[day][es ? 0 : 1]}
          </h3>

          <p className="mt-1 text-xs text-[#80695d]">
            {hour.enabled
              ? es
                ? "Día de atención"
                : "Open for business"
              : es
                ? "Día de descanso"
                : "Closed"}
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-3">
          <span className="text-xs font-semibold text-[#60483d]">
            {es ? "Abrir" : "Open"}
          </span>

          <input
            type="checkbox"
            checked={hour.enabled}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                enabled: event.target.checked,
              })
            }
            className="h-5 w-5 accent-[#a3341f]"
          />
        </label>
      </div>

      {hour.enabled && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-[#60483d]">
              {es
                ? "Hora de apertura"
                : "Opening time"}
            </span>

            <input
              type="time"
              value={hour.open}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  open: event.target.value,
                })
              }
              className="mt-2 w-full rounded-xl border border-[#eaded3] bg-white px-4 py-3 text-sm text-[#302018] outline-none focus:border-[#a3341f]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[#60483d]">
              {es
                ? "Hora de cierre"
                : "Closing time"}
            </span>

            <input
              type="time"
              value={hour.close}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  close: event.target.value,
                })
              }
              className="mt-2 w-full rounded-xl border border-[#eaded3] bg-white px-4 py-3 text-sm text-[#302018] outline-none focus:border-[#a3341f]"
            />
          </label>
        </div>
      )}
    </div>
  );
}

// ==========================================
// SECCIÓN COMPLETA DE HORARIOS
// ==========================================

export default function BusinessHoursSection({
  lang,
  settings,
  onSettingsChange,
  disabled = false,
}: Props) {
  const es = lang === "es";

  const savedHours = settings.openingHours ?? [];

  // Asegura que siempre aparezcan los siete días,
  // incluso cuando un negocio tenga datos antiguos.

  const hours = DEFAULT_HOURS.map(
    (defaultHour) => {
      const saved = savedHours.find(
        (hour) => hour.day === defaultHour.day,
      );

      return saved
        ? { ...defaultHour, ...saved }
        : { ...defaultHour };
    },
  );

  function updateHour(
    day: number,
    patch: Partial<StallOpeningHour>,
  ) {
    const updated = hours.map(
      (hour) =>
        hour.day === day
          ? { ...hour, ...patch }
          : hour,
    );

    onSettingsChange({
      openingHours: updated,
    });
  }

  function setAllDays(enabled: boolean) {
    onSettingsChange({
      openingHours: hours.map(
        (hour) => ({
          ...hour,
          enabled,
        }),
      ),
    });
  }

  const openDays = hours.filter(
    (hour) => hour.enabled,
  ).length;

  return (
    <Section
      title={
        es
          ? "Horarios de atención"
          : "Opening hours"
      }
      description={
        es
          ? "Define qué días abre tu negocio y sus horarios. Puedes modificarlos cuando quieras."
          : "Choose your business days and opening hours. You can change them at any time."
      }
    >
      <div className="space-y-5">

        {/* RESUMEN */}

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#eaded3] bg-[#fffaf4] p-4">
          <div>
            <p className="text-sm font-bold text-[#302018]">
              {es
                ? "Días de atención"
                : "Business days"}
            </p>

            <p className="mt-1 text-xs text-[#80695d]">
              {es
                ? `${openDays} de 7 días activos`
                : `${openDays} of 7 active days`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                setAllDays(true)
              }
              className="rounded-xl border border-[#eaded3] bg-white px-3 py-2 text-xs font-bold text-[#a3341f] transition hover:bg-[#fff1e7] disabled:opacity-50"
            >
              {es
                ? "Abrir todos"
                : "Open all"}
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                setAllDays(false)
              }
              className="rounded-xl border border-[#eaded3] bg-white px-3 py-2 text-xs font-bold text-[#80695d] transition hover:bg-[#f4ede7] disabled:opacity-50"
            >
              {es
                ? "Cerrar todos"
                : "Close all"}
            </button>
          </div>
        </div>

        {/* SIETE DÍAS */}

        <div className="grid gap-3">
          {hours.map((hour) => (
            <DayHoursRow
              key={hour.day}
              day={hour.day}
              hour={hour}
              lang={lang}
              disabled={disabled}
              onChange={(patch) =>
                updateHour(
                  hour.day,
                  patch,
                )
              }
            />
          ))}
        </div>

        {/* NOTA */}

        <p className="text-xs leading-5 text-[#80695d]">
          {es
            ? "Estos son los horarios habituales del negocio. El estado Abierto o Cerrado de las ventas se administra por separado desde el panel del dueño."
            : "These are the usual opening hours. The Open or Closed sales status is managed separately from the owner's panel."}
        </p>
      </div>
    </Section>
  );
}
