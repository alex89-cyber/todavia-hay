
import "server-only";

import { z } from "zod";

const RECIPIENTS = [
  "ferpinpat05@gmail.com",
  "alexbonilla180305@gmail.com",
];

const ContactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  business: z.string().trim().max(120),
  email: z.string().trim().email().max(254),
  phone: z
    .string()
    .trim()
    .min(8)
    .max(30)
    .regex(/^[+\d\s().-]+$/),
  method: z.enum(["whatsapp", "email", "call"]),
  message: z.string().trim().max(2000),
  website: z.string().max(200).default(""),
  lang: z.enum(["es", "en"]).default("es"),
  consent: z.literal(true),
});

const METHOD_LABELS = {
  whatsapp: "WhatsApp",
  email: "Correo electrónico",
  call: "Llamada telefónica",
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  // This route is public, but only accepts small,
  // validated contact submissions.
  const contentType =
    request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return Response.json(
      { error: "invalid_content_type" },
      { status: 415 },
    );
  }

  // Reject submissions from other browser origins.
  const origin = request.headers.get("origin");

  if (origin) {
    let requestOrigin: string;

    try {
      requestOrigin = new URL(request.url).origin;
    } catch {
      return Response.json(
        { error: "invalid_request" },
        { status: 400 },
      );
    }

    const allowedOrigins = new Set([requestOrigin]);

    if (process.env.NEXT_PUBLIC_SITE_URL) {
      try {
        allowedOrigins.add(
          new URL(process.env.NEXT_PUBLIC_SITE_URL).origin,
        );
      } catch {
        console.error("Invalid NEXT_PUBLIC_SITE_URL");
      }
    }

    if (!allowedOrigins.has(origin)) {
      return Response.json(
        { error: "forbidden" },
        { status: 403 },
      );
    }
  }

  const length = Number(
    request.headers.get("content-length") ?? 0,
  );

  if (length > 12_000) {
    return Response.json(
      { error: "too_large" },
      { status: 413 },
    );
  }

  let raw: string;

  try {
    raw = await request.text();
  } catch {
    return Response.json(
      { error: "invalid_request" },
      { status: 400 },
    );
  }

  if (raw.length > 12_000) {
    return Response.json(
      { error: "too_large" },
      { status: 413 },
    );
  }

  let body: unknown;

  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json(
      { error: "bad_request" },
      { status: 400 },
    );
  }

  const parsed = ContactSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "bad_request" },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Honeypot: quietly accept automated spam
  // without sending an email.
  if (data.website.trim()) {
    return Response.json({ ok: true });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !sender) {
    console.error(
      "Contact email is not configured. Check RESEND_API_KEY and CONTACT_FROM_EMAIL.",
    );

    return Response.json(
      { error: "not_configured" },
      { status: 503 },
    );
  }

  const method = METHOD_LABELS[data.method];

  const safe = {
    name: escapeHtml(data.name),
    business: escapeHtml(data.business || "No especificado"),
    email: escapeHtml(data.email),
    phone: escapeHtml(data.phone),
    method: escapeHtml(method),
    message: escapeHtml(
      data.message || "Sin mensaje adicional",
    ).replace(/\n/g, "<br />"),
  };

  const subject =
    `Nueva solicitud de contacto - ¿Todavía hay?`;

  const html = `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width" />
      </head>
      <body style="margin:0;padding:32px;background:#f6f8f4;font-family:Arial,sans-serif;color:#244d38;">
        <div style="max-width:620px;margin:auto;background:#fff;border-radius:20px;overflow:hidden;">
          <div style="background:#244d38;padding:28px;">
            <h1 style="color:#fff;margin:0;font-size:25px;">
              ¿Todavía hay?
            </h1>
            <p style="color:#d7e7da;margin:10px 0 0;">
              Nueva solicitud desde la página web
            </p>
          </div>

          <div style="padding:30px;line-height:1.7;">
            <p>Una persona está interesada en conocer la plataforma.</p>

            <p><strong>Nombre:</strong> ${safe.name}</p>
            <p><strong>Negocio:</strong> ${safe.business}</p>
            <p><strong>Correo:</strong> ${safe.email}</p>
            <p><strong>Teléfono:</strong> ${safe.phone}</p>
            <p><strong>Prefiere contacto por:</strong> ${safe.method}</p>

            <div style="background:#f6f8f4;border-radius:12px;padding:20px;margin-top:22px;">
              <strong>Mensaje</strong>
              <p style="margin-bottom:0;overflow-wrap:anywhere;">
                ${safe.message}
              </p>
            </div>

            <p style="font-size:12px;color:#718276;margin-top:24px;">
              Esta solicitud fue enviada mediante el formulario
              de contacto de ¿Todavía hay?.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = [
    "Nueva solicitud - ¿Todavía hay?",
    "",
    `Nombre: ${data.name}`,
    `Negocio: ${data.business || "No especificado"}`,
    `Correo: ${data.email}`,
    `Teléfono: ${data.phone}`,
    `Medio preferido: ${method}`,
    "",
    "Mensaje:",
    data.message || "Sin mensaje adicional",
  ].join("\n");

  try {
    const response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: sender,

          // Both partners receive the same request.
          to: RECIPIENTS,

          // Clicking Reply addresses the interested person.
          reply_to: data.email,

          subject,
          html,
          text,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const detail = await response
        .text()
        .catch(() => "");

      console.error(
        "Resend email failed:",
        response.status,
        detail.slice(0, 1500),
      );

      return Response.json(
        { error: "email_failed" },
        { status: 502 },
      );
    }

    const result = await response
      .json()
      .catch(() => null);

    if (!result?.id) {
      console.error(
        "Resend did not return an email ID.",
      );

      return Response.json(
        { error: "email_failed" },
        { status: 502 },
      );
    }

    return Response.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "Contact email network error:",
      error,
    );

    return Response.json(
      { error: "email_failed" },
      { status: 502 },
    );
  }
}
