
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL =
  __ENV.BASE_URL ||
  "http://localhost:3000";

const SLUG =
  __ENV.SLUG || "birria-dona-lupe";



export const options = {
  stages: [
    { duration: "20s", target: 10 },
    { duration: "20s", target: 20 },
    { duration: "20s", target: 35 },
    { duration: "20s", target: 50 },
    { duration: "20s", target: 50 },
    { duration: "20s", target: 0 },
  ],

  thresholds: {
    http_req_failed: [
      { threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "30s" },
    ],
    http_req_duration: ["p(95)<3000"],
    checks: ["rate>0.99"],
  },
};



export default function () {
  const page = http.get(
    `${BASE_URL}/es/${SLUG}`,
    {
      tags: { endpoint: "pagina" },
      timeout: "15s",
    }
  );

  check(page, {
    "Página HTTP 200": (r) => r.status === 200,
  });

  sleep(1);

  const api = http.get(
    `${BASE_URL}/api/stalls/${SLUG}`,
    {
      tags: { endpoint: "api" },
      timeout: "15s",
    }
  );

  check(api, {
    "API HTTP 200": (r) => r.status === 200,
  });

  sleep(2);
}
