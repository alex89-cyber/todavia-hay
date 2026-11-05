
"use client";

import type {
  StallSettings,
} from "@/lib/stall";

import SectionOrderEditor, {
  DEFAULT_PAGE_SECTIONS,
  normalizePageSections,
} from "@/components/SectionOrderEditor";

import {
  Section,
  SwitchField,
} from "./ConfigurationFields";

// ==========================================
// TIPOS
// ==========================================

type Props = {
  lang: "es" | "en";
  settings: StallSettings;

  onSettingsChange: (
    patch: Partial<StallSettings>,
  ) => void;

  disabled?: boolean;
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function BusinessSectionsEditor({
  lang,
  settings,
  onSettingsChange,
  disabled = false,
}: Props) {
  const es = lang === "es";

  const sections = normalizePageSections(
    settings.sectionOrder ??
      DEFAULT_PAGE_SECTIONS.map((section) => ({
        ...section,
        visible:
          section.id === "location"
            ? settings.showLocation !== false
            : section.id === "hours"
              ? settings.showOpeningHours !== false
              : section.id === "social"
                ? settings.showSocialLinks !== false
                : section.id === "gallery"
                  ? settings.showGallery !== false
                  : true,
      })),
  );

  function changeSections(
    next: typeof sections,
  ) {
    const isVisible = (
      id: (typeof sections)[number]["id"],
    ) =>
      next.find(
        (section) => section.id === id,
      )?.visible !== false;

    onSettingsChange({
      sectionOrder: next,

      // Compatibilidad con los campos anteriores.
      showLocation: isVisible("location"),
      showOpeningHours: isVisible("hours"),
      showSocialLinks: isVisible("social"),
      showGallery: isVisible("gallery"),
    });
  }

  return (
    <div className="space-y-6">

      {/* ==================================
          ORGANIZAR SECCIONES
      ================================== */}

      <SectionOrderEditor
        lang={lang}
        disabled={disabled}
        value={sections}
        onChange={changeSections}
      />

      {/* ==================================
          ELEMENTOS DEL ENCABEZADO
      ================================== */}

      <Section
        title={
          es
            ? "Elementos del encabezado"
            : "Header elements"
        }
        description={
          es
            ? "La portada y la descripción permanecen en la parte superior. Puedes mostrarlas u ocultarlas."
            : "The cover and description stay at the top. You can show or hide them."
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <SwitchField
            label={
              es
                ? "Mostrar portada"
                : "Show cover"
            }
            checked={
              settings.showCover !== false
            }
            onChange={(value) =>
              onSettingsChange({
                showCover: value,
              })
            }
          />

          <SwitchField
            label={
              es
                ? "Mostrar descripción"
                : "Show description"
            }
            checked={
              settings.showDescription !== false
            }
            onChange={(value) =>
              onSettingsChange({
                showDescription: value,
              })
            }
          />
        </div>

        <p className="mt-4 text-xs leading-5 text-[#80695d]">
          {es
            ? "La fotografía principal permanecerá como encabezado. El resto de las secciones podrá organizarse en el orden que elijas."
            : "The main cover remains in the header. The other sections can be arranged in your chosen order."}
        </p>
      </Section>
    </div>
  );
}
