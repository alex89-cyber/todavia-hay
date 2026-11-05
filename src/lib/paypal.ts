import "server-only";

// PayPal Orders v2 with intent AUTHORIZE: the customer approves when reserving,
// PayPal holds the money, and the owner's "Entregado" tap captures it. If the
// customer never shows up, the authorization is voided and nothing is charged.
// The Agent Toolkit creates and pays orders but has no authorization
// capture/void, so this goes straight to the REST API.

// PAYPAL_API_BASE only points local tests at a fake PayPal.
const BASE =
  process.env.PAYPAL_API_BASE ??
  (process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set");

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new PayPalError("oauth", res.status, await res.text());
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

export class PayPalError extends Error {
  constructor(
    public step: string,
    public status: number,
    public body: string,
  ) {
    super(`PayPal ${step} failed (${status}): ${body.slice(0, 300)}`);
  }
}

async function call<T>(step: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(idempotencyKey ? { "PayPal-Request-Id": idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new PayPalError(step, res.status, await res.text());
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const money = (cents: number, currency: string) => ({
  currency_code: currency,
  value: (cents / 100).toFixed(2),
});

export type ReservationOrderInput = {
  reservationId: string;
  businessName: string;
  currency: string;
  items: { name: string; qty: number; unitCents: number }[];
  returnUrl: string;
  cancelUrl: string;
  locale: "es-MX" | "en-US";
};

/** Creates the order and returns its id and the URL the customer opens to approve it. */
export async function createReservationOrder(input: ReservationOrderInput) {
  const totalCents = input.items.reduce((s, i) => s + i.qty * i.unitCents, 0);
  const order = await call<{ id: string; links: { rel: string; href: string }[] }>(
    "create_order",
    "/v2/checkout/orders",
    {
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: input.reservationId,
          custom_id: input.reservationId,
          description: `${input.businessName}`.slice(0, 127),
          amount: {
            ...money(totalCents, input.currency),
            breakdown: { item_total: money(totalCents, input.currency) },
          },
          items: input.items.map((i) => ({
            name: i.name.slice(0, 127),
            quantity: String(i.qty),
            unit_amount: money(i.unitCents, input.currency),
            category: "PHYSICAL_GOODS",
          })),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: input.businessName.slice(0, 127),
            locale: input.locale,
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
    },
    `create-${input.reservationId}`,
  );
  const approveUrl = order.links.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  if (!approveUrl) throw new PayPalError("create_order", 200, "no approval link in response");
  return { orderId: order.id, approveUrl };
}

/** After the customer approves: places the hold and returns the authorization id. */
export async function authorizeOrder(orderId: string) {
  const res = await call<{
    status: string;
    payer?: { payer_id?: string };
    purchase_units: { payments?: { authorizations?: { id: string; status: string; expiration_time?: string }[] } }[];
  }>("authorize_order", `/v2/checkout/orders/${orderId}/authorize`, {}, `authorize-${orderId}`);
  const auth = res.purchase_units[0]?.payments?.authorizations?.[0];
  if (!auth) throw new PayPalError("authorize_order", 200, `no authorization (order status ${res.status})`);
  return {
    authorizationId: auth.id,
    status: auth.status,
    expiresAt: auth.expiration_time ?? null,
    payerId: res.payer?.payer_id ?? null,
  };
}

/** "Entregado": charges the held amount. */
export async function captureAuthorization(authorizationId: string) {
  return call<{ id: string; status: string }>(
    "capture_authorization",
    `/v2/payments/authorizations/${authorizationId}/capture`,
    { final_capture: true },
    `capture-${authorizationId}`,
  );
}

/** No-show or the owner cancels: releases the hold, nothing is charged. */
export async function voidAuthorization(authorizationId: string) {
  await call<void>("void_authorization", `/v2/payments/authorizations/${authorizationId}/void`);
}
