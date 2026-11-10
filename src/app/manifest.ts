import type { MetadataRoute } from "next";

// App instalable completa de Todavía hay (iPhone la necesita para los avisos).
// Siempre abre en "Explora negocios", sin importar desde qué página se
// instaló; /negocios redirige al idioma del teléfono.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    start_url: "/negocios",
    scope: "/",
    name: "¿Todavía hay?",
    short_name: "¿Todavía hay?",
    description: "Menú en vivo, avisos y apartados para puestos de comida.",
    display: "standalone",
    background_color: "#fbf6ef",
    theme_color: "#a3341f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
