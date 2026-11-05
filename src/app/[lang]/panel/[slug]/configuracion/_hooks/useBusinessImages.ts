
"use client";

import { useRef, useState } from "react";

import type {
  Dispatch,
  SetStateAction,
} from "react";

import type { StallSettings } from "@/lib/stall";

import { normalizeGallery } from "@/lib/gallery";

// ==========================================
// ¿TODAVÍA HAY?
// HOOK DE IMÁGENES DEL NEGOCIO
// ==========================================

// Tipos compatibles con BusinessImagesSection.

export type ImageKind =
  | "logo"
  | "cover"
  | "gallery";

type Language = "es" | "en";

type Options = {
  slug: string;
  lang: Language;

  settings: StallSettings;
  saving: boolean;

  setSettings: Dispatch<
    SetStateAction<StallSettings>
  >;

  setError: Dispatch<
    SetStateAction<string>
  >;

  setNotice: Dispatch<
    SetStateAction<string>
  >;

  // El editor principal marcará los cambios
  // como pendientes de guardar.
  markUnsaved: () => void;
};

// ==========================================
// LÍMITES ORIGINALES
// ==========================================

const MAX_IMAGE_BYTES =
  5 * 1024 * 1024;

const MAX_GALLERY_IMAGES = 20;

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

// ==========================================
// HOOK PRINCIPAL
// ==========================================

export default function useBusinessImages({
  slug,
  lang,
  settings,
  saving,
  setSettings,
  setError,
  setNotice,
  markUnsaved,
}: Options) {
  const es = lang === "es";

  const [uploading, setUploading] =
    useState(false);

  const [cameraKind, setCameraKind] =
    useState<ImageKind | null>(null);

  // Evita dos cargas simultáneas que puedan
  // superar el límite de la galería.
  const uploadLock = useRef(false);

  // ========================================
  // MENSAJES DE ERROR
  // ========================================

  function fail(message: string): never {
    setError(message);

    throw new Error(message);
  }

  // ========================================
  // SUBIR IMAGEN A SUPABASE
  // ========================================

  async function uploadImage(
    file: File,
    kind: ImageKind,
  ): Promise<void> {
    if (saving || uploadLock.current) {
      fail(
        es
          ? "Hay otra operación en curso."
          : "Another operation is in progress.",
      );
    }

    setError("");
    setNotice("");

    if (!ACCEPTED_TYPES.includes(file.type)) {
      fail(
        es
          ? "La imagen debe ser JPG, PNG o WEBP."
          : "The image must be JPG, PNG or WEBP.",
      );
    }

    if (
      file.size === 0 ||
      file.size > MAX_IMAGE_BYTES
    ) {
      fail(
        es
          ? "La imagen debe pesar menos de 5 MB."
          : "The image must be under 5 MB.",
      );
    }

    if (
      kind === "gallery" &&
      (settings.galleryUrls?.length ?? 0) >=
        MAX_GALLERY_IMAGES
    ) {
      fail(
        es
          ? "La galería permite máximo 20 imágenes."
          : "The gallery allows up to 20 images.",
      );
    }

    uploadLock.current = true;
    setUploading(true);

    try {
      const form = new FormData();

      form.append("kind", kind);
      form.append("file", file);

      // Conservamos la API original de imágenes.
      const response = await fetch(
        `/api/stalls/${encodeURIComponent(slug)}/branding-image`,
        {
          method: "POST",
          body: form,
        },
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok || !result?.url) {
        const message =
          result?.error ===
          "storage_not_configured"
            ? es
              ? "Supabase Storage no está configurado."
              : "Supabase Storage is not configured."
            : result?.error ===
                "file_too_large"
              ? es
                ? "La fotografía supera los 5 MB."
                : "The photo exceeds 5 MB."
              : result?.error ===
                  "unsupported_image" ||
                result?.error ===
                  "invalid_image"
                ? es
                  ? "El formato de imagen no es compatible."
                  : "Unsupported image format."
                : response.status === 401
                  ? es
                    ? "Necesitas iniciar sesión como dueño."
                    : "You must sign in as an owner."
                  : es
                    ? "No se pudo subir la fotografía."
                    : "Could not upload the photograph.";

        throw new Error(message);
      }

      const url: string = result.url;

      // ====================================
      // ACTUALIZAR CONFIGURACIÓN
      // ====================================

      if (kind === "logo") {
        setSettings((current) => ({
          ...current,
          logoUrl: url,
        }));
      } else if (kind === "cover") {
        setSettings((current) => ({
          ...current,
          coverUrl: url,
        }));
      } else {
        setSettings((current) => {
          const galleryUrls = [
            ...(current.galleryUrls ?? []),
            url,
          ].slice(0, MAX_GALLERY_IMAGES);

          return {
            ...current,
            galleryUrls,

            // Conservamos los títulos y pies
            // de foto de imágenes existentes.
            galleryPhotos: normalizeGallery(
              galleryUrls,
              current.galleryPhotos ?? [],
            ),
          };
        });
      }

      markUnsaved();

      setNotice(
        es
          ? "Imagen subida. Pulsa Guardar configuración para publicarla."
          : "Image uploaded. Select Save settings to publish it.",
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : es
            ? "Error al subir la imagen."
            : "Image upload error.";

      setError(message);

      throw err;
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  }

  // ========================================
  // ABRIR CÁMARA
  // ========================================

  function openCamera(kind: ImageKind) {
    if (
      uploading ||
      saving ||
      cameraKind !== null
    ) {
      return;
    }

    setError("");
    setNotice("");

    if (
      kind === "gallery" &&
      (settings.galleryUrls?.length ?? 0) >=
        MAX_GALLERY_IMAGES
    ) {
      setError(
        es
          ? "La galería ya tiene 20 fotografías."
          : "The gallery already has 20 photos.",
      );

      return;
    }

    setCameraKind(kind);
  }

  // ========================================
  // CERRAR CÁMARA
  // ========================================

  function closeCamera() {
    if (uploading) return;

    setCameraKind(null);
  }

  // ========================================
  // QUITAR IMÁGENES DEL FORMULARIO
  // ========================================

  function removeImage(
    kind: ImageKind,
    index: number,
  ) {
    if (uploading || saving) return;

    setError("");
    setNotice("");

    if (kind === "logo") {
      setSettings((current) => ({
        ...current,
        logoUrl: null,
      }));
    } else if (kind === "cover") {
      setSettings((current) => ({
        ...current,
        coverUrl: null,
      }));
    } else {
      setSettings((current) => {
        const galleryUrls = (
          current.galleryUrls ?? []
        ).filter((_, i) => i !== index);

        return {
          ...current,
          galleryUrls,

          galleryPhotos: normalizeGallery(
            galleryUrls,
            current.galleryPhotos ?? [],
          ),
        };
      });
    }

    markUnsaved();

    // Igual que antes, quitar una foto del
    // formulario no borra su archivo de Storage.
  }

  // ========================================
  // ACCIONES DISPONIBLES
  // ========================================

  return {
    uploading,
    cameraKind,

    uploadImage,
    openCamera,
    closeCamera,
    removeImage,
  };
}
