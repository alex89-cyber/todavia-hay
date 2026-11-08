import type { MetadataRoute } from "next";

// Lets customers add a stall page to the home screen, which iPhone requires
// for push alerts. No start_url: the app opens on the page it was added from.
export default function manifest(): MetadataRoute.Manifest {
  return {
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
