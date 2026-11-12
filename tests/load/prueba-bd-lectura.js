
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL =
  __ENV.BASE_URL || "http://localhost:3000";

const RESTAURANTES = [
  "birria-dona-lupe",
  "fondita",
];

export const options = {
  stages: [
    { duration: "15s", target: 5 },
    { duration: "20s", target: 10 },
    { duration: "20s", target: 15 },
    { duration: "15s", target: 0 },
  ],

  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    http_req_duration: ["p(95)<3000"],
  },
};

export default function () {
  const slug =
    RESTAURANTES[(__VU - 1) % RESTAURANTES.length];

  const response = http.get(
    `${BASE_URL}/api/stalls/${slug}`,
    {
      timeout: "15s",
      tags: {
        endpoint: "consulta_supabase",
        restaurante: slug,
      },
    }
  );

  let data = null;

  if (response.status === 200) {
    try {
      data = response.json();
    } catch {
      data = null;
    }
  }

  check(response, {
    "API responde HTTP 200": (r) =>
      r.status === 200,

    "Respuesta JSON válida": () =>
      data !== null &&
      typeof data === "object" &&
      !Array.isArray(data),

    "Corresponde al restaurante solicitado": () =>
      data !== null &&
      data.slug === slug,

    "Datos disponibles": () =>
      data !== null &&
      Array.isArray(data.dishes),
  });

  sleep(2);
}
