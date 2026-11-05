
"use client";

import type { StallSettings } from "@/lib/stall";
import { Section, Field } from "./ConfigurationFields";

type Props = {
  lang: "es" | "en";
  name: string;
  settings: StallSettings;
  onNameChange: (value: string) => void;
  onSettingsChange: (
    key: keyof StallSettings,
    value: string,
  ) => void;
};

export default function BusinessIdentitySection({
  lang,
  name,
  settings,
  onNameChange,
  onSettingsChange,
}: Props) {
  const es = lang === "es";

  return (
    <Section
      title={
        es
          ? "Identidad del negocio"
          : "Business identity"
      }
      description={
        es
          ? "Edita el nombre y los textos que verá el cliente."
          : "Edit the name and text shown to customers."
      }
    >
      <div className="grid gap-5">
        <Field
          label={
            es
              ? "Nombre del negocio"
              : "Business name"
          }
          value={name}
          maxLength={120}
          onChange={onNameChange}
        />

        <Field
          label="Eslogan en español"
          value={settings.taglineEs ?? ""}
          maxLength={180}
          onChange={(value) =>
            onSettingsChange("taglineEs", value)
          }
          placeholder="Tradición y sabor casero"
        />

        <Field
          label="Tagline in English"
          value={settings.taglineEn ?? ""}
          maxLength={180}
          onChange={(value) =>
            onSettingsChange("taglineEn", value)
          }
        />

        <Field
          label="Descripción en español"
          value={settings.descriptionEs ?? ""}
          maxLength={2000}
          multiline
          onChange={(value) =>
            onSettingsChange("descriptionEs", value)
          }
        />

        <Field
          label="Description in English"
          value={settings.descriptionEn ?? ""}
          maxLength={2000}
          multiline
          onChange={(value) =>
            onSettingsChange("descriptionEn", value)
          }
        />

        <Field
          label="Mensaje de bienvenida en español"
          value={settings.welcomeMessageEs ?? ""}
          maxLength={500}
          multiline
          onChange={(value) =>
            onSettingsChange("welcomeMessageEs", value)
          }
        />

        <Field
          label="Welcome message in English"
          value={settings.welcomeMessageEn ?? ""}
          maxLength={500}
          multiline
          onChange={(value) =>
            onSettingsChange("welcomeMessageEn", value)
          }
        />
      </div>
    </Section>
  );
}
