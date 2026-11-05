/** Public origin of a request. Render sits behind a proxy, so the forwarded headers win. */
export function origin(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const h = request.headers;
  const url = new URL(request.url);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? url.host;
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
