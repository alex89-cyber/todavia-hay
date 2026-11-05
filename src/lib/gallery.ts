
/**
 * ¿Todavía hay?
 * Datos de la galería personalizada.
 *
 * Compatible con las fotografías existentes
 * guardadas como galleryUrls: string[].
 */

export type GalleryPhoto = {
  id: string;
  url: string;

  titleEs: string;
  titleEn: string;

  captionEs: string;
  captionEn: string;
};

export function createGalleryPhoto(
  url: string,
): GalleryPhoto {
  return {
    id: crypto.randomUUID(),
    url,
    titleEs: "",
    titleEn: "",
    captionEs: "",
    captionEn: "",
  };
}

/**
 * Convierte las URL anteriores en fotografías
 * editables sin perder las imágenes existentes.
 *
 * Las URL se usan para asociar los pies de foto
 * a las imágenes originales.
 */
export function normalizeGallery(
  urls: string[],
  saved: GalleryPhoto[] = [],
): GalleryPhoto[] {
  const savedByUrl = new Map(
    saved.map((photo) => [
      photo.url,
      photo,
    ]),
  );

  return urls
    .filter(
      (url) =>
        typeof url === "string" &&
        url.trim().length > 0,
    )
    .slice(0, 20)
    .map((url) => {
      const existing = savedByUrl.get(url);

      return existing
        ? {
            id: existing.id,
            url,
            titleEs: existing.titleEs ?? "",
            titleEn: existing.titleEn ?? "",
            captionEs:
              existing.captionEs ?? "",
            captionEn:
              existing.captionEn ?? "",
          }
        : createGalleryPhoto(url);
    });
}

export function getGalleryText(
  photo: GalleryPhoto,
  lang: "es" | "en",
) {
  return {
    title:
      lang === "en"
        ? photo.titleEn || photo.titleEs
        : photo.titleEs || photo.titleEn,

    caption:
      lang === "en"
        ? photo.captionEn || photo.captionEs
        : photo.captionEs || photo.captionEn,
  };
}
