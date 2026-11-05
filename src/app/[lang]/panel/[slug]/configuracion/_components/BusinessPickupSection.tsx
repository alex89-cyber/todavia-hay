"use client";

import type { PickupSettings, StallSettings } from "@/lib/stall";
import { DEFAULT_PICKUP } from "@/lib/pickup";

import { Section } from "./ConfigurationFields";

// Reglas de "Recoger": para ahorita, aviso al negocio, horarios y tolerancia.

type Props = {
  lang: "es" | "en";
  settings: StallSettings;
  onSettingsChange: (patch: Partial<StallSettings>) => void;
  disabled?: boolean;
};

type Field = {
  key: keyof PickupSettings;
  es: [string, string];
  en: [string, string];
  min: number;
  max: number;
  optional?: boolean;
};

const FIELDS: Field[] = [
  {
    key: "asapMinutes",
    es: ["Para ahorita: listo en", "Lo que ve el cliente: \"listo en aprox. 30 min\"."],
    en: ["Right now: ready in", "What customers see: \"ready in about 30 min\"."],
    min: 1,
    max: 240,
  },
  {
    key: "noticeMinutes",
    es: ["Aviso para preparar", "Minutos antes de la hora elegida. Igual para todos los pedidos y también es la anticipación mínima."],
    en: ["Prep notice", "Minutes before the chosen time. Same for every order, and also the minimum notice."],
    min: 0,
    max: 240,
  },
  {
    key: "slotMinutes",
    es: ["Horarios cada", "Por ejemplo 15: el cliente ve 3:00, 3:15, 3:30…"],
    en: ["Times every", "For example 15: customers see 3:00, 3:15, 3:30…"],
    min: 5,
    max: 120,
  },
  {
    key: "maxPerSlot",
    es: ["Máximo de pedidos por horario", "Déjalo vacío para no poner límite."],
    en: ["Max orders per time", "Leave empty for no limit."],
    min: 1,
    max: 500,
    optional: true,
  },
  {
    key: "toleranceMinutes",
    es: ["Tolerancia", "Cuánto esperas después de la hora antes de cobrar un pedido que nadie recogió."],
    en: ["Grace period", "How long you wait after the time before charging an order nobody picked up."],
    min: 0,
    max: 240,
  },
];

export default function BusinessPickupSection({ lang, settings, onSettingsChange, disabled = false }: Props) {
  const es = lang === "es";
  const pickup: PickupSettings = { ...DEFAULT_PICKUP, ...settings.pickup };

  function set(key: keyof PickupSettings, raw: string, field: Field) {
    const n = raw.trim() === "" ? null : Math.round(Number(raw));
    if (n !== null && !Number.isFinite(n)) return;
    const value = n === null ? (field.optional ? null : field.min) : Math.min(field.max, Math.max(field.min, n));
    onSettingsChange({ pickup: { ...pickup, [key]: value } });
  }

  return (
    <Section
      title={es ? "Recoger" : "Pickup"}
      description={
        es
          ? "Cómo piden tus clientes: para ahorita o para una hora de hoy, siempre dentro de tu horario. Si nadie recoge un pedido, se cobra pasada la tolerancia."
          : "How customers order: for right now or for a time today, always within your hours. Orders nobody picks up are charged after the grace period."
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const [label, hint] = es ? f.es : f.en;
          const value = pickup[f.key];
          return (
            <label key={f.key} className="block rounded-2xl border border-[#eaded3] p-4">
              <span className="text-sm font-bold text-[#302018]">{label}</span>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={f.min}
                  max={f.max}
                  value={value ?? ""}
                  placeholder={f.optional ? (es ? "Sin límite" : "No limit") : undefined}
                  disabled={disabled}
                  onChange={(e) => set(f.key, e.target.value, f)}
                  className="w-28 rounded-xl border border-[#eaded3] bg-white px-4 py-3 text-sm text-[#302018] outline-none focus:border-[#a3341f]"
                />
                <span className="text-sm text-[#80695d]">
                  {f.key === "maxPerSlot" ? (es ? "pedidos" : "orders") : "min"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#80695d]">{hint}</p>
            </label>
          );
        })}
      </div>
    </Section>
  );
}
