
"use client";

import type {
  StallCoverPosition,
  StallTheme,
} from "@/lib/stall";

import {
  Section,
  ColorField,
  SwitchField,
} from "./ConfigurationFields";

// ==========================================
// TIPOS
// ==========================================

type Props = {
  lang: "es" | "en";
  name: string;
  theme: StallTheme;

  onThemeChange: (
    patch: Partial<StallTheme>,
  ) => void;
};

// ==========================================
// COLORES Y CONTRASTE
// ==========================================

function validHex(
  value: string | undefined,
  fallback: string,
): string {
  return value &&
    /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : fallback;
}

function needsWhiteText(hex: string): boolean {
  const channels = [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ].map((value) => {
    const v = value / 255;

    return v <= 0.04045
      ? v / 12.92
      : ((v + 0.055) / 1.055) ** 2.4;
  });

  const luminance =
    channels[0] * 0.2126 +
    channels[1] * 0.7152 +
    channels[2] * 0.0722;

  return luminance < 0.179;
}

// ==========================================
// SELECTOR DE DISEÑO DE PORTADA
// ==========================================

function CoverDesignSelector({
  value,
  onChange,
  lang,
}: {
  value: StallCoverPosition;
  onChange: (value: StallCoverPosition) => void;
  lang: "es" | "en";
}) {
  const es = lang === "es";

  const designs: {
    value: StallCoverPosition;
    label: string;
    description: string;
  }[] = [
    {
      value: "right",
      label: es
        ? "Portada a la derecha"
        : "Cover on the right",
      description: es
        ? "Información a la izquierda y fotografía a la derecha."
        : "Information on the left and photo on the right.",
    },
    {
      value: "background",
      label: es
        ? "Portada de fondo"
        : "Background cover",
      description: es
        ? "La fotografía ocupa el encabezado con una tarjeta encima."
        : "The photo fills the header with an information card on top.",
    },
  ];

  return (
    <fieldset>
      <legend className="mb-3 text-sm font-bold text-[#4b3024]">
        {es
          ? "Diseño de portada"
          : "Cover design"}
      </legend>

      <div className="grid gap-4 sm:grid-cols-2">
        {designs.map((design) => {
          const selected =
            value === design.value;

          return (
            <label
              key={design.value}
              className={`cursor-pointer overflow-hidden rounded-2xl border-2 bg-white transition ${
                selected
                  ? "border-[#a3341f] ring-2 ring-[#a3341f]/15"
                  : "border-[#eaded3] hover:border-[#cfa28d]"
              }`}
            >
              <input
                type="radio"
                name="coverPosition"
                value={design.value}
                checked={selected}
                onChange={() =>
                  onChange(design.value)
                }
                className="sr-only"
              />

              {/* MINIATURA DEL DISEÑO */}

              <div className="p-3">
                <div
                  className={`relative h-32 overflow-hidden rounded-xl ${
                    design.value === "right"
                      ? "grid grid-cols-2"
                      : "flex items-center p-3"
                  }`}
                  style={{
                    background:
                      "linear-gradient(135deg, #a85c3d, #e9ab74)",
                  }}
                >
                  {design.value === "right" ? (
                    <>
                      <div className="flex flex-col justify-center gap-2 bg-white p-3">
                        <div className="h-5 w-5 rounded-md bg-[#d4a890]" />
                        <div className="h-2 w-4/5 rounded bg-[#9e6a51]" />
                        <div className="h-1.5 w-full rounded bg-[#d5beb2]" />
                        <div className="h-1.5 w-3/4 rounded bg-[#d5beb2]" />
                        <div className="h-4 w-1/2 rounded-full bg-[#b36b4f]" />
                      </div>

                      <div className="flex items-center justify-center text-5xl">
                        🍽️
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="absolute right-5 top-6 text-6xl opacity-70">
                        🍽️
                      </span>

                      <div className="relative z-10 flex w-3/5 flex-col gap-2 rounded-lg bg-white/95 p-3 shadow-md">
                        <div className="h-4 w-4 rounded bg-[#d4a890]" />
                        <div className="h-2 w-4/5 rounded bg-[#9e6a51]" />
                        <div className="h-1.5 w-full rounded bg-[#d5beb2]" />
                        <div className="h-1.5 w-3/4 rounded bg-[#d5beb2]" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 px-4 pb-4">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    selected
                      ? "border-[#a3341f] bg-[#a3341f] text-white"
                      : "border-[#c7b5a7] bg-white"
                  }`}
                >
                  {selected ? "✓" : ""}
                </span>

                <div>
                  <p className="text-sm font-bold text-[#302018]">
                    {design.label}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#80695d]">
                    {design.description}
                  </p>
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ==========================================
// SECCIÓN PRINCIPAL DE APARIENCIA
// ==========================================

export default function BusinessAppearanceSection({
  lang,
  name,
  theme,
  onThemeChange,
}: Props) {
  const es = lang === "es";

  const primaryColor = validHex(
    theme.primaryColor,
    "#a3341f",
  );

  const secondaryColor = validHex(
    theme.secondaryColor,
    "#e39b2d",
  );

  const backgroundColor = validHex(
    theme.backgroundColor,
    "#ffffff",
  );

  const textColor = validHex(
    theme.textColor,
    "#2e1b14",
  );

  const buttonColor = validHex(
    theme.buttonColor,
    "#a3341f",
  );

  const headerBackgroundColor = validHex(
    theme.headerBackgroundColor,
    "#ffffff",
  );

  const headerTextColor = validHex(
    theme.headerTextColor,
    "#2e1b14",
  );

  const coverPosition:
    StallCoverPosition =
    theme.coverPosition === "background"
      ? "background"
      : "right";

  return (
    <div className="space-y-6">

      {/* ==================================
          DISEÑO DE PORTADA
      ================================== */}

      <Section
        title={
          es
            ? "Diseño de portada"
            : "Cover design"
        }
        description={
          es
            ? "Elige cómo se muestra la fotografía principal en el encabezado de tu negocio."
            : "Choose how the main photograph appears in your business header."
        }
      >
        <CoverDesignSelector
          value={coverPosition}
          lang={lang}
          onChange={(position) =>
            onThemeChange({
              coverPosition: position,
            })
          }
        />

        <p className="mt-4 text-xs leading-relaxed text-[#80695d]">
          {es
            ? "La opción predeterminada es Portada a la derecha. Puedes cambiar entre los diseños cuando quieras."
            : "The default is Cover on the right. You can change the design at any time."}
        </p>
      </Section>

      {/* ==================================
          DISEÑO Y COLORES
      ================================== */}

      <Section
        title={
          es
            ? "Diseño y colores"
            : "Design and colors"
        }
        description={
          es
            ? "Personaliza el fondo general, el cuadro informativo y sus textos por separado."
            : "Customize the page background, information card and text separately."
        }
      >

        {/* COLORES GENERALES */}

        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField
            label={
              es
                ? "Color principal"
                : "Primary color"
            }
            value={primaryColor}
            onChange={(value) =>
              onThemeChange({
                primaryColor: value,
              })
            }
          />

          <ColorField
            label={
              es
                ? "Color secundario"
                : "Secondary color"
            }
            value={secondaryColor}
            onChange={(value) =>
              onThemeChange({
                secondaryColor: value,
              })
            }
          />

          <ColorField
            label={
              es
                ? "Fondo general"
                : "Page background"
            }
            value={backgroundColor}
            onChange={(value) =>
              onThemeChange({
                backgroundColor: value,
              })
            }
          />

          <ColorField
            label={
              es
                ? "Texto general"
                : "Page text"
            }
            value={textColor}
            onChange={(value) =>
              onThemeChange({
                textColor: value,
              })
            }
          />

          <ColorField
            label={
              es
                ? "Botones"
                : "Buttons"
            }
            value={buttonColor}
            onChange={(value) =>
              onThemeChange({
                buttonColor: value,
              })
            }
          />
        </div>

        {/* COLORES DEL ENCABEZADO */}

        <div className="mt-6 rounded-2xl border border-[#eaded3] bg-[#fffaf4] p-4 sm:p-5">
          <h3 className="text-base font-black text-[#302018]">
            {es
              ? "Cuadro de información"
              : "Information card"}
          </h3>

          <p className="mt-2 text-sm leading-6 text-[#80695d]">
            {es
              ? "Estos colores afectan el cuadro que contiene el logo, nombre, descripción y estado del negocio."
              : "These colors affect the card containing the logo, name, description and business status."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ColorField
              label={
                es
                  ? "Color del cuadro"
                  : "Card background"
              }
              value={headerBackgroundColor}
              onChange={(value) => {
                // Actualizamos ambos colores en una
                // sola operación para evitar que una
                // actualización sobrescriba la otra.
                onThemeChange({
                  headerBackgroundColor: value,
                  headerTextColor:
                    needsWhiteText(value)
                      ? "#ffffff"
                      : "#2e1b14",
                });
              }}
            />

            <ColorField
              label={
                es
                  ? "Texto del cuadro"
                  : "Card text"
              }
              value={headerTextColor}
              onChange={(value) =>
                onThemeChange({
                  headerTextColor: value,
                })
              }
            />
          </div>

          {/* VISTA PREVIA DE LOS COLORES */}

          <div
            className="mt-4 rounded-xl border border-black/10 p-4"
            style={{
              backgroundColor:
                headerBackgroundColor,
              color: headerTextColor,
            }}
          >
            <p className="font-black">
              {name ||
                (es
                  ? "Mi negocio"
                  : "My business")}
            </p>

            <p className="mt-2 text-sm">
              {es
                ? "Así se verá el texto sobre el color seleccionado."
                : "This is how the text looks on the selected color."}
            </p>
          </div>

          <p className="mt-3 text-xs leading-5 text-[#80695d]">
            {es
              ? "Cuando cambias el fondo del cuadro, se sugiere automáticamente un color de texto claro u oscuro. Puedes ajustarlo después."
              : "When you change the card background, a light or dark text color is suggested. You can adjust it afterwards."}
          </p>
        </div>

        {/* TIPOGRAFÍA Y DISTRIBUCIÓN */}

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-[#302018]">
              {es
                ? "Tipografía"
                : "Typography"}
            </span>

            <select
              value={
                theme.typography ?? "modern"
              }
              onChange={(event) =>
                onThemeChange({
                  typography:
                    event.target.value as NonNullable<
                      StallTheme["typography"]
                    >,
                })
              }
              className="mt-2 w-full rounded-xl border border-[#e7d8ca] bg-white px-4 py-3 text-sm text-[#302018]"
            >
              <option value="modern">
                {es ? "Moderna" : "Modern"}
              </option>

              <option value="classic">
                {es ? "Clásica" : "Classic"}
              </option>

              <option value="rounded">
                {es ? "Redondeada" : "Rounded"}
              </option>

              <option value="elegant">
                {es ? "Elegante" : "Elegant"}
              </option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-[#302018]">
              {es
                ? "Distribución"
                : "Layout"}
            </span>

            <select
              value={
                theme.layout ?? "classic"
              }
              onChange={(event) =>
                onThemeChange({
                  layout:
                    event.target.value as NonNullable<
                      StallTheme["layout"]
                    >,
                })
              }
              className="mt-2 w-full rounded-xl border border-[#e7d8ca] bg-white px-4 py-3 text-sm text-[#302018]"
            >
              <option value="classic">
                {es ? "Clásica" : "Classic"}
              </option>

              <option value="grid">
                {es ? "Cuadrícula" : "Grid"}
              </option>

              <option value="compact">
                {es ? "Compacta" : "Compact"}
              </option>
            </select>
          </label>
        </div>

        {/* BORDES REDONDEADOS */}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <SwitchField
            label={
              es
                ? "Tarjetas redondeadas"
                : "Rounded cards"
            }
            checked={
              theme.roundedCards !== false
            }
            onChange={(value) =>
              onThemeChange({
                roundedCards: value,
              })
            }
          />

          <SwitchField
            label={
              es
                ? "Botones redondeados"
                : "Rounded buttons"
            }
            checked={
              theme.roundedButtons !== false
            }
            onChange={(value) =>
              onThemeChange({
                roundedButtons: value,
              })
            }
          />
        </div>
      </Section>
    </div>
  );
}
