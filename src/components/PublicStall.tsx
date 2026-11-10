
"use client";

import type { HeldOrder } from "@/lib/holds";
import { HeldOrders } from "./HeldOrders";
import PublicRewardsSection from "./PublicRewardsSection";
import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  CSSProperties,
  FormEvent,
  ReactNode,
} from "react";

import type { Dictionary } from "@/dictionaries";

import {
  clock,
  fill,
  money,
} from "@/lib/format";

import type { PublicSnapshot } from "@/lib/stall";
import { groupBySection, groupName } from "@/lib/menu-sections";

import { AgentChat } from "./AgentChat";
import { InstallAppButton } from "./InstallAppButton";

import {
  NotifyButton,
  forgetWatch,
} from "./NotifyButton";

// ==========================================
// TIPOS EXISTENTES
// ==========================================

export type { HeldOrder };

export type Confirmation =
  | ({
      kind: "reserved";
      name: string;
    } & HeldOrder)
  | { kind: "cancelled" }
  | { kind: "error" };

export type StampCardInfo = {
  have: number | null;
  perReward: number;
  reward: string;
};

type SectionId =
  | "menu"
  | "chat"
  | "rewards"
  | "hours"
  | "location"
  | "social"
  | "gallery";

type PageSection = {
  id: SectionId;
  visible: boolean;
};

type GalleryPhoto = {
  id: string;
  url: string;
  titleEs: string;
  titleEn: string;
  captionEs: string;
  captionEn: string;
};

const POLL_MS = 5_000;
const FEW = 5;

const DEFAULT_ORDER: SectionId[] = [
  "menu",
  "chat",
  "rewards",
  "hours",
  "location",
  "social",
  "gallery",
];

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function safeColor(
  value: string | undefined,
): string | undefined {
  return value &&
    /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : undefined;
}

function safeUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  // Las imágenes de demostración también
  // pueden utilizar rutas locales.
  if (
    value.startsWith("/") &&
    !value.startsWith("//")
  ) {
    return value;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" ||
      url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function getDemoDishImage(
  nameEs: string,
  nameEn: string,
): string | null {
  const es = normalize(nameEs);
  const en = normalize(nameEn);

  if (
    es.includes("quesabirria") ||
    en.includes("quesabirria")
  ) {
    return "/menu/quesabirria.jpg";
  }

  if (
    es.includes("plato de birria") ||
    en.includes("birria plate")
  ) {
    return "/menu/plato-birria.jpg";
  }

  if (
    es.includes("consome") ||
    en.includes("consome")
  ) {
    return "/menu/consome.jpg";
  }

  if (
    es.includes("taco") ||
    en.includes("taco")
  ) {
    return "/menu/tacos.jpg";
  }

  return null;
}

function organizeSections(
  saved: PageSection[] | undefined,
  flags: {
    showLocation: boolean;
    showHours: boolean;
    showSocial: boolean;
    showGallery: boolean;
  },
): PageSection[] {
  const source = Array.isArray(saved)
    ? saved
    : [];

  const seen = new Set<SectionId>();

  const ordered: PageSection[] = [];

  for (const section of source) {
    if (
      !DEFAULT_ORDER.includes(section.id) ||
      seen.has(section.id)
    ) {
      continue;
    }

    seen.add(section.id);

    ordered.push({
      id: section.id,
      visible: section.visible !== false,
    });
  }

  for (const id of DEFAULT_ORDER) {
    if (seen.has(id)) continue;

    ordered.push({
      id,
      visible: true,
    });
  }

  return ordered.filter((section) => {
    if (!section.visible) return false;

    switch (section.id) {
      case "location":
        return flags.showLocation;
      case "hours":
        return flags.showHours;
      case "social":
        return flags.showSocial;
      case "gallery":
        return flags.showGallery;
      default:
        return true;
    }
  });
}

// ==========================================
// IMAGEN DEL PLATILLO
// ==========================================

function DishImage({
  imageUrl,
  fallback,
  alt,
  out,
}: {
  imageUrl: string | null;
  fallback: string | null;
  alt: string;
  out: boolean;
}) {
  const [failed, setFailed] =
    useState(false);

  const custom =
    imageUrl && !failed
      ? safeUrl(imageUrl)
      : null;

  if (custom) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={custom}
        src={custom}
        alt={alt}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
          out ? "grayscale" : ""
        }`}
      />
    );
  }

  if (fallback) {
    return (
      <Image
        src={fallback}
        alt={alt}
        fill
        sizes="(min-width:1024px) 22vw, (min-width:640px) 42vw, 100vw"
        className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
          out ? "grayscale" : ""
        }`}
      />
    );
  }

  return (
    <div className="flex h-full min-h-[200px] items-center justify-center bg-brand/10 text-5xl">
      🍽️
    </div>
  );
}

// ==========================================
// IMAGEN PERSONALIZADA
// ==========================================

function CustomImage({
  src,
  fallback,
  alt,
  className,
}: {
  src: string | null | undefined;
  fallback: string | null;
  alt: string;
  className: string;
}) {
  const [failed, setFailed] =
    useState(false);

  const custom =
    src && !failed ? safeUrl(src) : null;

  if (custom) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={custom}
        src={custom}
        alt={alt}
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  if (fallback) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fallback}
        alt={alt}
        className={className}
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#fff4e4] text-5xl">
      🍽️
    </div>
  );
}

// ==========================================
// GALERÍA CON VISOR AMPLIADO
// ==========================================

function PublicGallery({
  lang,
  photos,
}: {
  lang: "es" | "en";
  photos: GalleryPhoto[];
}) {
  const es = lang === "es";

  const [selected, setSelected] =
    useState<number | null>(null);

  const closeButton =
    useRef<HTMLButtonElement>(null);

  const previousFocus =
    useRef<HTMLElement | null>(null);

  const current =
    selected === null
      ? null
      : photos[selected] ?? null;

  const open = (index: number) => {
    previousFocus.current =
      document.activeElement as HTMLElement;

    setSelected(index);
  };

  const close = () => {
    setSelected(null);
  };

  const next = () => {
    setSelected((index) =>
      index === null
        ? null
        : (index + 1) % photos.length,
    );
  };

  const previous = () => {
    setSelected((index) =>
      index === null
        ? null
        : (index - 1 + photos.length) %
          photos.length,
    );
  };

  useEffect(() => {
    if (selected === null) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    closeButton.current?.focus();

    function onKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setSelected(null);
      }

      if (event.key === "ArrowRight") {
        setSelected((index) =>
          index === null
            ? null
            : (index + 1) % photos.length,
        );
      }

      if (event.key === "ArrowLeft") {
        setSelected((index) =>
          index === null
            ? null
            : (
                index -
                1 +
                photos.length
              ) % photos.length,
        );
      }
    }

    document.addEventListener(
      "keydown",
      onKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        "keydown",
        onKeyDown,
      );

      previousFocus.current?.focus();
    };
  }, [selected, photos.length]);

  if (!photos.length) return null;

  function title(photo: GalleryPhoto) {
    return (
      (es
        ? photo.titleEs
        : photo.titleEn || photo.titleEs) ||
      ""
    ).trim();
  }

  function caption(photo: GalleryPhoto) {
    return (
      (es
        ? photo.captionEs
        : photo.captionEn || photo.captionEs) ||
      ""
    ).trim();
  }

  return (
    <section
      className="min-w-0 space-y-6"
      aria-label={
        es
          ? "Galería de fotografías"
          : "Photo gallery"
      }
    >
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand">
          {es
            ? "Conoce nuestro negocio"
            : "Discover our business"}
        </p>

        <h2 className="text-3xl font-black tracking-tight text-[#2e1b14] sm:text-4xl">
          {es
            ? "Nuestra galería"
            : "Our gallery"}
        </h2>

        <p className="mt-3 text-sm text-muted">
          {es
            ? "Selecciona una fotografía para verla más grande y conocer sus detalles."
            : "Select a photo to enlarge it and read its details."}
        </p>
      </div>

      {/* CUADRÍCULA SIN PIES DE FOTO */}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {photos.map((photo, index) => (
          <button
            key={`${photo.id}-${index}`}
            type="button"
            onClick={() => open(index)}
            aria-label={
              title(photo) ||
              `${es ? "Ver fotografía" : "View photo"} ${index + 1}`
            }
            className="group relative aspect-square overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={
                title(photo) ||
                `${es ? "Fotografía" : "Photo"} ${index + 1}`
              }
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />

            <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-2 text-sm text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              <span aria-hidden="true">
                ⛶
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* VISOR DE FOTOGRAFÍA */}

      {current && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              close();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              title(current) ||
              (es
                ? "Fotografía ampliada"
                : "Enlarged photograph")
            }
            className="relative flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            {/* CONTROLES */}

            <div className="flex items-center justify-between border-b border-[#eaded3] px-4 py-3">
              <span className="text-sm font-semibold text-[#80695d]">
                {selected !== null
                  ? selected + 1
                  : 1}{" "}
                / {photos.length}
              </span>

              <button
                ref={closeButton}
                type="button"
                onClick={close}
                aria-label={
                  es ? "Cerrar" : "Close"
                }
                className="rounded-full px-4 py-2 text-xl font-bold text-[#302018] hover:bg-[#fff4e9]"
              >
                ×
              </button>
            </div>

            {/* FOTOGRAFÍA GRANDE */}

            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#211712]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.url}
                alt={
                  title(current) ||
                  (es
                    ? "Fotografía ampliada"
                    : "Enlarged photograph")
                }
                className="max-h-[65vh] max-w-full object-contain"
              />

              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={previous}
                    aria-label={
                      es
                        ? "Fotografía anterior"
                        : "Previous photo"
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-4 py-3 text-2xl text-white hover:bg-black/80"
                  >
                    ‹
                  </button>

                  <button
                    type="button"
                    onClick={next}
                    aria-label={
                      es
                        ? "Siguiente fotografía"
                        : "Next photo"
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-4 py-3 text-2xl text-white hover:bg-black/80"
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            {/* TÍTULO Y PIE DE FOTO */}

            {(title(current) ||
              caption(current)) && (
              <div className="max-h-40 overflow-y-auto px-5 py-4">
                {title(current) && (
                  <h3 className="text-lg font-black text-[#302018]">
                    {title(current)}
                  </h3>
                )}

                {caption(current) && (
                  <p className="mt-2 text-sm leading-6 text-[#80695d]">
                    {caption(current)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ==========================================
// PÁGINA PÚBLICA DEL NEGOCIO
// ==========================================

export function PublicStall({
  initial,
  lang,
  timezone,
  confirmation,
  holds,
  stampCard,
  vapidKey,
  signedIn = false,
  t,
}: {
  initial: PublicSnapshot;
  lang: "es" | "en";
  timezone: string;
  confirmation: Confirmation | null;
  holds: HeldOrder[];
  stampCard: StampCardInfo | null;
  vapidKey: string | null;
  /** Accounts on and signed in: the chat can reserve without asking to sign in. */
  signedIn?: boolean;
  t: Dictionary;
}) {
  const [snap, setSnap] =
    useState(initial);

  const es = lang === "es";

  const settings = snap.settings;
  const theme = settings?.theme;

  const isDemo =
    snap.slug === "birria-dona-lupe";

  const logoFallback = isDemo
    ? "/logo-birria-dona-lupe.png"
    : null;

  const coverFallback = isDemo
    ? "/menu/plato-birria.jpg"
    : null;

  const logoUrl = safeUrl(
    settings?.logoUrl,
  );

  const coverUrl = safeUrl(
    settings?.coverUrl,
  );

  const tagline =
    (es
      ? settings?.taglineEs
      : settings?.taglineEn) ||
    (isDemo
      ? es
        ? "Tradición y sabor casero"
        : "Homestyle tradition and flavor"
      : "");

  const description =
    (es
      ? settings?.descriptionEs
      : settings?.descriptionEn) ||
    (isDemo
      ? es
        ? "El sabor de la birria tradicional, preparado para ti. Descubre lo que tenemos disponible y aparta tus favoritos antes de que se acaben."
        : "The taste of traditional birria, prepared for you. Explore what's available and reserve your favorites before they sell out."
      : "");

  const welcomeMessage = es
    ? settings?.welcomeMessageEs
    : settings?.welcomeMessageEn;

  // ========================================
  // COLORES Y DISEÑO
  // ========================================

  const primaryColor = safeColor(
    theme?.primaryColor,
  );

  const secondaryColor = safeColor(
    theme?.secondaryColor,
  );

  const textColor = safeColor(
    theme?.textColor,
  );

  const backgroundColor = safeColor(
    theme?.backgroundColor,
  );

  const buttonColor = safeColor(
    theme?.buttonColor,
  );

  const headerBackgroundColor =
    safeColor(
      theme?.headerBackgroundColor,
    ) ?? "#ffffff";

  const headerTextColor =
    safeColor(
      theme?.headerTextColor,
    ) ?? "#2e1b14";

  const coverPosition =
    theme?.coverPosition === "background"
      ? "background"
      : "right";

  const showCover =
    settings?.showCover !== false;

  const backgroundHero =
    showCover &&
    coverPosition === "background";

  const fontFamily =
    theme?.typography === "classic"
      ? 'Georgia, "Times New Roman", serif'
      : theme?.typography === "elegant"
        ? '"Palatino Linotype", Georgia, serif'
        : theme?.typography === "rounded"
          ? '"Trebuchet MS", Arial, sans-serif'
          : undefined;

  const styles = {
    ...(fontFamily
      ? { fontFamily }
      : {}),

    ...(backgroundColor
      ? { backgroundColor }
      : {}),

    ...(textColor
      ? { color: textColor }
      : {}),

    ...(primaryColor
      ? {
          "--brand-custom": primaryColor,
        }
      : {}),

    ...(secondaryColor
      ? {
          "--secondary-custom":
            secondaryColor,
        }
      : {}),

    ...(buttonColor
      ? {
          "--button-custom": buttonColor,
        }
      : {}),
  } as CSSProperties;

  // ========================================
  // UBICACIÓN
  // ========================================

  const location = [
    settings?.address,
    settings?.city,
    settings?.state,
  ]
    .filter(Boolean)
    .join(", ");

  const mapsUrl = safeUrl(
    settings?.googleMapsUrl,
  );

  // ========================================
  // GALERÍA CON SUS TEXTOS
  // ========================================

  const galleryUrls = (
    settings?.galleryUrls ?? []
  )
    .map(safeUrl)
    .filter(
      (url): url is string =>
        url !== null,
    );

  const publicGalleryPhotos: GalleryPhoto[] =
    galleryUrls.map((url, index) => {
      const saved = (
        settings?.galleryPhotos ?? []
      ).find(
        (photo) => photo.url === url,
      );

      return {
        id: saved?.id || `${index}-${url}`,
        url,
        titleEs: saved?.titleEs ?? "",
        titleEn: saved?.titleEn ?? "",
        captionEs:
          saved?.captionEs ?? "",
        captionEn:
          saved?.captionEn ?? "",
      };
    });

  // ========================================
  // REDES SOCIALES
  // ========================================

  const socials = [
    {
      label: "Instagram",
      url: settings?.instagram,
    },
    {
      label: "Facebook",
      url: settings?.facebook,
    },
    {
      label: "TikTok",
      url: settings?.tiktok,
    },
    {
      label: es
        ? "Sitio web"
        : "Website",
      url: settings?.website,
    },
  ].flatMap((item) => {
    const url = safeUrl(item.url);

    return url
      ? [{ label: item.label, url }]
      : [];
  });

  // ========================================
  // VISIBILIDAD Y ORDEN
  // ========================================

  const hasHours =
    Boolean(
      settings?.openingHours?.length,
    );

  const hasContact =
    Boolean(
      socials.length ||
      settings?.phone ||
      settings?.whatsapp ||
      settings?.email,
    );

  const orderedSections =
    organizeSections(
      settings?.sectionOrder,
      {
        showLocation:
          settings?.showLocation !==
          false,

        showHours:
          settings?.showOpeningHours !==
          false,

        showSocial:
          settings?.showSocialLinks !==
          false,

        showGallery:
          settings?.showGallery !==
          false,
      },
    );

  // ========================================
  // ACTUALIZACIÓN AUTOMÁTICA
  // ========================================

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const response = await fetch(
          `/api/stalls/${initial.slug}`,
          {
            cache: "no-store",
          },
        );

        if (response.ok && alive) {
          setSnap(
            await response.json(),
          );
        }
      } catch {
        // Conservar últimos datos.
      }
    };

    const id = setInterval(
      tick,
      POLL_MS,
    );

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [initial.slug]);

  useEffect(() => {
    if (!snap.isOpen) return;

    forgetWatch(
      snap.slug,
      null,
    );

    for (const dish of snap.dishes) {
      if (dish.portions > 0) {
        forgetWatch(
          snap.slug,
          dish.id,
        );
      }
    }
  }, [snap]);

  const available =
    snap.dishes.filter(
      (dish) => dish.portions > 0,
    );

  const gone =
    snap.dishes.filter(
      (dish) => dish.portions === 0,
    );

  const dishes = [
    ...available,
    ...gone,
  ];

  // Por sección; dentro de cada una, primero lo que sí hay.
  const menuGroups = groupBySection(
    dishes,
    snap.sections,
  );
  const showSections = menuGroups.some(
    (g) => g.id !== null,
  );

  // ========================================
  // PORTADA
  // ========================================

  const coverPhoto = (
    <>
      {coverUrl ? (
        <CustomImage
          key={coverUrl}
          src={coverUrl}
          fallback={coverFallback}
          alt={`Portada de ${snap.name}`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : coverFallback ? (
        <Image
          src={coverFallback}
          alt={
            es
              ? "Plato de birria tradicional"
              : "Traditional birria plate"
          }
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#f4e5d5] text-7xl">
          🍽️
        </div>
      )}
    </>
  );

  // ========================================
  // INFORMACIÓN DEL ENCABEZADO
  // ========================================

  const headerInformation = (
    <div
      className={`relative z-10 flex min-w-0 flex-col justify-center gap-6 px-6 py-8 sm:px-9 sm:py-12 lg:px-12 lg:py-14 ${
        backgroundHero
          ? "w-full max-w-[720px] rounded-[1.5rem] shadow-xl"
          : ""
      }`}
      style={{
        backgroundColor:
          headerBackgroundColor,
        color: headerTextColor,
      }}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
        <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-3xl border border-line bg-[#fff9ed] shadow-sm sm:h-36 sm:w-36">
          {logoUrl ? (
            <CustomImage
              key={logoUrl}
              src={logoUrl}
              fallback={logoFallback}
              alt={`Logo de ${snap.name}`}
              className="h-full w-full object-contain p-1"
            />
          ) : logoFallback ? (
            <Image
              src={logoFallback}
              alt={`Logo de ${snap.name}`}
              fill
              sizes="144px"
              className="object-contain p-1"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">
              🏪
            </div>
          )}
        </div>

        <div className="min-w-0">
          {tagline && (
            <p
              className="text-xs font-bold uppercase tracking-[0.18em] text-brand"
              style={
                primaryColor
                  ? {
                      color: primaryColor,
                    }
                  : undefined
              }
            >
              {tagline}
            </p>
          )}

          <h1
            className="mt-3 break-words text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-[2.7rem]"
            style={{
              color: headerTextColor,
            }}
          >
            {snap.name}
          </h1>
        </div>
      </div>

      {settings?.showDescription !==
        false &&
        description && (
          <p
            className="max-w-xl text-sm leading-relaxed sm:text-base"
            style={{
              color: headerTextColor,
              opacity: 0.85,
            }}
          >
            {description}
          </p>
        )}

      {welcomeMessage && (
        <p
          className="max-w-xl text-sm font-semibold leading-relaxed"
          style={{
            color:
              primaryColor ??
              headerTextColor,
          }}
        >
          {welcomeMessage}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
            snap.isOpen
              ? "bg-ok-soft text-ok"
              : "bg-bad-soft text-bad"
          }`}
        >
          <span
            className={`size-2.5 rounded-full ${
              snap.isOpen
                ? "animate-pulse bg-ok"
                : "bg-bad"
            }`}
          />

          {snap.isOpen
            ? t.open
            : t.closed}
        </span>

        <InstallAppButton lang={lang} />
      </div>
    </div>
  );

  // ========================================
  // MENÚ PÚBLICO
  // ========================================

  const menuSection = (
    <section className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p
            className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand"
            style={
              primaryColor
                ? { color: primaryColor }
                : undefined
            }
          >
            {es
              ? "Menú del día"
              : "Today's menu"}
          </p>

          <h2 className="text-3xl font-black tracking-tight text-[#2e1b14] sm:text-4xl">
            {es
              ? "Lo que todavía hay"
              : "What's still available"}
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            {es
              ? "Elige entre nuestros platillos y consulta su disponibilidad."
              : "Explore our dishes and check what's available."}
          </p>
        </div>

        {snap.isOpen && (
          <span className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted sm:text-sm">
            {available.length}{" "}
            {es
              ? "platillos disponibles"
              : "dishes available"}
          </span>
        )}
      </div>

      {!snap.isOpen ? (
        <div className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-10">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-bad-soft text-bad">
            ◷
          </div>

          <h3 className="text-xl font-bold">
            {es
              ? "Por ahora estamos cerrados"
              : "We're currently closed"}
          </h3>

          <p className="max-w-xl leading-relaxed text-muted">
            {t.closedNote}
          </p>

          {vapidKey && (
            <div className="pt-2">
              <NotifyButton
                slug={snap.slug}
                dishId={null}
                lang={lang}
                vapidKey={vapidKey}
                t={t}
                wide
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {showSections && (
            <nav
              aria-label={es ? "Secciones del menú" : "Menu sections"}
              className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
            >
              {menuGroups.map((group) => (
                <a
                  key={group.id ?? "otros"}
                  href={`#menu-${group.id ?? "otros"}`}
                  className="shrink-0 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold transition hover:border-brand hover:text-brand"
                >
                  {groupName(group, lang)}
                </a>
              ))}
            </nav>
          )}

          {menuGroups.map((group) => (
        <div
          key={group.id ?? "otros"}
          id={`menu-${group.id ?? "otros"}`}
          className="scroll-mt-4"
        >
          {showSections && (
            <h3 className="mb-4 text-xl font-black tracking-tight text-[#2e1b14] sm:text-2xl">
              {groupName(group, lang)}
            </h3>
          )}
        <ul className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
          {group.dishes.map((dish) => {
            const out =
              dish.portions === 0;

            const few =
              !out &&
              dish.portions <= FEW;

            const dishName = es
              ? dish.nameEs
              : dish.nameEn ||
                dish.nameEs;

            const fallback = isDemo
              ? getDemoDishImage(
                  dish.nameEs,
                  dish.nameEn,
                )
              : null;

            return (
              <li
                key={dish.id}
                className={`group overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  out
                    ? "opacity-75"
                    : ""
                }`}
              >
                <div className="flex h-full flex-col sm:flex-row">
                  <div className="relative h-56 shrink-0 overflow-hidden bg-[#f2e5d8] sm:h-auto sm:w-[42%]">
                    <DishImage
                      key={`${dish.id}-${dish.imageUrl ?? ""}`}
                      imageUrl={
                        dish.imageUrl
                      }
                      fallback={fallback}
                      alt={dishName}
                      out={out}
                    />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 p-6 sm:p-7">
                    <div>
                      <span
                        className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${
                          out
                            ? "bg-bad-soft text-bad"
                            : few
                              ? "bg-warn-soft text-warn"
                              : "bg-ok-soft text-ok"
                        }`}
                      >
                        {out
                          ? t.soldOut
                          : few
                            ? t.fewLeft
                            : fill(t.left, {
                                n: dish.portions,
                              })}
                      </span>

                      <h3
                        className={`mt-4 break-words text-xl font-extrabold leading-tight text-[#2e1b14] sm:text-2xl ${
                          out
                            ? "line-through"
                            : ""
                        }`}
                        style={
                          textColor
                            ? {
                                color:
                                  textColor,
                              }
                            : undefined
                        }
                      >
                        {dishName}
                      </h3>

                      <p className="mt-3 text-sm leading-relaxed text-muted">
                        {out
                          ? es
                            ? "Agotado por el momento."
                            : "Currently sold out."
                          : es
                            ? "Consulta y aparta este platillo con nuestro asistente."
                            : "Ask our assistant to reserve this dish."}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-5">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                          {es
                            ? "Precio"
                            : "Price"}
                        </p>

                        <p
                          className="text-2xl font-black tracking-tight text-brand"
                          style={
                            primaryColor
                              ? {
                                  color:
                                    primaryColor,
                                }
                              : undefined
                          }
                        >
                          {money(
                            dish.priceCents,
                            snap.currency,
                            lang,
                          )}
                        </p>
                      </div>

                      {out && vapidKey && (
                        <NotifyButton
                          slug={snap.slug}
                          dishId={dish.id}
                          lang={lang}
                          vapidKey={vapidKey}
                          t={t}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        </div>
          ))}
        </div>
      )}
    </section>
  );

  // ========================================
  // ASISTENTE DE RESERVAS
  // ========================================

  const chatSection = (
    <section id="chat" className="min-w-0 scroll-mt-4 space-y-6 sm:space-y-8">
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand">
          {es
            ? "Estamos para ayudarte"
            : "We're here to help"}
        </p>

        <h2 className="text-3xl font-black tracking-tight text-[#2e1b14] sm:text-4xl">
          {es
            ? "Haz tu apartado"
            : "Reserve your order"}
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          {es
            ? "Pregunta por tus platillos favoritos, revisa su disponibilidad y solicita tu apartado."
            : "Ask about your favorite dishes, check availability and request your reservation."}
        </p>
      </div>

      <div className="min-w-0 overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-sm">
        <AgentChat
          slug={snap.slug}
          lang={lang}
          currency={snap.currency}
          timezone={timezone}
          isOpen={snap.isOpen}
          signedIn={signedIn}
          t={t}
        />
      </div>
    </section>
  );

  // ========================================
  // RECOMPENSAS
  // ========================================

  
  const rewardsSection = stampCard ? (
    <PublicRewardsSection
      slug={snap.slug}
      lang={lang}
      card={stampCard}
    />
  ) : null;


  // ========================================
  // HORARIOS
  // ========================================

  const days = es
    ? [
        "Domingo",
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
      ]
    : [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

  const hoursSection = hasHours ? (
    <section className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-black text-[#2e1b14]">
        {es
          ? "Horarios de atención"
          : "Opening hours"}
      </h2>

      <ul className="mt-6 space-y-4 text-sm">
        {(settings?.openingHours ?? [])
          .slice()
          .sort(
            (a, b) =>
              a.day - b.day,
          )
          .map((hour) => (
            <li
              key={hour.day}
              className="flex justify-between gap-4"
            >
              <span className="font-semibold">
                {days[hour.day]}
              </span>

              <span className="text-muted">
                {hour.enabled
                  ? `${hour.open} – ${hour.close}`
                  : es
                    ? "Cerrado"
                    : "Closed"}
              </span>
            </li>
          ))}
      </ul>
    </section>
  ) : null;

  // ========================================
  // UBICACIÓN
  // ========================================

  const locationSection = location ? (
    <section className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-black text-[#2e1b14]">
        {es
          ? "Ubicación"
          : "Location"}
      </h2>

      <div className="mt-5 flex items-start gap-3 text-sm">
        <span aria-hidden="true">
          📍
        </span>

        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand underline underline-offset-4"
          >
            {location}
          </a>
        ) : (
          <span>{location}</span>
        )}
      </div>
    </section>
  ) : null;

  // ========================================
  // CONTACTO Y REDES SOCIALES
  // ========================================

  const socialSection = hasContact ? (
    <section className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-black text-[#2e1b14]">
        {es
          ? "Contacto y redes sociales"
          : "Contact and social media"}
      </h2>

      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        {settings?.phone && (
          <a
            href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}
            className="font-semibold text-brand underline underline-offset-4"
          >
            ☎ {settings.phone}
          </a>
        )}

        {settings?.whatsapp && (
          <a
            href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand underline underline-offset-4"
          >
            WhatsApp
          </a>
        )}

        {settings?.email && (
          <a
            href={`mailto:${settings.email}`}
            className="font-semibold text-brand underline underline-offset-4"
          >
            ✉ {settings.email}
          </a>
        )}

        {socials.map((social) => (
          <a
            key={social.label}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand underline underline-offset-4"
          >
            {social.label}
          </a>
        ))}
      </div>
    </section>
  ) : null;

  // ========================================
  // GALERÍA PÚBLICA
  // ========================================

  const gallerySection =
    publicGalleryPhotos.length > 0 ? (
      <PublicGallery
        lang={lang}
        photos={publicGalleryPhotos}
      />
    ) : null;

  // ========================================
  // SECCIONES EN EL ORDEN DEL DUEÑO
  // ========================================

  const sectionContent: Record<
    SectionId,
    ReactNode
  > = {
    menu: menuSection,
    chat: chatSection,
    rewards: rewardsSection,
    hours: hoursSection,
    location: locationSection,
    social: socialSection,
    gallery: gallerySection,
  };

  // ========================================
  // PÁGINA COMPLETA
  // ========================================

  return (
    <div
      className="
        public-stall
        flex w-full min-w-0 flex-col
        gap-10 sm:gap-12 lg:gap-14
        px-4 pt-6 pb-12
        sm:px-8 sm:pt-8 sm:pb-14
        lg:px-12 lg:pt-10 lg:pb-16
        xl:px-16
      "
      style={styles}
    >
      {/* COLORES PERSONALIZADOS */}

      <style>{`
        .public-stall {
          --stall-accent: var(--brand-custom, #a3341f);
        }

        .public-stall .text-brand {
          ${
            primaryColor
              ? `color: ${primaryColor};`
              : ""
          }
        }

        .public-stall .border-brand {
          ${
            primaryColor
              ? `border-color: ${primaryColor};`
              : ""
          }
        }

        .public-stall .bg-brand {
          ${
            buttonColor ||
            primaryColor
              ? `background-color: ${buttonColor || primaryColor};`
              : ""
          }
        }
      `}</style>

      {/* CONFIRMACIÓN DE RESERVA */}

      {confirmation && (
        <div
          role="status"
          className={`rounded-3xl border p-6 shadow-sm sm:p-8 ${
            confirmation.kind === "reserved"
              ? "border-ok/20 bg-ok-soft text-ok"
              : "border-warn/20 bg-warn-soft text-warn"
          }`}
        >
          {confirmation.kind ===
          "reserved" ? (
            <div className="space-y-3">
              <p className="text-lg font-extrabold sm:text-xl">
                {fill(
                  t.public.confirmedTitle,
                  {
                    name:
                      confirmation.name,
                  },
                )}
              </p>

              <p className="text-sm leading-relaxed">
                {fill(
                  t.public.confirmedBody,
                  {
                    time: clock(
                      confirmation.pickupBy,
                      timezone,
                      lang,
                    ),

                    total: money(
                      confirmation.totalCents,
                      snap.currency,
                      lang,
                    ),
                  },
                )}
              </p>

              {stampCard && (
                <p className="pt-1 text-sm font-semibold">
                  ⭐{" "}
                  {t.public.stampsNext}
                </p>
              )}
            </div>
          ) : (
            <p className="font-semibold">
              {confirmation.kind ===
              "cancelled"
                ? t.public
                    .cancelledNote
                : t.public.errorNote}
            </p>
          )}
        </div>
      )}

      {/* RESERVAS ACTIVAS */}

      <HeldOrders
        slug={snap.slug}
        lang={lang}
        currency={snap.currency}
        timezone={timezone}
        vapidKey={vapidKey}
        initial={holds}
        t={t}
      />

      {/* VOLVER A LA APP COMPLETA */}

      <a
        href={`/${lang}/negocios`}
        className="inline-block text-sm font-bold text-brand hover:underline"
      >
        ← {es ? "Explorar negocios" : "Explore businesses"}
      </a>

      {/* ENCABEZADO DEL NEGOCIO */}

      <header className="relative overflow-hidden rounded-[2rem] border border-line bg-surface shadow-sm">
        {backgroundHero ? (
          <div className="relative isolate min-h-[430px] p-4 sm:p-8 lg:flex lg:min-h-[550px] lg:items-center lg:p-12">
            <div className="absolute inset-0 -z-20">
              {coverPhoto}
            </div>

            <div className="pointer-events-none absolute inset-0 -z-10 bg-black/20" />

            {headerInformation}
          </div>
        ) : (
          <div
            className={
              showCover
                ? "grid lg:grid-cols-[1.15fr_0.85fr]"
                : "grid grid-cols-1"
            }
          >
            {headerInformation}

            {showCover && (
              <div className="relative min-h-[240px] overflow-hidden bg-[#f4e5d5] sm:min-h-[320px] lg:min-h-[380px]">
                {coverPhoto}

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
              </div>
            )}
          </div>
        )}
      </header>

      {/* ORDEN PERSONALIZADO */}

      {orderedSections.map((section) => (
        <div
          key={section.id}
          className="min-w-0"
        >
          {sectionContent[
            section.id
          ]}
        </div>
      ))}

      {/* PIE DE PÁGINA */}

      <footer className="border-t border-line pt-8 text-center">
        <p className="text-xs text-muted">
          {t.madeWith}
        </p>
      </footer>
    </div>
  );
}

// ==========================================
// TARJETA DE SELLOS EXISTENTE
// ==========================================

function StampCard({
  slug,
  card,
  t,
}: {
  slug: string;
  card: StampCardInfo;
  t: Dictionary;
}) {
  const p = t.public;

  const [phone, setPhone] =
    useState("");

  const [bad, setBad] =
    useState(false);

  async function lookUp(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const response = await fetch(
      `/api/stalls/${slug}/card`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          phone,
        }),
      },
    ).catch(() => null);

    if (response?.ok) {
      window.location.reload();
    } else {
      setBad(true);
    }
  }

  const have = card.have ?? 0;

  const ready =
    have >= card.perReward;

  const vars = {
    have,
    n: card.perReward,
    reward:
      card.reward.toLowerCase(),
  };

  return (
    <section
      className={`flex flex-col gap-6 rounded-[1.75rem] border border-line p-6 shadow-sm sm:p-9 ${
        ready
          ? "bg-warn-soft"
          : "bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold">
          {p.stampsTitle}
        </h3>

        <div className="rounded-full border border-line bg-background/70 px-4 py-2 text-sm font-bold">
          {have} /{" "}
          {card.perReward}
        </div>
      </div>

      <ol
        className="grid grid-cols-5 gap-2 sm:grid-cols-10"
        aria-label={fill(
          p.stampsCount,
          vars,
        )}
      >
        {Array.from(
          {
            length:
              card.perReward,
          },
          (_, index) => (
            <li
              key={index}
              className={`flex aspect-square items-center justify-center rounded-full border-2 text-lg font-bold transition-colors ${
                index < have
                  ? "border-brand bg-brand text-white"
                  : "border-dashed border-line text-muted"
              }`}
            >
              {index < have
                ? "★"
                : index ===
                    card.perReward -
                      1
                  ? "🎁"
                  : ""}
            </li>
          ),
        )}
      </ol>

      <p
        className={`text-sm leading-relaxed ${
          ready
            ? "font-semibold text-warn"
            : "text-muted"
        }`}
      >
        {ready
          ? fill(
              p.stampsReady,
              vars,
            )
          : card.have === null
            ? fill(
                p.stampsHowTo,
                vars,
              )
            : `${fill(
                p.stampsCount,
                vars,
              )} ${fill(
                p.stampsHowTo,
                vars,
              )}`}
      </p>

      {card.have === null && (
        <form
          onSubmit={lookUp}
          className="flex flex-col gap-3"
        >
          <label
            className="text-sm font-semibold"
            htmlFor="stamp-phone"
          >
            {p.stampsPhone}
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="stamp-phone"
              value={phone}
              onChange={(event) => {
                setPhone(
                  event.target.value.replace(
                    /[^\d +()-]/g,
                    "",
                  ),
                );

                setBad(false);
              }}
              inputMode="tel"
              autoComplete="tel"
              placeholder="55 1234 5678"
              className="min-w-0 flex-1 rounded-2xl border border-line bg-background px-4 py-3 outline-none focus:border-brand"
            />

            <button
              type="submit"
              disabled={
                phone.replace(
                  /\D/g,
                  "",
                ).length < 10
              }
              className="rounded-2xl bg-brand px-6 py-3 font-bold text-white transition-opacity hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {p.stampsPhoneButton}
            </button>
          </div>

          {bad && (
            <p className="text-sm text-bad">
              {p.stampsBadPhone}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
