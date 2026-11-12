
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "15s", target: 1 },
    { duration: "20s", target: 2 },
    { duration: "10s", target: 0 },
  ],

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<3000"],
  },
};

const BASE_URL =
  __ENV.BASE_URL || "https://todavia-hay.onrender.com";

export default function () {
  const response = http.get(`${BASE_URL}/es`);

  check(response, {
    "La página responde 200": (r) =>
      r.status === 200,

    "Responde en menos de 3 segundos": (r) =>
      r.timings.duration < 3000,
  });

  sleep(2);
}
