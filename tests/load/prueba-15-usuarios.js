
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "15s", target: 5 },
    { duration: "20s", target: 15 },
    { duration: "20s", target: 15 },
    { duration: "10s", target: 0 },
  ],

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<3000"],
    checks: ["rate>0.99"],
  },

  // Límite preventivo de solicitudes por VU.
  gracefulStop: "10s",
};

const BASE_URL =
  __ENV.BASE_URL ||
  "http://localhost:3000";

const SLUGS = [
  "birria-dona-lupe",
  "fondita",
];

function consultar(nombre, ruta) {
  const response = http.get(
    `${BASE_URL}${ruta}`,
    {
      timeout: "10s",
      tags: { pagina: nombre },
      redirects: 0,
    }
  );

  check(response, {
    [`${nombre}: responde correctamente`]: (r) =>
      r.status === 200,

    [`${nombre}: menos de 3 segundos`]: (r) =>
      r.timings.duration < 3000,
  });

  return response;
}

export default function () {
  // Cada usuario recorre distintas áreas públicas.

  consultar("Inicio", "/es");
  sleep(1);

  consultar("Explorar negocios", "/es/negocios");
  sleep(1);

  // Distribuimos usuarios entre restaurantes.
  const slug = SLUGS[
    (__VU - 1) % SLUGS.length
  ];

  consultar(
    "Página del restaurante",
    `/es/${slug}`
  );
  sleep(1);

  // Esta API consulta los datos del restaurante.
  // No necesita iniciar sesión ni crear pedidos.
  consultar(
    "Menú y disponibilidad",
    `/api/stalls/${slug}`
  );
  sleep(2);
}
