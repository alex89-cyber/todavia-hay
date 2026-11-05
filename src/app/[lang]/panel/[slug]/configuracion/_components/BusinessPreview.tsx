
"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import type {
  StallSettings,
  PublicDish,
} from "@/lib/stall";

import {
  normalizeGallery,
  getGalleryText,
} from "@/lib/gallery";

import {
  DEFAULT_PAGE_SECTIONS,
  normalizePageSections,
} from "@/components/SectionOrderEditor";

// ==========================================
// TIPOS
// ==========================================

type Props = {
  lang: "es" | "en";
  name: string;
  slug: string;
  settings: StallSettings;
  dishes?: PublicDish[];
  isOpen?: boolean;
};

type ViewMode = "desktop" | "mobile";

type SectionId =
  (typeof DEFAULT_PAGE_SECTIONS)[number]["id"];

// ==========================================
// UTILIDADES
// ==========================================

function color(
  value: string | undefined,
  fallback: string,
): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : fallback;
}

function getFont(typography?: string): string {
  switch (typography) {
    case "classic":
      return "Georgia, serif";
    case "elegant":
      return '"Palatino Linotype", Georgia, serif';
    case "rounded":
      return '"Trebuchet MS", Arial, sans-serif';
    default:
      return "Arial, sans-serif";
  }
}

function PreviewCard({
  title,
  children,
  rounded,
  foreground,
}: {
  title: string;
  children: ReactNode;
  rounded: boolean;
  foreground: string;
}) {
  return (
    <section
      className={`border border-[#eaded3] bg-white p-4 shadow-sm ${
        rounded ? "rounded-2xl" : "rounded-sm"
      }`}
      style={{ color: foreground }}
    >
      <h3 className="mb-4 text-base font-black">
        {title}
      </h3>
      {children}
    </section>
  );
}

// ==========================================
// VISTA PREVIA DEL NEGOCIO
// ==========================================

export default function BusinessPreview({
  lang,
  name,
  slug,
  settings,
  dishes = [],
  isOpen,
}: Props) {
  const [mode, setMode] =
    useState<ViewMode>("desktop");

  const es = lang === "es";
  const theme = settings.theme ?? {};

  const primary = color(
    theme.primaryColor,
    "#a3341f",
  );

  const secondary = color(
    theme.secondaryColor,
    "#e39b2d",
  );

  const background = color(
    theme.backgroundColor,
    "#ffffff",
  );

  const foreground = color(
    theme.textColor,
    "#2e1b14",
  );

  const buttonColor = color(
    theme.buttonColor,
    "#a3341f",
  );

  const headerBackground = color(
    theme.headerBackgroundColor,
    "#ffffff",
  );

  const headerForeground = color(
    theme.headerTextColor,
    "#2e1b14",
  );

  const roundedCards =
    theme.roundedCards !== false;

  const roundedButtons =
    theme.roundedButtons !== false;

  const isDemo = slug === "birria-dona-lupe";

  const logo =
    settings.logoUrl ||
    (isDemo ? "/logo-birria-dona-lupe.png" : "");

  const cover =
    settings.coverUrl ||
    (isDemo ? "/menu/plato-birria.jpg" : "");

  const tagline = es
    ? settings.taglineEs
    : settings.taglineEn || settings.taglineEs;

  const description = es
    ? settings.descriptionEs
    : settings.descriptionEn || settings.descriptionEs;

  const welcome = es
    ? settings.welcomeMessageEs
    : settings.welcomeMessageEn ||
      settings.welcomeMessageEs;

  const address = [
    settings.address,
    settings.city,
    settings.state,
  ]
    .filter(Boolean)
    .join(", ");

  const photos = normalizeGallery(
    settings.galleryUrls ?? [],
    settings.galleryPhotos ?? [],
  );

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
  ).filter((section) => section.visible);

  const hours = (settings.openingHours ?? [])
    .filter((hour) => hour.enabled)
    .sort((a, b) => a.day - b.day);

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

  const pageStyle: CSSProperties = {
    backgroundColor: background,
    color: foreground,
    fontFamily: getFont(theme.typography),
  };

  const headerStyle: CSSProperties = {
    backgroundColor: headerBackground,
    color: headerForeground,
  };

  // ========================================
  // DATOS REALES DE LOS PLATILLOS
  // ========================================

  function dishName(dish: PublicDish): string {
    return (
      (es ? dish.nameEs : dish.nameEn || dish.nameEs) ||
      (es ? "Platillo sin nombre" : "Unnamed dish")
    );
  }

  function dishPrice(dish: PublicDish): string {
    return new Intl.NumberFormat(
      es ? "es-MX" : "en-US",
      {
        style: "currency",
        currency: "MXN",
      },
    ).format(dish.priceCents / 100);
  }

  // ========================================
  // RENDERIZAR CADA SECCIÓN
  // ========================================

  function renderSection(id: SectionId): ReactNode {
    switch (id) {
      // ====================================
      // MENÚ
      // ====================================

      case "menu":
        return (
          <PreviewCard
            title={es ? "🍽️ Menú del día" : "🍽️ Today's menu"}
            rounded={roundedCards}
            foreground="#302018"
          >
            {dishes.length ? (
              <div
                className={
                  mode === "mobile"
                    ? "grid grid-cols-1 gap-3"
                    : "grid grid-cols-2 gap-3"
                }
              >
                {dishes.map((dish) => {
                  const title = dishName(dish);

                  return (
                    <article
                      key={dish.id}
                      className="overflow-hidden rounded-xl border border-[#eaded3] bg-white text-[#302018]"
                    >
                      {/* IMAGEN DEL PLATILLO */}

                      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#fff4e9]">
                        {dish.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={dish.imageUrl}
                            alt={title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-[#80695d]">
                            <span className="text-4xl">
                              🍽️
                            </span>
                            <span className="text-xs font-medium">
                              {es
                                ? "Sin fotografía"
                                : "No photo"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* INFORMACIÓN DEL PLATILLO */}

                      <div className="space-y-2 p-3">
                        <h4 className="break-words text-sm font-bold text-[#302018]">
                          {title}
                        </h4>

                        <p
                          className="text-sm font-black"
                          style={{ color: primary }}
                        >
                          {dishPrice(dish)}
                        </p>

                        <p className="text-xs text-[#80695d]">
                          {dish.portions > 0
                            ? es
                              ? `${dish.portions} disponibles`
                              : `${dish.portions} available`
                            : es
                              ? "Agotado"
                              : "Sold out"}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl bg-[#fffaf4] p-5 text-center">
                <p className="text-3xl">🍽️</p>
                <p className="mt-2 text-sm text-[#80695d]">
                  {es
                    ? "Los platillos del menú aparecerán aquí."
                    : "Menu dishes will appear here."}
                </p>
              </div>
            )}
          </PreviewCard>
        );

      // ====================================
      // APARTADOS
      // ====================================

      case "chat":
        return (
          <PreviewCard
            title={es ? "🛍️ Haz tu apartado" : "🛍️ Reserve your order"}
            rounded={roundedCards}
            foreground="#302018"
          >
            <p className="text-sm text-[#60483d]">
              {es
                ? "Tus clientes podrán apartar productos disponibles desde la página pública."
                : "Customers can reserve available products from your public page."}
            </p>

            <div
              className={`mt-4 inline-flex px-5 py-3 text-sm font-bold text-white ${
                roundedButtons ? "rounded-xl" : "rounded-sm"
              }`}
              style={{ backgroundColor: buttonColor }}
            >
              {es ? "Apartar producto" : "Reserve item"}
            </div>

            <p className="mt-2 text-xs text-[#80695d]">
              {es
                ? "Vista previa solamente. No se realizan compras."
                : "Preview only. No purchases are made."}
            </p>
          </PreviewCard>
        );

      // ====================================
      // RECOMPENSAS
      // ====================================

      case "rewards":
        return (
          <PreviewCard
            title={es ? "🎁 Recompensas" : "🎁 Rewards"}
            rounded={roundedCards}
            foreground="#302018"
          >
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }, (_, index) => (
                <span
                  key={index}
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: secondary,
                    backgroundColor:
                      index < 2 ? secondary : "#fffaf4",
                  }}
                >
                  {index < 2 ? "⭐" : "○"}
                </span>
              ))}
            </div>

            <p className="mt-3 text-sm text-[#60483d]">
              {es
                ? "Aquí aparecerá la tarjeta de sellos del cliente."
                : "The customer's stamp card will appear here."}
            </p>

            <p className="mt-2 text-xs text-[#80695d]">
              {es
                ? "Estos sellos son ilustrativos."
                : "These stamps are illustrative."}
            </p>
          </PreviewCard>
        );

      // ====================================
      // HORARIOS
      // ====================================

      case "hours":
        if (settings.showOpeningHours === false) {
          return null;
        }

        return (
          <PreviewCard
            title={es ? "🕐 Horarios de atención" : "🕐 Opening hours"}
            rounded={roundedCards}
            foreground="#302018"
          >
            {hours.length ? (
              <div className="space-y-2">
                {hours.map((hour) => (
                  <div
                    key={hour.day}
                    className="flex justify-between gap-3 border-b border-[#eaded3] pb-2 text-sm text-[#302018]"
                  >
                    <span>{days[hour.day]}</span>
                    <span className="font-semibold">
                      {hour.open} – {hour.close}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#80695d]">
                {es
                  ? "No hay horarios activos."
                  : "No active opening hours."}
              </p>
            )}
          </PreviewCard>
        );

      // ====================================
      // UBICACIÓN
      // ====================================

      case "location":
        if (settings.showLocation === false) {
          return null;
        }

        return (
          <PreviewCard
            title={es ? "📍 Ubicación" : "📍 Location"}
            rounded={roundedCards}
            foreground="#302018"
          >
            <p className="text-sm text-[#60483d]">
              {address ||
                (es
                  ? "Agrega la dirección de tu negocio."
                  : "Add your business address.")}
            </p>

            {settings.googleMapsUrl && (
              <p
                className="mt-3 text-sm font-semibold"
                style={{ color: primary }}
              >
                {es
                  ? "Ver en Google Maps ↗"
                  : "View on Google Maps ↗"}
              </p>
            )}
          </PreviewCard>
        );

      // ====================================
      // CONTACTO Y REDES SOCIALES
      // ====================================

      case "social":
        if (settings.showSocialLinks === false) {
          return null;
        }

        return (
          <PreviewCard
            title={
              es
                ? "📱 Contacto y redes sociales"
                : "📱 Contact and social media"
            }
            rounded={roundedCards}
            foreground="#302018"
          >
            <div className="space-y-2 text-sm text-[#60483d]">
              {settings.phone && (
                <p>📞 {settings.phone}</p>
              )}

              {settings.whatsapp && (
                <p>💬 WhatsApp: {settings.whatsapp}</p>
              )}

              {settings.email && (
                <p>✉️ {settings.email}</p>
              )}

              {settings.instagram && (
                <p>📸 Instagram</p>
              )}

              {settings.facebook && (
                <p>📘 Facebook</p>
              )}

              {settings.tiktok && (
                <p>🎵 TikTok</p>
              )}

              {settings.website && (
                <p>🌐 {es ? "Página web" : "Website"}</p>
              )}

              {!settings.phone &&
                !settings.whatsapp &&
                !settings.email &&
                !settings.instagram &&
                !settings.facebook &&
                !settings.tiktok &&
                !settings.website && (
                  <p className="text-[#80695d]">
                    {es
                      ? "Agrega tus medios de contacto."
                      : "Add your contact information."}
                  </p>
                )}
            </div>
          </PreviewCard>
        );

      // ====================================
      // GALERÍA
      // ====================================

      case "gallery":
        if (settings.showGallery === false) {
          return null;
        }

        return (
          <PreviewCard
            title={es ? "📷 Galería" : "📷 Gallery"}
            rounded={roundedCards}
            foreground="#302018"
          >
            {photos.length ? (
              <div
                className={`grid gap-3 ${
                  mode === "mobile"
                    ? "grid-cols-2"
                    : "grid-cols-3"
                }`}
              >
                {photos.map((photo) => {
                  const photoText = getGalleryText(
                    photo,
                    lang,
                  );

                  return (
                    <div
                      key={photo.id}
                      className="overflow-hidden rounded-xl border border-[#eaded3] bg-white"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={
                          photoText.title || "Fotografía"
                        }
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />

                      {(photoText.title ||
                        photoText.caption) && (
                        <div className="p-2">
                          {photoText.title && (
                            <p className="text-xs font-bold text-[#302018]">
                              {photoText.title}
                            </p>
                          )}

                          {photoText.caption && (
                            <p className="mt-1 text-xs text-[#80695d]">
                              {photoText.caption}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[#80695d]">
                {es
                  ? "Tus fotografías aparecerán aquí."
                  : "Your photos will appear here."}
              </p>
            )}
          </PreviewCard>
        );

      default:
        return null;
    }
  }

  return (
    <section className="space-y-4">
      {/* CONTROLES */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#302018]">
            {es
              ? "Vista previa de mi página"
              : "My page preview"}
          </h2>

          <p className="mt-1 text-xs text-[#80695d]">
            {es
              ? "Los cambios se muestran aquí antes de guardar."
              : "Changes appear here before saving."}
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-[#eaded3] bg-white p-1">
          <button
            type="button"
            aria-pressed={mode === "desktop"}
            onClick={() => setMode("desktop")}
            className={`rounded-lg px-3 py-2 text-xs font-bold ${
              mode === "desktop"
                ? "bg-[#a3341f] text-white"
                : "text-[#60483d]"
            }`}
          >
            🖥️ {es ? "PC" : "Desktop"}
          </button>

          <button
            type="button"
            aria-pressed={mode === "mobile"}
            onClick={() => setMode("mobile")}
            className={`rounded-lg px-3 py-2 text-xs font-bold ${
              mode === "mobile"
                ? "bg-[#a3341f] text-white"
                : "text-[#60483d]"
            }`}
          >
            📱 {es ? "Celular" : "Mobile"}
          </button>
        </div>
      </div>

      {/* MARCO DE VISTA PREVIA */}

      <div className="overflow-hidden rounded-3xl border border-[#eaded3] bg-[#ede4dc] p-3 sm:p-5">
        <div
          className={`mx-auto overflow-hidden border border-black/10 bg-white shadow-xl transition-all duration-300 ${
            mode === "mobile"
              ? "max-w-[375px] rounded-[2rem]"
              : "w-full rounded-xl"
          }`}
        >
          {/* BARRA SIMULADA */}

          <div className="flex items-center gap-2 border-b border-black/10 bg-[#f7f7f7] px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff605c]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd44]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#00ca4e]" />

            <div className="ml-3 min-w-0 flex-1 truncate rounded-md bg-white px-3 py-1 text-center text-[10px] text-gray-500">
              todaviahay / {slug}
            </div>
          </div>

          <div
            style={pageStyle}
            className="min-h-[400px]"
          >
            {/* PORTADA */}

            <header
              className={
                theme.coverPosition === "background" &&
                settings.showCover !== false
                  ? "relative isolate overflow-hidden p-4"
                  : mode === "desktop" &&
                      settings.showCover !== false
                    ? "grid grid-cols-[1.1fr_0.9fr]"
                    : "flex flex-col"
              }
            >
              {theme.coverPosition === "background" &&
                settings.showCover !== false &&
                cover && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cover}
                      alt="Portada"
                      className="absolute inset-0 -z-20 h-full w-full object-cover"
                    />

                    <div className="absolute inset-0 -z-10 bg-black/25" />
                  </>
                )}

              <div
                className={`p-5 ${
                  theme.coverPosition === "background" &&
                  settings.showCover !== false
                    ? "rounded-xl shadow-lg"
                    : ""
                }`}
                style={headerStyle}
              >
                <div className="flex items-center gap-3">
                  {logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logo}
                      alt="Logo"
                      className="h-14 w-14 rounded-xl bg-white object-contain p-1"
                    />
                  )}

                  <div className="min-w-0">
                    {tagline && (
                      <p
                        className="text-[10px] font-bold uppercase tracking-wide"
                        style={{ color: primary }}
                      >
                        {tagline}
                      </p>
                    )}

                    <h2 className="break-words text-xl font-black">
                      {name ||
                        (es
                          ? "Mi negocio"
                          : "My business")}
                    </h2>
                  </div>
                </div>

                {settings.showDescription !== false &&
                  description && (
                    <p className="mt-4 text-sm leading-6 opacity-85">
                      {description}
                    </p>
                  )}

                {welcome && (
                  <p
                    className="mt-3 text-sm font-semibold"
                    style={{ color: primary }}
                  >
                    {welcome}
                  </p>
                )}

                {typeof isOpen === "boolean" && (
                  <span
                    className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                      isOpen
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {isOpen
                      ? es
                        ? "● Abierto"
                        : "● Open"
                      : es
                        ? "● Cerrado"
                        : "● Closed"}
                  </span>
                )}
              </div>

              {theme.coverPosition !== "background" &&
                settings.showCover !== false &&
                cover && (
                  <div className="relative min-h-[160px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cover}
                      alt="Portada"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                )}
            </header>

            {/* SECCIONES ORDENADAS */}

            <div className="space-y-4 p-4">
              {sections.map((section) => (
                <div key={section.id}>
                  {renderSection(section.id)}
                </div>
              ))}
            </div>

            {/* PIE DE PÁGINA */}

            <footer className="border-t border-black/10 px-4 py-5 text-center text-xs opacity-60">
              ¿Todavía hay?
            </footer>
          </div>
        </div>
      </div>

      <p className="text-xs leading-5 text-[#80695d]">
        {es
          ? "Esta es una vista previa visual. No realiza compras ni canjes. Si algún platillo no tiene una imagen registrada, aparecerá el indicador Sin fotografía."
          : "This is a visual preview. It does not make purchases or redeem rewards. Dishes without registered images display a No photo indicator."}
      </p>
    </section>
  );
}
