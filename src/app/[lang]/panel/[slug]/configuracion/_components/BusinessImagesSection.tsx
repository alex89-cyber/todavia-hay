
"use client";

import { useRef } from "react";
import type { ChangeEvent } from "react";

import type { StallSettings } from "@/lib/stall";

import {
  normalizeGallery,
} from "@/lib/gallery";

import GalleryCaptionEditor from "@/components/GalleryCaptionEditor";

import { Section } from "./ConfigurationFields";

// ==========================================
// TIPOS
// ==========================================

export type ImageKind =
  | "logo"
  | "cover"
  | "gallery";

type Props = {
  lang: "es" | "en";
  settings: StallSettings;

  uploading: boolean;
  saving: boolean;

  onUpload: (
    file: File,
    kind: ImageKind,
  ) => Promise<void>;

  onRemove: (
    kind: ImageKind,
    index: number,
  ) => void;

  onOpenCamera: (
    kind: ImageKind,
  ) => void;

  onSettingsChange: (
    settings: StallSettings,
  ) => void;
};

// ==========================================
// COMPONENTE PARA SUBIR IMÁGENES
// ==========================================

type ImageUploaderProps = {
  title: string;
  description: string;
  kind: ImageKind;
  lang: "es" | "en";
  disabled: boolean;
  imageUrls: string[];

  onUpload: (
    file: File,
    kind: ImageKind,
  ) => Promise<void>;

  onRemove: (index: number) => void;

  onOpenCamera: (
    kind: ImageKind,
  ) => void;
};

function ImageUploader({
  title,
  description,
  kind,
  lang,
  disabled,
  imageUrls,
  onUpload,
  onRemove,
  onOpenCamera,
}: ImageUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const es = lang === "es";

  async function selected(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(
      event.target.files ?? [],
    );

    event.target.value = "";

    if (!files.length) return;

    const chosen =
      kind === "gallery"
        ? files
        : files.slice(0, 1);

    for (const file of chosen) {
      try {
        await onUpload(file, kind);
      } catch {
        break;
      }
    }
  }

  return (
    <div className="rounded-2xl border border-[#eaded3] bg-[#fffaf4] p-4 sm:p-5">
      <h3 className="text-base font-bold text-[#302018]">
        {title}
      </h3>

      <p className="mt-1 text-sm text-[#80695d]">
        {description}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            fileRef.current?.click()
          }
          className="flex items-center justify-center gap-2 rounded-xl border border-[#decbbb] bg-white px-4 py-3 text-sm font-bold text-[#4b3024] transition hover:border-[#a3341f] disabled:opacity-50"
        >
          <span aria-hidden="true">
            📁
          </span>

          {es
            ? "Subir imagen"
            : "Upload image"}
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onOpenCamera(kind)
          }
          className="flex items-center justify-center gap-2 rounded-xl border border-[#decbbb] bg-white px-4 py-3 text-sm font-bold text-[#4b3024] transition hover:border-[#a3341f] disabled:opacity-50"
        >
          <span aria-hidden="true">
            📷
          </span>

          {es
            ? "Tomar foto"
            : "Take photo"}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={kind === "gallery"}
        onChange={(event) =>
          void selected(event)
        }
        className="hidden"
        aria-label={
          es
            ? "Seleccionar imagen"
            : "Select image"
        }
      />

      {imageUrls.length > 0 && (
        <div
          className={`mt-5 grid gap-3 ${
            kind === "gallery"
              ? "grid-cols-2 sm:grid-cols-3"
              : "grid-cols-1"
          }`}
        >
          {imageUrls.map(
            (url, index) => (
              <div
                key={`${url}-${index}`}
                className="overflow-hidden rounded-xl border border-[#eaded3] bg-white"
              >
                <div
                  className={
                    kind === "cover"
                      ? "h-40"
                      : "aspect-square max-h-48"
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`${title} ${index + 1}`}
                    className={
                      kind === "logo"
                        ? "h-full w-full object-contain p-2"
                        : "h-full w-full object-cover"
                    }
                  />
                </div>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onRemove(index)
                  }
                  className="w-full border-t border-[#eaded3] px-3 py-2 text-sm font-semibold text-[#a3341f] hover:bg-red-50 disabled:opacity-50"
                >
                  {es
                    ? "Quitar imagen"
                    : "Remove image"}
                </button>
              </div>
            ),
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-[#80695d]">
        {es
          ? "Formatos: JPG, PNG o WEBP. Máximo 5 MB por fotografía."
          : "Formats: JPG, PNG or WEBP. Maximum 5 MB per photo."}
      </p>
    </div>
  );
}

// ==========================================
// SECCIÓN PRINCIPAL DE IMÁGENES
// ==========================================

export default function BusinessImagesSection({
  lang,
  settings,
  uploading,
  saving,
  onUpload,
  onRemove,
  onOpenCamera,
  onSettingsChange,
}: Props) {
  const es = lang === "es";
  const disabled = uploading || saving;

  return (
    <Section
      title={
        es
          ? "Logo y fotografías"
          : "Logo and photos"
      }
      description={
        es
          ? "Sube imágenes desde tu computadora o teléfono, o utiliza la cámara."
          : "Upload images from your computer or phone, or use your camera."
      }
    >
      <div className="space-y-5">

        {/* LOGO */}

        <ImageUploader
          title={
            es
              ? "Logo del negocio"
              : "Business logo"
          }
          description={
            es
              ? "Sube una imagen cuadrada de tu logo."
              : "Upload a square image of your logo."
          }
          kind="logo"
          lang={lang}
          disabled={disabled}
          imageUrls={
            settings.logoUrl
              ? [settings.logoUrl]
              : []
          }
          onUpload={onUpload}
          onRemove={(index) =>
            onRemove("logo", index)
          }
          onOpenCamera={onOpenCamera}
        />

        {/* PORTADA */}

        <ImageUploader
          title={
            es
              ? "Fotografía de portada"
              : "Cover photo"
          }
          description={
            es
              ? "Elige la fotografía principal que verán tus clientes."
              : "Choose the main photo customers will see."
          }
          kind="cover"
          lang={lang}
          disabled={disabled}
          imageUrls={
            settings.coverUrl
              ? [settings.coverUrl]
              : []
          }
          onUpload={onUpload}
          onRemove={(index) =>
            onRemove("cover", index)
          }
          onOpenCamera={onOpenCamera}
        />

        {/* GALERÍA */}

        <ImageUploader
          title={
            es
              ? "Galería de fotografías"
              : "Photo gallery"
          }
          description={
            es
              ? "Agrega hasta 20 fotografías de tus platillos, negocio o instalaciones."
              : "Add up to 20 photos of your food, business or premises."
          }
          kind="gallery"
          lang={lang}
          disabled={disabled}
          imageUrls={
            settings.galleryUrls ?? []
          }
          onUpload={onUpload}
          onRemove={(index) =>
            onRemove("gallery", index)
          }
          onOpenCamera={onOpenCamera}
        />

        {/* TÍTULOS Y PIES DE FOTO */}

        <GalleryCaptionEditor
          lang={lang}
          disabled={disabled}
          photos={normalizeGallery(
            settings.galleryUrls ?? [],
            settings.galleryPhotos ?? [],
          )}
          onChange={(photos) => {
            onSettingsChange({
              ...settings,
              galleryPhotos: photos,
              galleryUrls: photos.map(
                (photo) => photo.url,
              ),
            });
          }}
        />

        {/* ESTADO DE SUBIDA */}

        {uploading && (
          <div
            role="status"
            className="rounded-xl bg-[#fff3df] px-4 py-3 text-sm font-semibold text-[#8a4a20]"
          >
            {es
              ? "Subiendo fotografía..."
              : "Uploading photo..."}
          </div>
        )}

        {/* INFORMACIÓN */}

        <p className="text-xs leading-relaxed text-[#80695d]">
          {es
            ? "Las imágenes se envían a Supabase al seleccionarlas o confirmar una foto. Para publicarlas, pulsa Guardar configuración. Quitar una foto aquí no elimina el archivo de Storage."
            : "Images upload to Supabase when selected or captured. Select Save settings to publish them. Removing an image here does not delete the Storage file."}
        </p>
      </div>
    </Section>
  );
}
