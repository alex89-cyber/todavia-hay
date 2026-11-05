
"use client";

import { useEffect, useRef, useState } from "react";

type GalleryPhoto = {
  id: string;
  url: string;
  titleEs: string;
  titleEn: string;
  captionEs: string;
  captionEn: string;
};

type Props = {
  lang: "es" | "en";
  photos: GalleryPhoto[];
};

export default function PublicGallery({
  lang,
  photos,
}: Props) {
  const es = lang === "es";

  const [selected, setSelected] =
    useState<number | null>(null);

  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const isOpen = selected !== null;

  const current =
    selected === null ? null : photos[selected];

  function getTitle(photo: GalleryPhoto) {
    return (
      es
        ? photo.titleEs
        : photo.titleEn || photo.titleEs
    ).trim();
  }

  function getCaption(photo: GalleryPhoto) {
    return (
      es
        ? photo.captionEs
        : photo.captionEn || photo.captionEs
    ).trim();
  }

  function openPhoto(index: number) {
    previousFocus.current =
      document.activeElement as HTMLElement;

    setSelected(index);
  }

  function closePhoto() {
    setSelected(null);
  }

  function nextPhoto() {
    setSelected((value) =>
      value === null
        ? null
        : (value + 1) % photos.length,
    );
  }

  function previousPhoto() {
    setSelected((value) =>
      value === null
        ? null
        : (value - 1 + photos.length) %
          photos.length,
    );
  }

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelected(null);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setSelected((value) =>
          value === null
            ? null
            : (value + 1) % photos.length,
        );
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setSelected((value) =>
          value === null
            ? null
            : (value - 1 + photos.length) %
              photos.length,
        );
      }
    }

    window.addEventListener(
      "keydown",
      onKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        onKeyDown,
      );

      previousFocus.current?.focus();
    };
  }, [isOpen, photos.length]);

  if (!photos.length) return null;

  return (
    <section className="min-w-0 space-y-6">
      <h2 className="text-3xl font-black tracking-tight text-[#2e1b14]">
        {es
          ? "Nuestra galería"
          : "Our gallery"}
      </h2>

      {/* FOTOGRAFÍAS SIN TEXTO DEBAJO */}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {photos.map((photo, index) => (
          <button
            key={`${photo.id}-${photo.url}`}
            type="button"
            onClick={() => openPhoto(index)}
            aria-label={
              getTitle(photo) ||
              `${es ? "Abrir fotografía" : "Open photo"} ${index + 1}`
            }
            className="group aspect-square overflow-hidden rounded-[1.75rem] border border-line bg-surface text-left shadow-sm transition hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={
                getTitle(photo) ||
                `${es ? "Fotografía" : "Photo"} ${index + 1}`
              }
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {/* VISOR AMPLIADO */}

      {current && (
        <div
          role="presentation"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-8"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closePhoto();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              getTitle(current) ||
              (es
                ? "Fotografía ampliada"
                : "Expanded photo")
            }
            className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            {/* ENCABEZADO DEL VISOR */}

            <div className="flex items-center justify-between border-b border-[#eaded3] px-4 py-3">
              <span className="text-sm font-semibold text-[#60483d]">
                {selected! + 1} / {photos.length}
              </span>

              <button
                ref={closeRef}
                type="button"
                onClick={closePhoto}
                aria-label={
                  es
                    ? "Cerrar fotografía"
                    : "Close photo"
                }
                className="rounded-lg px-3 py-2 text-xl font-bold text-[#302018] hover:bg-[#fff4e9]"
              >
                ×
              </button>
            </div>

            {/* IMAGEN Y NAVEGACIÓN */}

            <div className="flex min-h-0 flex-1 items-center justify-between gap-2 bg-[#211b19] p-2 sm:p-4">
              <button
                type="button"
                disabled={photos.length <= 1}
                aria-label={
                  es
                    ? "Foto anterior"
                    : "Previous photo"
                }
                onClick={previousPhoto}
                className="shrink-0 rounded-full bg-white/15 px-3 py-2 text-2xl text-white hover:bg-white/30 disabled:opacity-30"
              >
                ‹
              </button>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.url}
                alt={
                  getTitle(current) ||
                  (es
                    ? "Fotografía ampliada"
                    : "Expanded photo")
                }
                className="max-h-[63dvh] min-w-0 max-w-full object-contain"
              />

              <button
                type="button"
                disabled={photos.length <= 1}
                aria-label={
                  es
                    ? "Foto siguiente"
                    : "Next photo"
                }
                onClick={nextPhoto}
                className="shrink-0 rounded-full bg-white/15 px-3 py-2 text-2xl text-white hover:bg-white/30 disabled:opacity-30"
              >
                ›
              </button>
            </div>

            {/* TEXTO SOLO AL ABRIR LA FOTO */}

            {(getTitle(current) ||
              getCaption(current)) && (
              <div className="max-h-[20dvh] overflow-y-auto px-5 py-4 text-[#302018]">
                {getTitle(current) && (
                  <h3 className="text-lg font-black">
                    {getTitle(current)}
                  </h3>
                )}

                {getCaption(current) && (
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#60483d]">
                    {getCaption(current)}
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
