import { afterEach, describe, expect, it, vi } from "vitest";

import { sameOrigin } from "./origin";

// En Render la app corre en localhost:10000 detrás de un proxy.
const behindProxy = (originHeader?: string) =>
  new Request("http://localhost:10000/api/businesses/x/table-tabs", {
    method: "POST",
    headers: {
      ...(originHeader ? { origin: originHeader } : {}),
      host: "todavia-hay.onrender.com",
      "x-forwarded-proto": "https",
    },
  });

describe("sameOrigin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("acepta la página pública aunque el servidor vea localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(sameOrigin(behindProxy("https://todavia-hay.onrender.com"))).toBe(true);
  });

  it("acepta NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://todaviahay.mx/");
    expect(sameOrigin(behindProxy("https://todaviahay.mx"))).toBe(true);
  });

  it("rechaza otros sitios y peticiones sin origen", () => {
    expect(sameOrigin(behindProxy("https://malo.example"))).toBe(false);
    expect(sameOrigin(behindProxy())).toBe(false);
  });
});
