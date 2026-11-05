
"use client";

import type { StallSettings } from "@/lib/stall";

import {
  Section,
  Field,
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
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function BusinessContactSection({
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

  const contactFields = [
    {
      key: "phone",
      label: es
        ? "Teléfono del negocio"
        : "Business phone",
      placeholder: "+52 55 1234 5678",
      type: "tel",
      maxLength: 30,
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      placeholder: "+52 55 1234 5678",
      type: "tel",
      maxLength: 30,
    },
    {
      key: "email",
      label: es
        ? "Correo electrónico"
        : "Email address",
      placeholder: "contacto@minegocio.com",
      type: "email",
      maxLength: 254,
    },
    {
      key: "instagram",
      label: "Instagram",
      placeholder: "https://instagram.com/...",
      type: "url",
      maxLength: 2048,
    },
    {
      key: "facebook",
      label: "Facebook",
      placeholder: "https://facebook.com/...",
      type: "url",
      maxLength: 2048,
    },
    {
      key: "tiktok",
      label: "TikTok",
      placeholder: "https://tiktok.com/@...",
      type: "url",
      maxLength: 2048,
    },
    {
      key: "website",
      label: es
        ? "Página web"
        : "Website",
      placeholder: "https://minegocio.com",
      type: "url",
      maxLength: 2048,
    },
  ] as const;

  return (
    <Section
      title={
        es
          ? "Contacto y redes sociales"
          : "Contact and social media"
      }
      description={
        es
          ? "Agrega los medios por los que tus clientes pueden comunicarse contigo. Deja vacíos los que no utilices."
          : "Add the ways customers can contact your business. Leave unused fields empty."
      }
    >
      <div className="space-y-5">

        {/* TELÉFONO Y WHATSAPP */}

        <div className="grid gap-5 sm:grid-cols-2">
          {contactFields
            .filter(
              (field) =>
                field.key === "phone" ||
                field.key === "whatsapp",
            )
            .map((field) => (
              <Field
                key={field.key}
                label={field.label}
                value={
                  settings[field.key] ?? ""
                }
                type={field.type}
                maxLength={field.maxLength}
                placeholder={field.placeholder}
                onChange={(value) =>
                  update(field.key, value)
                }
              />
            ))}
        </div>

        {/* CORREO ELECTRÓNICO */}

        <Field
          label={
            es
              ? "Correo electrónico"
              : "Email address"
          }
          value={settings.email ?? ""}
          type="email"
          maxLength={254}
          placeholder="contacto@minegocio.com"
          onChange={(value) =>
            update("email", value)
          }
        />

        {/* REDES SOCIALES */}

        <div className="rounded-2xl border border-[#eaded3] bg-[#fffaf4] p-4 sm:p-5">
          <h3 className="text-base font-black text-[#302018]">
            {es
              ? "Redes sociales"
              : "Social media"}
          </h3>

          <p className="mt-2 text-sm leading-6 text-[#80695d]">
            {es
              ? "Escribe los enlaces completos de tus perfiles para que los clientes puedan abrirlos directamente."
              : "Enter the full URLs to your profiles so customers can open them directly."}
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {contactFields
              .filter(
                (field) =>
                  field.key === "instagram" ||
                  field.key === "facebook" ||
                  field.key === "tiktok" ||
                  field.key === "website",
              )
              .map((field) => (
                <Field
                  key={field.key}
                  label={field.label}
                  value={
                    settings[field.key] ?? ""
                  }
                  type={field.type}
                  maxLength={field.maxLength}
                  placeholder={field.placeholder}
                  onChange={(value) =>
                    update(field.key, value)
                  }
                />
              ))}
          </div>
        </div>

        {/* VISTA PREVIA DE CONTACTO */}

        {(settings.phone ||
          settings.whatsapp ||
          settings.email ||
          settings.instagram ||
          settings.facebook ||
          settings.tiktok ||
          settings.website) && (
          <div className="rounded-2xl border border-[#eaded3] bg-white p-4 sm:p-5">
            <h3 className="text-sm font-black text-[#302018]">
              {es
                ? "Información registrada"
                : "Saved contact information"}
            </h3>

            <div className="mt-4 space-y-3 text-sm text-[#60483d]">
              {settings.phone && (
                <p>
                  📞 {settings.phone}
                </p>
              )}

              {settings.whatsapp && (
                <p>
                  💬 WhatsApp: {settings.whatsapp}
                </p>
              )}

              {settings.email && (
                <p>
                  ✉️ {settings.email}
                </p>
              )}

              {settings.instagram && (
                <p>
                  📸 Instagram
                </p>
              )}

              {settings.facebook && (
                <p>
                  📘 Facebook
                </p>
              )}

              {settings.tiktok && (
                <p>
                  🎵 TikTok
                </p>
              )}

              {settings.website && (
                <p>
                  🌐{" "}
                  {es
                    ? "Página web configurada"
                    : "Website configured"}
                </p>
              )}
            </div>
          </div>
        )}

        {/* NOTA */}

        <p className="text-xs leading-5 text-[#80695d]">
          {es
            ? "Los datos de contacto se mostrarán según las opciones de visibilidad que elijas en Organización de la página."
            : "Contact details will appear according to the visibility options selected in Page organization."}
        </p>
      </div>
    </Section>
  );
}
