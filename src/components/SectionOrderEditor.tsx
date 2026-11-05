
"use client";

import { useMemo } from "react";

// ============================================
// ¿TODAVÍA HAY?
// EDITOR DE ORDEN Y VISIBILIDAD DE SECCIONES
// ============================================

export const PAGE_SECTION_IDS = [
  "menu",
  "chat",
  "rewards",
  "hours",
  "location",
  "social",
  "gallery",
] as const;

export type PageSectionId =
  (typeof PAGE_SECTION_IDS)[number];

export type PageSectionConfig = {
  id: PageSectionId;
  visible: boolean;
};

type Props = {
  value: PageSectionConfig[];
  onChange: (
    value: PageSectionConfig[],
  ) => void;
  lang?: "es" | "en";
  disabled?: boolean;
};

const SECTION_LABELS: Record<
  PageSectionId,
  { es: string; en: string }
> = {
  menu: {
    es: "Menú del día",
    en: "Today's menu",
  },
  chat: {
    es: "Haz tu apartado",
    en: "Reserve your order",
  },
  rewards: {
    es: "Programa de recompensas",
    en: "Rewards program",
  },
  hours: {
    es: "Horarios de atención",
    en: "Opening hours",
  },
  location: {
    es: "Ubicación",
    en: "Location",
  },
  social: {
    es: "Contacto y redes sociales",
    en: "Contact and social media",
  },
  gallery: {
    es: "Galería de fotografías",
    en: "Photo gallery",
  },
};

export const DEFAULT_PAGE_SECTIONS:
  PageSectionConfig[] =
  PAGE_SECTION_IDS.map((id) => ({
    id,
    visible: true,
  }));

export function normalizePageSections(
  input: unknown,
): PageSectionConfig[] {
  if (!Array.isArray(input)) {
    return DEFAULT_PAGE_SECTIONS.map(
      (section) => ({ ...section }),
    );
  }

  const allowed = new Set<string>(
    PAGE_SECTION_IDS,
  );

  const seen = new Set<string>();

  const result: PageSectionConfig[] = [];

  for (const item of input) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("id" in item) ||
      typeof item.id !== "string" ||
      !allowed.has(item.id) ||
      seen.has(item.id)
    ) {
      continue;
    }

    seen.add(item.id);

    result.push({
      id: item.id as PageSectionId,
      visible:
        "visible" in item &&
        typeof item.visible === "boolean"
          ? item.visible
          : true,
    });
  }

  for (const id of PAGE_SECTION_IDS) {
    if (!seen.has(id)) {
      result.push({
        id,
        visible: true,
      });
    }
  }

  return result;
}

export default function SectionOrderEditor({
  value,
  onChange,
  lang = "es",
  disabled = false,
}: Props) {
  const sections = useMemo(
    () => normalizePageSections(value),
    [value],
  );

  const es = lang === "es";

  function move(
    index: number,
    direction: -1 | 1,
  ) {
    if (disabled) return;

    const destination = index + direction;

    if (
      destination < 0 ||
      destination >= sections.length
    ) {
      return;
    }

    const next = sections.map(
      (section) => ({ ...section }),
    );

    [next[index], next[destination]] = [
      next[destination],
      next[index],
    ];

    onChange(next);
  }

  function setVisibility(
    id: PageSectionId,
    visible: boolean,
  ) {
    if (disabled) return;

    onChange(
      sections.map((section) =>
        section.id === id
          ? { ...section, visible }
          : section,
      ),
    );
  }

  function reset() {
    if (disabled) return;

    onChange(
      DEFAULT_PAGE_SECTIONS.map(
        (section) => ({ ...section }),
      ),
    );
  }

  const visibleSections = sections.filter(
    (section) => section.visible,
  );

  return (
    <section className="rounded-3xl border border-[#eaded3] bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#302018]">
            {es
              ? "Organizar mi página"
              : "Organize my page"}
          </h2>

          <p className="mt-2 text-sm leading-6 text-[#80695d]">
            {es
              ? "Decide qué secciones podrán ver tus clientes y en qué orden aparecerán."
              : "Choose which sections customers can see and their display order."}
          </p>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={reset}
          className="rounded-xl border border-[#eaded3] bg-[#fffaf4] px-4 py-2 text-xs font-bold text-[#a3341f] transition hover:bg-[#fff1e7] disabled:opacity-50"
        >
          {es
            ? "Restablecer orden"
            : "Reset order"}
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {sections.map((section, index) => (
          <div
            key={section.id}
            className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 transition sm:flex-nowrap ${
              section.visible
                ? "border-[#eaded3] bg-[#fffaf4]"
                : "border-[#eee7e0] bg-[#f7f5f2] opacity-70"
            }`}
          >
            {/* NÚMERO */}

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black text-[#a3341f]">
              {index + 1}
            </div>

            {/* NOMBRE */}

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#302018]">
                {
                  SECTION_LABELS[section.id][
                    lang
                  ]
                }
              </p>

              <p className="mt-1 text-xs text-[#80695d]">
                {section.visible
                  ? es
                    ? "Visible para los clientes"
                    : "Visible to customers"
                  : es
                    ? "Sección oculta"
                    : "Hidden section"}
              </p>
            </div>

            {/* VISIBILIDAD */}

            <label className="flex shrink-0 cursor-pointer items-center gap-2">
              <span className="text-xs font-semibold text-[#4b3024]">
                {es ? "Mostrar" : "Show"}
              </span>

              <input
                type="checkbox"
                checked={section.visible}
                disabled={disabled}
                onChange={(event) =>
                  setVisibility(
                    section.id,
                    event.target.checked,
                  )
                }
                className="h-5 w-5 accent-[#a3341f]"
                aria-label={
                  es
                    ? `Mostrar ${SECTION_LABELS[section.id].es}`
                    : `Show ${SECTION_LABELS[section.id].en}`
                }
              />
            </label>

            {/* ORDEN */}

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={
                  disabled || index === 0
                }
                onClick={() =>
                  move(index, -1)
                }
                title={
                  es
                    ? "Subir sección"
                    : "Move section up"
                }
                aria-label={
                  es
                    ? `Subir ${SECTION_LABELS[section.id].es}`
                    : `Move ${SECTION_LABELS[section.id].en} up`
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#eaded3] bg-white text-lg font-bold text-[#a3341f] transition hover:bg-[#fff1e7] disabled:cursor-not-allowed disabled:opacity-30"
              >
                ↑
              </button>

              <button
                type="button"
                disabled={
                  disabled ||
                  index === sections.length - 1
                }
                onClick={() =>
                  move(index, 1)
                }
                title={
                  es
                    ? "Bajar sección"
                    : "Move section down"
                }
                aria-label={
                  es
                    ? `Bajar ${SECTION_LABELS[section.id].es}`
                    : `Move ${SECTION_LABELS[section.id].en} down`
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#eaded3] bg-white text-lg font-bold text-[#a3341f] transition hover:bg-[#fff1e7] disabled:cursor-not-allowed disabled:opacity-30"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* RESUMEN DEL ORDEN */}

      <div className="mt-6 rounded-2xl border border-[#f0dfcf] bg-[#fff7ef] p-4">
        <h3 className="text-sm font-black text-[#302018]">
          {es
            ? "Así se organizará tu página"
            : "Your page order"}
        </h3>

        {visibleSections.length > 0 ? (
          <ol className="mt-3 space-y-2">
            {visibleSections.map(
              (section, index) => (
                <li
                  key={section.id}
                  className="flex items-center gap-3 text-sm text-[#60483d]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-[#a3341f]">
                    {index + 1}
                  </span>

                  <span>
                    {
                      SECTION_LABELS[
                        section.id
                      ][lang]
                    }
                  </span>
                </li>
              ),
            )}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-[#80695d]">
            {es
              ? "No hay secciones visibles."
              : "No visible sections."}
          </p>
        )}
      </div>

      <p className="mt-4 text-xs leading-5 text-[#80695d]">
        {es
          ? "La portada principal permanece en el encabezado. Los cambios de orden deben guardarse junto con la configuración del negocio."
          : "The main cover stays in the header. Section order changes must be saved with the business settings."}
      </p>
    </section>
  );
}
