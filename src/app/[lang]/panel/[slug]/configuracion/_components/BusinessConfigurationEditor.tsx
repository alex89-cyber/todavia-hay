
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import type { FormEvent } from "react";

import RestaurantTables from "@/components/RestaurantTables";
import { CameraCapture } from "@/components/CameraCapture";

import BusinessIdentitySection from "./BusinessIdentitySection";
import BusinessImagesSection from "./BusinessImagesSection";
import BusinessAppearanceSection from "./BusinessAppearanceSection";
import BusinessLocationSection from "./BusinessLocationSection";
import BusinessContactSection from "./BusinessContactSection";
import BusinessHoursSection from "./BusinessHoursSection";
import BusinessPickupSection from "./BusinessPickupSection";
import BusinessSectionsEditor from "./BusinessSectionsEditor";
import BusinessPreview from "./BusinessPreview";
import ConfigurationSaveBar from "./ConfigurationSaveBar";

import useBusinessConfiguration from "../_hooks/useBusinessConfiguration";
import useBusinessImages from "../_hooks/useBusinessImages";

// ==========================================
// ¿TODAVÍA HAY?
// CONFIGURACIÓN DEL NEGOCIO
//
// Los formularios están separados en
// componentes y utilizan un estado común.
//
// La administración de mesas se encuentra
// aquí, pero utiliza su propio formulario.
// ==========================================

export default function BusinessConfigurationEditor() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center bg-[#fffaf4] px-5 py-10">
          <p className="font-semibold text-[#4b3024]">
            Cargando configuración...
          </p>
        </main>
      }
    >
      <BusinessConfigurationContent />
    </Suspense>
  );
}

// ==========================================
// CONTENIDO DE CONFIGURACIÓN
// ==========================================

function BusinessConfigurationContent() {
  const params = useParams<{
    lang: string;
    slug: string;
  }>();

  const lang: "es" | "en" =
    params.lang === "en" ? "en" : "es";

  const slug = params.slug;
  const es = lang === "es";

  const panelHref =
    `/${lang}/panel/${slug}`;

  const publicHref =
    `/${lang}/${slug}`;

  const rewardsHref =
    `/${lang}/panel/${slug}/configuracion/recompensas`;

  // ========================================
  // DATOS Y GUARDADO
  // ========================================

  const config = useBusinessConfiguration({
    slug,
    lang,
  });

  const {
    name,
    settings,
    dishes,
    isOpen,
    loading,
    saving,
    error,
    notice,
    hasChanges,
    updateName,
    updateSettings,
    updateTheme,
    setSettings,
    setError,
    setNotice,
  } = config;

  // ========================================
  // FOTOGRAFÍAS Y CÁMARA
  // ========================================

  const images = useBusinessImages({
    slug,
    lang,
    settings,
    saving,
    setSettings,
    setError,
    setNotice,

    markUnsaved: () => {
      // Marca las imágenes nuevas como cambios
      // pendientes de guardar.
      updateSettings({});
    },
  });

  const {
    uploading,
    cameraKind,
    uploadImage,
    removeImage,
    openCamera,
    closeCamera,
  } = images;

  // ========================================
  // GUARDAR CONFIGURACIÓN
  // ========================================

  async function handleSave(
    event: FormEvent<HTMLFormElement>,
  ) {
    await config.save(event, {
      uploading,
      cameraOpen: cameraKind !== null,
    });
  }

  // ========================================
  // CARGANDO
  // ========================================

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-[#fffaf4] p-8">
        <p className="font-semibold text-[#4b3024]">
          {es
            ? "Cargando configuración..."
            : "Loading settings..."}
        </p>
      </main>
    );
  }

  // ========================================
  // ERROR INICIAL
  // ========================================

  if (error && !name) {
    return (
      <main className="min-h-screen bg-[#fffaf4] p-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#eaded3] bg-white p-6">
          <h1 className="text-2xl font-black text-[#302018]">
            {es
              ? "No se pudo abrir Configuración"
              : "Could not open Settings"}
          </h1>

          <p className="mt-3 text-sm text-red-700">
            {error}
          </p>

          <Link
            href={panelHref}
            className="mt-5 inline-block font-semibold text-[#a3341f] underline"
          >
            {es
              ? "Volver al panel"
              : "Back to dashboard"}
          </Link>
        </div>
      </main>
    );
  }

  // ========================================
  // PÁGINA PRINCIPAL
  // ========================================

  return (
    <main className="min-h-screen bg-[#fffaf4] pb-20">

      {/* ENCABEZADO */}

      <header className="border-b border-[#eaded3] bg-white px-4 py-7 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href={panelHref}
              className="text-sm font-semibold text-[#a3341f] hover:underline"
            >
              ←{" "}
              {es
                ? "Volver al panel"
                : "Back to dashboard"}
            </Link>

            <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#a3341f]">
              {es
                ? "ADMINISTRACIÓN DEL NEGOCIO"
                : "BUSINESS MANAGEMENT"}
            </p>

            <h1 className="mt-2 text-3xl font-black text-[#302018] sm:text-4xl">
              {es
                ? "Configuración de mi negocio"
                : "Business settings"}
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-[#80695d]">
              {es
                ? "Personaliza la información, las fotografías y el diseño de tu página pública."
                : "Customize your public page information, photos and design."}
            </p>
          </div>

          <Link
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-[#eaded3] bg-white px-5 py-3 text-sm font-bold text-[#4b3024] shadow-sm transition hover:bg-[#fffaf4]"
          >
            {es
              ? "Ver página pública ↗"
              : "View public page ↗"}
          </Link>
        </div>
      </header>

      {/* FORMULARIO COMPLETO DEL NEGOCIO */}

      <form
        onSubmit={handleSave}
        className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-8 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]"
      >
        <div className="flex min-w-0 flex-col gap-6">

          {/* RECOMPENSAS */}

          <section className="rounded-[1.5rem] border border-[#eaded3] bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-black text-[#302018]">
              {es
                ? "🎁 Programa de recompensas"
                : "🎁 Rewards program"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#80695d]">
              {es
                ? "Personaliza los sellos, los premios y las fechas de vencimiento. También puedes desactivar el programa."
                : "Customize stamps, prizes and expiration dates. You can also disable the program."}
            </p>

            <Link
              href={rewardsHref}
              className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-[#eaded3] bg-[#fffaf4] px-5 py-4 transition hover:border-[#a3341f] hover:bg-[#fff1e7]"
            >
              <div>
                <p className="font-bold text-[#302018]">
                  {es
                    ? "Personalizar recompensas"
                    : "Customize rewards"}
                </p>

                <p className="mt-1 text-sm text-[#80695d]">
                  {es
                    ? "Configura el programa de fidelidad de tu negocio."
                    : "Configure your business loyalty program."}
                </p>
              </div>

              <span
                aria-hidden="true"
                className="text-xl font-bold text-[#a3341f]"
              >
                →
              </span>
            </Link>
          </section>

          {/* IDENTIDAD */}

          <BusinessIdentitySection
            lang={lang}
            name={name}
            settings={settings}
            onNameChange={updateName}
            onSettingsChange={(key, value) => {
              updateSettings({
                [key]: value,
              });
            }}
          />

          {/* IMÁGENES */}

          <BusinessImagesSection
            lang={lang}
            settings={settings}
            uploading={uploading}
            saving={saving}
            onUpload={uploadImage}
            onRemove={removeImage}
            onOpenCamera={openCamera}
            onSettingsChange={(nextSettings) => {
              updateSettings(nextSettings);
            }}
          />

          {/* APARIENCIA */}

          <BusinessAppearanceSection
            lang={lang}
            name={name}
            theme={settings.theme ?? {}}
            onThemeChange={updateTheme}
          />

          {/* UBICACIÓN */}

          <BusinessLocationSection
            lang={lang}
            settings={settings}
            onSettingsChange={updateSettings}
          />

          {/* CONTACTO */}

          <BusinessContactSection
            lang={lang}
            settings={settings}
            onSettingsChange={updateSettings}
          />

          {/* HORARIOS */}

          <BusinessHoursSection
            lang={lang}
            settings={settings}
            disabled={saving || uploading}
            onSettingsChange={updateSettings}
          />

          {/* RECOGER */}

          <BusinessPickupSection
            lang={lang}
            settings={settings}
            disabled={saving || uploading}
            onSettingsChange={updateSettings}
          />

          {/* ORDEN Y VISIBILIDAD */}

          <BusinessSectionsEditor
            lang={lang}
            settings={settings}
            disabled={saving || uploading}
            onSettingsChange={updateSettings}
          />

          {/* GUARDAR CONFIGURACIÓN GENERAL */}

          <ConfigurationSaveBar
            lang={lang}
            saving={saving}
            uploading={uploading}
            error={error}
            notice={notice}
            hasChanges={hasChanges}
            disabled={cameraKind !== null}
          />
        </div>

        {/* VISTA PREVIA COMPLETA */}

        <aside className="min-w-0">
          <div className="space-y-4 xl:sticky xl:top-5">
            <BusinessPreview
              lang={lang}
              name={name}
              slug={slug}
              settings={settings}
              dishes={dishes}
              isOpen={isOpen}
            />

            <Link
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-xl border border-[#eaded3] bg-white px-4 py-3 text-sm font-bold text-[#a3341f] transition hover:bg-[#fff4e9]"
            >
              {es
                ? "Ver página pública ↗"
                : "View public page ↗"}
            </Link>
          </div>
        </aside>
      </form>

      {/* ======================================
          ADMINISTRACIÓN DE MESAS

          Se coloca FUERA del formulario
          de configuración general porque
          tiene su propio formulario.

          Permite agregar, editar, activar
          o desactivar mesas.
      ====================================== */}

      <div className="mx-auto w-full max-w-7xl">
        <RestaurantTables
          slug={slug}
          lang={lang}
        />
      </div>

      {/* CÁMARA */}

      {cameraKind !== null && (
        <CameraCapture
          lang={lang}
          onCapture={(file) =>
            uploadImage(file, cameraKind)
          }
          onClose={closeCamera}
        />
      )}
    </main>
  );
}
