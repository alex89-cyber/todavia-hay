
import { z } from "zod";

import {
  NextResponse,
} from "next/server";

import {
  cookies,
} from "next/headers";

import {
  agentAvailable,
  chat,
} from "@/lib/agent";

import { origin } from "@/lib/origin";

import {
  loadStall,
} from "@/lib/reservations";

import {
  authEnabled,
} from "@/lib/auth/config";

import {
  currentAccount,
} from "@/lib/auth/server";

import {
  HOLDS_COOKIE,
} from "@/lib/stall";

import {
  holdIds,
} from "@/lib/holds";

// ==========================================
// TODAVÍA HAY
// API DEL CHAT
// ==========================================

const Body = z.object({
  lang: z.enum(["es", "en"]),

  messages: z
    .array(
      z.object({
        role: z.enum([
          "user",
          "assistant",
        ]),

        content: z
          .string()
          .min(1)
          .max(600),
      }),
    )
    .min(1)
    .max(30),
});

// ==========================================
// LÍMITES DE MENSAJES
// ==========================================

const WINDOW_MS = 10 * 60_000;
const MAX_MESSAGES = 20;

const hits = new Map<
  string,
  number[]
>();

function limited(
  ip: string,
): boolean {
  const now = Date.now();

  const recent = (
    hits.get(ip) ?? []
  ).filter(
    (time) =>
      now - time < WINDOW_MS,
  );

  recent.push(now);

  hits.set(ip, recent);

  return (
    recent.length > MAX_MESSAGES
  );
}

// ==========================================
// POST DEL CHAT
// ==========================================

export async function POST(
  request: Request,
  ctx: RouteContext<
    "/api/stalls/[slug]/chat"
  >,
) {
  const { slug } =
    await ctx.params;

  if (!agentAvailable()) {
    return NextResponse.json(
      {
        error: "agent_unavailable",
      },
      {
        status: 503,
      },
    );
  }

  // ========================================
  // VALIDAR MENSAJES
  // ========================================

  const parsed = Body.safeParse(
    await request
      .json()
      .catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "bad_request",
      },
      {
        status: 400,
      },
    );
  }

  // ========================================
  // CARGAR NEGOCIO
  // ========================================

  const state =
    await loadStall(slug);

  if (!state) {
    return NextResponse.json(
      {
        error: "not_found",
      },
      {
        status: 404,
      },
    );
  }

  // ========================================
  // LIMITAR USO DE GEMINI
  // ========================================

  const ip =
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() || "local";

  if (limited(ip)) {
    return NextResponse.json({
      reply:
        parsed.data.lang === "es"
          ? "Ya me escribiste muchos mensajes seguidos. Espera unos minutos y lo seguimos."
          : "You've sent too many messages. Please try again in a few minutes.",
    });
  }

  const messages =
    parsed.data.messages.slice(-8);

  if (
    messages.at(-1)?.role !== "user"
  ) {
    return NextResponse.json(
      {
        error: "bad_request",
      },
      {
        status: 400,
      },
    );
  }

  // ========================================
  // EJECUTAR GEMINI
  // ========================================

  try {
    const me =
      await currentAccount();

    const result = await chat(
      state,
      messages,
      {
        lang:
          parsed.data.lang,

        origin:
          origin(request),
      },
      {
        required:
          authEnabled(),

        customer: me
          ? {
              id: me.id,
              firstName:
                me.firstName,
              lastName:
                me.lastName,
            }
          : null,
      },
    );

    const response =
      NextResponse.json(
        result,
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );

    // ======================================
    // GUARDAR PEDIDO DEL NAVEGADOR
    // ======================================

    // La reserva debe haberse creado
    // realmente antes de guardar el ID.
    //
    // El cliente no puede enviar aquí
    // un ID arbitrario para asociarlo.

    if (result.reservation?.id) {
      const jar = await cookies();

      const previous = holdIds(
        jar.get(
          HOLDS_COOKIE,
        )?.value,
      );

      // Nueva reserva primero.
      // Eliminar identificadores repetidos.
      const ids = [
        result.reservation.id,
        ...previous.filter(
          (id) =>
            id !==
            result.reservation!.id,
        ),
      ].slice(0, 30);

      response.cookies.set(
        HOLDS_COOKIE,
        ids.join(","),
        {
          httpOnly: true,

          secure:
            process.env.NODE_ENV ===
            "production",

          sameSite: "lax",

          path: "/",

          maxAge:
            60 * 60 * 24 * 90,
        },
      );
    }

    return response;
  } catch (error) {
    console.error(
      "Error en el chat:",
      error,
    );

    return NextResponse.json(
      {
        error: "agent_failed",
      },
      {
        status: 502,
      },
    );
  }
}
