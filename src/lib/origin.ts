/** Public origin of a request. Render sits behind a proxy, so the forwarded headers win. */
export function origin(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const h = request.headers;
  const url = new URL(request.url);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? url.host;
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/**
 * ¿La petición viene de nuestra propia página? En Render, request.url es
 * http://localhost:10000, así que se compara contra el origen público
 * (encabezados del proxy) y contra NEXT_PUBLIC_SITE_URL.
 */
export function sameOrigin(request: Request): boolean {
  const incoming = request.headers.get("origin");
  if (!incoming) return false;
  const allowed = new Set([new URL(request.url).origin, origin(request)]);
  for (const env of [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    if (!env) continue;
    try {
      allowed.add(new URL(env).origin);
    } catch {
      // URL mal escrita en el entorno: se ignora.
    }
  }
  return allowed.has(incoming);
}
