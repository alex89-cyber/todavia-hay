
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type { FormEvent } from "react";

import type {
  OwnerView,
  StallOpeningHour,
  StallSettings,
  StallTheme,
} from "@/lib/stall";

import { normalizeGallery } from "@/lib/gallery";

import {
  DEFAULT_PAGE_SECTIONS,
  normalizePageSections,
} from "@/components/SectionOrderEditor";

// ==========================================
// ¿TODAVÍA HAY?
// HOOK DE CONFIGURACIÓN DEL NEGOCIO
// ==========================================

type Language = "es" | "en";

type Options = {
  slug: string;
  lang: Language;
};

type SaveOptions = {
  uploading?: boolean;
  cameraOpen?: boolean;
};

// ==========================================
// CONFIGURACIÓN PREDETERMINADA
// ==========================================

export const DEFAULT_THEME: StallTheme = {
  primaryColor: "#a3341f",
  secondaryColor: "#e39b2d",
  backgroundColor: "#ffffff",
  textColor: "#2e1b14",
  buttonColor: "#a3341f",

  typography: "modern",
  layout: "classic",

  roundedCards: true,
  roundedButtons: true,

  coverPosition: "right",
  headerBackgroundColor: "#ffffff",
  headerTextColor: "#2e1b14",
};

export const DEFAULT_HOURS: StallOpeningHour[] =
  Array.from({ length: 7 }, (_, day) => ({
    day,
    enabled: day !== 0,
    open: "09:00",
    close: "18:00",
  }));

export function defaultBusinessSettings(): StallSettings {
  return {
    logoUrl: null,
    coverUrl: null,

    galleryUrls: [],
    galleryPhotos: [],

    sectionOrder: DEFAULT_PAGE_SECTIONS.map(
      (section) => ({ ...section }),
    ),

    descriptionEs: "",
    descriptionEn: "",

    taglineEs: "",
    taglineEn: "",

    welcomeMessageEs: "",
    welcomeMessageEn: "",

    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "México",

    googleMapsUrl: "",
    latitude: null,
    longitude: null,

    phone: "",
    whatsapp: "",
    email: "",

    instagram: "",
    facebook: "",
    tiktok: "",
    website: "",

    openingHours: DEFAULT_HOURS.map(
      (hour) => ({ ...hour }),
    ),

    theme: { ...DEFAULT_THEME },

    showCover: true,
    showDescription: true,
    showLocation: true,
    showOpeningHours: true,
    showSocialLinks: true,
    showGallery: true,
  };
}

// ==========================================
// COMBINAR DATOS EXISTENTES
// ==========================================

export function mergeBusinessSettings(
  saved?: StallSettings,
): StallSettings {
  const defaults = defaultBusinessSettings();

  const galleryUrls =
    saved?.galleryUrls ??
    saved?.galleryPhotos?.map(
      (photo) => photo.url,
    ) ??
    [];

  return {
    ...defaults,
    ...saved,

    theme: {
      ...defaults.theme,
      ...saved?.theme,
    },

    openingHours:
      saved?.openingHours?.length
        ? saved.openingHours
        : defaults.openingHours,

    galleryUrls,

    galleryPhotos: normalizeGallery(
      galleryUrls,
      saved?.galleryPhotos ?? [],
    ),

    sectionOrder: normalizePageSections(
      saved?.sectionOrder ??
        DEFAULT_PAGE_SECTIONS.map(
          (section) => ({
            ...section,

            visible:
              section.id === "location"
                ? saved?.showLocation !== false
                : section.id === "hours"
                  ? saved?.showOpeningHours !== false
                  : section.id === "social"
                    ? saved?.showSocialLinks !== false
                    : section.id === "gallery"
                      ? saved?.showGallery !== false
                      : true,
          }),
        ),
    ),
  };
}

// ==========================================
// VALIDAR ENLACES
// ==========================================

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true;

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}

// ==========================================
// HOOK PRINCIPAL
// ==========================================

export default function useBusinessConfiguration({
  slug,
  lang,
}: Options) {
  const es = lang === "es";

  // ESTADOS

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [name, setName] =
    useState("");

  const [settings, setSettings] =
    useState<StallSettings>(
      defaultBusinessSettings,
    );

  const [dishes, setDishes] =
    useState<OwnerView["dishes"]>([]);

  const [isOpen, setIsOpen] =
    useState(false);

  const [hasChanges, setHasChanges] =
    useState(false);

  // ========================================
  // CARGAR DATOS DEL NEGOCIO
  // ========================================

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/stalls/${encodeURIComponent(slug)}?view=owner`,
          {
            cache: "no-store",
            signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? es
                ? "Necesitas iniciar sesión como dueño."
                : "You must sign in as an owner."
              : es
                ? "No se pudo cargar la configuración."
                : "Could not load settings.",
          );
        }

        const data =
          (await response.json()) as OwnerView;

        if (signal?.aborted) return;

        setName(data.name);
        setSettings(
          mergeBusinessSettings(
            data.settings,
          ),
        );

        setDishes(data.dishes ?? []);
        setIsOpen(data.isOpen);

        setHasChanges(false);
        setError("");
      } catch (err) {
        if (signal?.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : es
              ? "Error de conexión."
              : "Connection error.",
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [slug, es],
  );


    useEffect(() => {
    const controller = new AbortController();

    // Iniciamos la carga de manera asíncrona
    // para evitar una actualización síncrona
    // del estado dentro del efecto.
    const timeout = setTimeout(() => {
        void loadData(controller.signal);
    }, 0);

    return () => {
        clearTimeout(timeout);
        controller.abort();
    };
    }, [loadData]);


  // ========================================
  // ACTUALIZAR NOMBRE
  // ========================================

  function updateName(value: string) {
    setName(value);
    setNotice("");
    setHasChanges(true);
  }

  // ========================================
  // ACTUALIZAR UN CAMPO
  // ========================================

  function update<
    K extends keyof StallSettings,
  >(
    key: K,
    value: StallSettings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));

    setNotice("");
    setHasChanges(true);
  }

  // ========================================
  // ACTUALIZAR VARIOS CAMPOS
  // ========================================

  function updateSettings(
    patch: Partial<StallSettings>,
  ) {
    setSettings((current) => ({
      ...current,
      ...patch,
    }));

    setNotice("");
    setHasChanges(true);
  }

  // ========================================
  // ACTUALIZAR TEMA
  // ========================================

  function updateTheme(
    patch: Partial<StallTheme>,
  ) {
    setSettings((current) => ({
      ...current,

      theme: {
        ...DEFAULT_THEME,
        ...current.theme,
        ...patch,
      },
    }));

    setNotice("");
    setHasChanges(true);
  }

  // ========================================
  // ACTUALIZAR HORARIO
  // ========================================

  function updateHour(
    day: number,
    patch: Partial<StallOpeningHour>,
  ) {
    setSettings((current) => {
      const currentHours =
        current.openingHours ??
        DEFAULT_HOURS;

      return {
        ...current,

        openingHours: currentHours.map(
          (hour) =>
            hour.day === day
              ? { ...hour, ...patch }
              : hour,
        ),
      };
    });

    setNotice("");
    setHasChanges(true);
  }

  // ========================================
  // GUARDAR CONFIGURACIÓN
  // ========================================

  async function save(
    event?: FormEvent<HTMLFormElement>,
    options: SaveOptions = {},
  ): Promise<boolean> {
    event?.preventDefault();

    if (
      loading ||
      saving ||
      options.uploading ||
      options.cameraOpen
    ) {
      return false;
    }

    setError("");
    setNotice("");

    if (!name.trim()) {
      setError(
        es
          ? "Escribe el nombre del negocio."
          : "Enter the business name.",
      );

      return false;
    }

    const normalizedSettings =
      mergeBusinessSettings(settings);

    const urls = [
      normalizedSettings.logoUrl ?? "",
      normalizedSettings.coverUrl ?? "",
      normalizedSettings.googleMapsUrl ?? "",
      normalizedSettings.instagram ?? "",
      normalizedSettings.facebook ?? "",
      normalizedSettings.tiktok ?? "",
      normalizedSettings.website ?? "",
      ...(normalizedSettings.galleryUrls ?? []),
    ];

    if (
      urls.some(
        (url) => !isValidUrl(url),
      )
    ) {
      setError(
        es
          ? "Revisa los enlaces de contacto y las imágenes."
          : "Check contact links and images.",
      );

      return false;
    }

    if (
      (
        normalizedSettings.galleryUrls ??
        []
      ).length > 20
    ) {
      setError(
        es
          ? "La galería permite máximo 20 imágenes."
          : "The gallery allows up to 20 images.",
      );

      return false;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/stalls/${encodeURIComponent(slug)}`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            action: "saveSettings",
            name: name.trim(),
            settings: normalizedSettings,
          }),
        },
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ===
          "settings_not_supported"
            ? es
              ? "El almacenamiento no permite guardar la configuración."
              : "Settings storage is not supported."
            : result?.error ===
                "bad_request"
              ? es
                ? "Algún campo tiene un formato incorrecto."
                : "Some settings have an invalid format."
              : response.status === 401
                ? es
                  ? "Necesitas iniciar sesión."
                  : "You must sign in."
                : es
                  ? "No se pudo guardar la configuración."
                  : "Could not save settings.",
        );
      }

      const updated =
        result as OwnerView;

      setName(updated.name);

      setSettings(
        mergeBusinessSettings(
          updated.settings,
        ),
      );

      setHasChanges(false);

      setNotice(
        es
          ? "¡Configuración guardada correctamente!"
          : "Settings saved successfully!",
      );

      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : es
            ? "Error al guardar."
            : "Error saving settings.",
      );

      return false;
    } finally {
      setSaving(false);
    }
  }

  // ========================================
  // VALORES Y ACCIONES DEL EDITOR
  // ========================================

  return {
    lang,
    slug,

    // Datos
    name,
    settings,
    dishes,
    isOpen,

    // Estados
    loading,
    saving,
    error,
    notice,
    hasChanges,

    // Actualizar valores
    setName,
    setSettings,
    setError,
    setNotice,

    updateName,
    update,
    updateSettings,
    updateTheme,
    updateHour,

    // Cargar y guardar
    loadData,
    save,
  };
}
