
"use client";

import type { StallSettings } from "@/lib/stall";

import {
  Section,
  Field,
} from "./ConfigurationFields";

type Props = {
  lang: "es" | "en";
  settings: StallSettings;
  onSettingsChange: (
    patch: Partial<StallSettings>,
  ) => void;
};

export default function BusinessLocationSection({
  lang,
  settings,
  onSettingsChange,
}: Props) {
  const es = lang === "es";

  function update(
    key: keyof StallSettings,
    value: string,
  ) {
    onSettingsChange({
      [key]: value,
    });
  }

  const addressPreview = [
    settings.address,
    settings.city,
    settings.state,
    settings.postalCode,
    settings.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Section
      title={
        es
          ? "Ubicación del negocio"
          : "Business location"
      }
      description={
        es
          ? "Configura la dirección y el enlace de Google Maps para que tus clientes puedan encontrarte."
          : "Set your address and Google Maps link so customers can find your business."
      }
    >
      <div className="grid gap-5">
        <Field
          label={es ? "Dirección" : "Address"}
          value={settings.address ?? ""}
          maxLength={300}
          placeholder={
            es
              ? "Calle, número y colonia"
              : "Street, number and neighborhood"
          }
          onChange={(value) =>
            update("address", value)
          }
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={es ? "Ciudad" : "City"}
            value={settings.city ?? ""}
            maxLength={120}
            onChange={(value) =>
              update("city", value)
            }
          />

          <Field
            label={es ? "Estado" : "State"}
            value={settings.state ?? ""}
            maxLength={120}
            onChange={(value) =>
              update("state", value)
            }
          />

          <Field
            label={
              es
                ? "Código postal"
                : "Postal code"
            }
            value={settings.postalCode ?? ""}
            maxLength={20}
            onChange={(value) =>
              update("postalCode", value)
            }
          />

          <Field
            label={es ? "País" : "Country"}
            value={settings.country ?? ""}
            maxLength={120}
            onChange={(value) =>
              update("country", value)
            }
          />
        </div>

        <Field
          label="Google Maps URL"
          value={settings.googleMapsUrl ?? ""}
          type="url"
          maxLength={2048}
          placeholder="https://maps.google.com/..."
          onChange={(value) =>
            update("googleMapsUrl", value)
          }
        />

        {addressPreview && (
          <div className="rounded-2xl border border-[#eaded3] bg-[#fffaf4] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#a3341f]">
              {es
                ? "Vista previa de la dirección"
                : "Address preview"}
            </p>

            <p className="mt-2 text-sm text-[#302018]">
              📍 {addressPreview}
            </p>

            {settings.googleMapsUrl &&
              /^https?:\/\//i.test(
                settings.googleMapsUrl,
              ) && (
                <a
                  href={settings.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-bold text-[#a3341f] underline"
                >
                  {es
                    ? "Abrir ubicación en Google Maps ↗"
                    : "Open location in Google Maps ↗"}
                </a>
              )}
          </div>
        )}
      </div>
    </Section>
  );
}
