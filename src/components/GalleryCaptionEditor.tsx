
"use client";

import type {
  GalleryPhoto,
} from "@/lib/gallery";

type Props = {
  photos: GalleryPhoto[];
  onChange: (photos: GalleryPhoto[]) => void;
  disabled?: boolean;
  lang?: "es" | "en";
};

export default function GalleryCaptionEditor({
  photos,
  onChange,
  disabled = false,
  lang = "es",
}: Props) {
  const es = lang === "es";

  function updatePhoto(
    id: string,
    key:
      | "titleEs"
      | "titleEn"
      | "captionEs"
      | "captionEn",
    value: string,
  ) {
    onChange(
      photos.map((photo) =>
        photo.id === id
          ? {
              ...photo,
              [key]: value,
            }
          : photo,
      ),
    );
  }

  function movePhoto(
    index: number,
    direction: -1 | 1,
  ) {
    const destination = index + direction;

    if (
      destination < 0 ||
      destination >= photos.length
    ) {
      return;
    }

    const next = [...photos];

    [
      next[index],
      next[destination],
    ] = [
      next[destination],
      next[index],
    ];

    onChange(next);
  }

  if (photos.length === 0) {
    return (
      <div className="rounded-2xl border border-[#eaded3] bg-[#fffaf4] p-5">
        <p className="text-sm text-[#80695d]">
          {es
            ? "Agrega fotografías para escribir sus títulos y descripciones."
            : "Add photos to edit their titles and descriptions."}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-lg font-black text-[#302018]">
          {es
            ? "Títulos y pies de foto"
            : "Photo titles and captions"}
        </h3>

        <p className="mt-2 text-sm leading-6 text-[#80695d]">
          {es
            ? "Personaliza el texto de cada fotografía. Si no escribes nada, la imagen seguirá apareciendo normalmente."
            : "Customize the text for each photo. Captions are optional."}
        </p>
      </div>

      {photos.map((photo, index) => (
        <article
          key={photo.id}
          className="overflow-hidden rounded-2xl border border-[#eaded3] bg-white shadow-sm"
        >
          <div className="grid gap-4 p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div>
              <div className="aspect-square overflow-hidden rounded-xl bg-[#fffaf4]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={
                    photo.titleEs ||
                    `Fotografía ${index + 1}`
                  }
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={
                    disabled || index === 0
                  }
                  onClick={() =>
                    movePhoto(index, -1)
                  }
                  className="flex-1 rounded-lg border border-[#eaded3] px-3 py-2 text-sm font-bold text-[#a3341f] disabled:opacity-30"
                  aria-label={
                    es
                      ? "Mover fotografía hacia arriba"
                      : "Move photo up"
                  }
                >
                  ↑
                </button>

                <button
                  type="button"
                  disabled={
                    disabled ||
                    index === photos.length - 1
                  }
                  onClick={() =>
                    movePhoto(index, 1)
                  }
                  className="flex-1 rounded-lg border border-[#eaded3] px-3 py-2 text-sm font-bold text-[#a3341f] disabled:opacity-30"
                  aria-label={
                    es
                      ? "Mover fotografía hacia abajo"
                      : "Move photo down"
                  }
                >
                  ↓
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              <p className="text-sm font-bold text-[#a3341f]">
                {es
                  ? `Fotografía ${index + 1}`
                  : `Photo ${index + 1}`}
              </p>

              <label className="block">
                <span className="text-sm font-semibold text-[#38251D]">
                  Título en español
                </span>

                <input
                  type="text"
                  maxLength={100}
                  disabled={disabled}
                  value={photo.titleEs}
                  onChange={(event) =>
                    updatePhoto(
                      photo.id,
                      "titleEs",
                      event.target.value,
                    )
                  }
                  placeholder="Ej. Nuestra birria tradicional"
                  className="mt-1 w-full rounded-xl border border-[#eaded3] px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#38251D]">
                  Title in English
                </span>

                <input
                  type="text"
                  maxLength={100}
                  disabled={disabled}
                  value={photo.titleEn}
                  onChange={(event) =>
                    updatePhoto(
                      photo.id,
                      "titleEn",
                      event.target.value,
                    )
                  }
                  placeholder="Our traditional birria"
                  className="mt-1 w-full rounded-xl border border-[#eaded3] px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#38251D]">
                  Pie de foto en español
                </span>

                <textarea
                  rows={2}
                  maxLength={300}
                  disabled={disabled}
                  value={photo.captionEs}
                  onChange={(event) =>
                    updatePhoto(
                      photo.id,
                      "captionEs",
                      event.target.value,
                    )
                  }
                  placeholder="Preparada todos los días con nuestra receta casera."
                  className="mt-1 w-full resize-y rounded-xl border border-[#eaded3] px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#38251D]">
                  Photo caption in English
                </span>

                <textarea
                  rows={2}
                  maxLength={300}
                  disabled={disabled}
                  value={photo.captionEn}
                  onChange={(event) =>
                    updatePhoto(
                      photo.id,
                      "captionEn",
                      event.target.value,
                    )
                  }
                  placeholder="Freshly prepared with our homemade recipe."
                  className="mt-1 w-full resize-y rounded-xl border border-[#eaded3] px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
