
import { after, connection } from "next/server";
import { z } from "zod";

import {
  isActive,
  ownerView,
  phoneCardId,
  publicSnapshot,
} from "@/lib/stall";

import { PayPalError } from "@/lib/paypal";
import { notifyWaiting } from "@/lib/push";

import {
  cancel,
  deliver,
  loadStall,
} from "@/lib/reservations";

import { store } from "@/lib/store";

import {
  demoMode,
  isOwner,
  unauthorized,
} from "@/lib/owner-auth";

// ==========================================
// GET /api/stalls/:slug
// GET /api/stalls/:slug?view=owner
// ==========================================

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/stalls/[slug]">,
) {
  await connection();

  const { slug } = await ctx.params;
  const s = await loadStall(slug);

  if (!s) {
    return Response.json(
      { error: "not_found" },
      { status: 404 },
    );
  }

  const view = new URL(request.url)
    .searchParams.get("view");

  if (
    view === "owner" &&
    !(await isOwner())
  ) {
    return unauthorized();
  }

  return Response.json(
    view === "owner"
      ? ownerView(s)
      : publicSnapshot(s),
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

// ==========================================
// VALIDACIÓN
// ==========================================

const UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "pz",
] as const;

const line = z.object({
  dishId: z.string().min(1),
  qty: z.number().int().min(1).max(50),
});

const color = z
  .string()
  .regex(
    /^#[0-9a-fA-F]{6}$/,
    "invalid_color",
  );

const imageUrl = z
  .string()
  .url()
  .max(2048)
  .nullable();

const optionalText = (max: number) =>
  z.string().trim().max(max).optional();

const optionalUrl = z
  .union([
    z.string().url().max(2048),
    z.literal(""),
  ])
  .optional();

const openingHour = z.object({
  day: z.number().int().min(0).max(6),
  enabled: z.boolean(),
  open: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  close: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

// ==========================================
// APARIENCIA DEL NEGOCIO
// ==========================================

const theme = z.object({
  primaryColor: color.optional(),
  secondaryColor: color.optional(),
  backgroundColor: color.optional(),
  textColor: color.optional(),
  buttonColor: color.optional(),

  // Encabezado personalizado
  headerBackgroundColor: color.optional(),
  headerTextColor: color.optional(),

  // Ubicación de la portada
  coverPosition: z
    .enum(["right", "background"])
    .optional(),

  typography: z
    .enum([
      "modern",
      "classic",
      "rounded",
      "elegant",
    ])
    .optional(),

  layout: z
    .enum([
      "classic",
      "grid",
      "compact",
    ])
    .optional(),

  roundedCards: z.boolean().optional(),
  roundedButtons: z.boolean().optional(),
});

// ==========================================
// CONFIGURACIÓN DEL NEGOCIO
// ==========================================

const settings = z.object({
  // Imágenes
  logoUrl: imageUrl.optional(),
  coverUrl: imageUrl.optional(),

  galleryUrls: z
    .array(
      z.string().url().max(2048),
    )
    .max(20)
    .optional(),

  // Galería personalizada
  galleryPhotos: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        url: z.string().url().max(2048),
        titleEs: z.string().max(100),
        titleEn: z.string().max(100),
        captionEs: z.string().max(300),
        captionEn: z.string().max(300),
      }),
    )
    .max(20)
    .optional(),

  // Orden y visibilidad de secciones
  sectionOrder: z
    .array(
      z.object({
        id: z.enum([
          "menu",
          "chat",
          "rewards",
          "hours",
          "location",
          "social",
          "gallery",
        ]),
        visible: z.boolean(),
      }),
    )
    .max(7)
    .optional(),

  // Identidad y textos
  descriptionEs: optionalText(2000),
  descriptionEn: optionalText(2000),

  taglineEs: optionalText(180),
  taglineEn: optionalText(180),

  welcomeMessageEs: optionalText(500),
  welcomeMessageEn: optionalText(500),

  // Ubicación
  address: optionalText(300),
  city: optionalText(100),
  state: optionalText(100),
  postalCode: optionalText(20),
  country: optionalText(100),

  googleMapsUrl: optionalUrl,

  latitude: z
    .number()
    .min(-90)
    .max(90)
    .nullable()
    .optional(),

  longitude: z
    .number()
    .min(-180)
    .max(180)
    .nullable()
    .optional(),

  // Contacto
  phone: optionalText(40),
  whatsapp: optionalText(40),

  email: z
    .union([
      z.string().email().max(254),
      z.literal(""),
    ])
    .optional(),

  instagram: optionalText(2048),
  facebook: optionalText(2048),
  tiktok: optionalText(2048),
  website: optionalUrl,

  // Horarios
  openingHours: z
    .array(openingHour)
    .max(7)
    .optional(),

  // Apariencia visual
  theme: theme.optional(),

  // Secciones públicas
  showCover: z.boolean().optional(),
  showDescription: z.boolean().optional(),
  showLocation: z.boolean().optional(),
  showOpeningHours: z.boolean().optional(),
  showSocialLinks: z.boolean().optional(),
  showGallery: z.boolean().optional(),
});

// ==========================================
// ACCIONES DEL DUEÑO
// ==========================================

const Action = z.discriminatedUnion(
  "action",
  [
    // VENTA
    z.object({
      action: z.literal("sale"),
      lines: z
        .array(line)
        .min(1)
        .max(20),

      method: z.enum([
        "cash",
        "card",
      ]),

      customerPhone: z
        .string()
        .max(30)
        .optional(),
    }),

    // REABASTECIMIENTO
    z.object({
      action: z.literal("restock"),
      adds: z.record(
        z.string(),
        z
          .number()
          .min(0)
          .max(1_000_000),
      ),
    }),

    // AGREGAR SELLO
    z.object({
      action: z.literal("stamp"),

      cardId: z
        .string()
        .min(1)
        .max(100)
        .optional(),

      phone: z
        .string()
        .max(30)
        .optional(),

      name: z
        .string()
        .max(60)
        .optional(),
    }),

    // MARCAR AGOTADO
    z.object({
      action: z.literal("soldOut"),
      dishId: z.string().min(1),
      soldOut: z.boolean(),
    }),

    // ABRIR JORNADA
    z.object({
      action: z.literal("open"),

      counts: z.record(
        z.string(),
        z
          .number()
          .min(0)
          .max(1_000_000),
      ),
    }),

    // CERRAR JORNADA
    z.object({
      action: z.literal("close"),
    }),

    // REINICIAR DEMOSTRACIÓN
    z.object({
      action: z.literal("reset"),
    }),

    // ======================================
    // GUARDAR MENÚ
    // ======================================

    z.object({
      action: z.literal("saveMenu"),

      ingredients: z
        .array(
          z.object({
            key: z
              .string()
              .min(1)
              .max(60),

            name: z
              .string()
              .trim()
              .min(1)
              .max(60),

            unit: z.enum(UNITS),
          }),
        )
        .max(60),

      dishes: z
        .array(
          z.object({
            id: z
              .string()
              .max(60)
              .nullable(),

            nameEs: z
              .string()
              .trim()
              .min(1)
              .max(80),

            nameEn: z
              .string()
              .trim()
              .max(80),

            imageUrl: z
              .string()
              .url()
              .max(2048)
              .nullable()
              .optional(),

            priceCents: z
              .number()
              .int()
              .min(0)
              .max(10_000_000),

            recipe: z
              .array(
                z.object({
                  ingredient: z
                    .string()
                    .min(1)
                    .max(60),

                  qty: z
                    .number()
                    .positive()
                    .max(1_000_000),
                }),
              )
              .max(30),
          }),
        )
        .min(1)
        .max(60),
    }),

    // ======================================
    // GUARDAR CONFIGURACIÓN
    // ======================================

    z.object({
      action: z.literal("saveSettings"),

      name: z
        .string()
        .trim()
        .min(1)
        .max(120),

      settings,
    }),

    // ======================================
    // APARTADOS
    // ======================================

    z.object({
      action: z.literal("deliver"),

      reservationId: z
        .string()
        .min(1),

      code: z
        .string()
        .max(8)
        .optional(),

      lastName: z
        .string()
        .max(80)
        .optional(),
    }),

    z.object({
      action: z.literal(
        "cancelReservation",
      ),

      reservationId: z
        .string()
        .min(1),
    }),

    // ======================================
    // CANJE ANTERIOR
    //
    // Conservamos la acción en el esquema
    // para reconocer peticiones antiguas.
    // El servidor bloqueará este camino.
    // ======================================

    z.object({
      action: z.literal("redeem"),

      reservationId: z
        .string()
        .min(1)
        .optional(),

      cardId: z
        .string()
        .min(1)
        .optional(),
    }),
  ],
);

// ==========================================
// OPERACIONES QUE PUEDEN
// RESTAURAR DISPONIBILIDAD
// ==========================================

const MAY_BRING_BACK = new Set([
  "open",
  "soldOut",
  "cancelReservation",
  "reset",
  "restock",
]);

// ==========================================
// RESPUESTA AL AGREGAR SELLOS
// ==========================================

async function stamped(
  slug: string,
  cardId: string,
  stamps: number,
) {
  return Response.json({
    ...ownerView(
      (await store.get(slug))!,
    ),

    stamped: {
      cardId,
      stamps,
    },
  });
}

// ==========================================
// POST /api/stalls/:slug
// ==========================================

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/stalls/[slug]">,
) {
  const { slug } = await ctx.params;

  // Verificar sesión del dueño
  if (!(await isOwner())) {
    return unauthorized();
  }

  // Verificar negocio
  if (!(await store.get(slug))) {
    return Response.json(
      { error: "not_found" },
      { status: 404 },
    );
  }

  // Validar cuerpo
  const parsed = Action.safeParse(
    await request.json().catch(
      () => null,
    ),
  );

  if (!parsed.success) {
    return Response.json(
      { error: "bad_request" },
      { status: 400 },
    );
  }

  const a = parsed.data;

  // ========================================
  // NOTIFICACIONES DE DISPONIBILIDAD
  // ========================================

  if (MAY_BRING_BACK.has(a.action)) {
    after(async () => {
      const s = await store.get(slug);

      if (s) {
        await notifyWaiting(s).catch(
          (e) =>
            console.error(
              "push: notify failed",
              e,
            ),
        );
      }
    });
  }

  // ========================================
  // EJECUTAR ACCIÓN
  // ========================================

  switch (a.action) {
    // ======================================
    // VENTA
    // ======================================

    case "sale": {
      const card = a.customerPhone
        ? phoneCardId(a.customerPhone)
        : null;

      if (a.customerPhone && !card) {
        return Response.json(
          { error: "bad_phone" },
          { status: 400 },
        );
      }

      const r = await store.recordSale(
        slug,
        a.lines,
        a.method,
      );

      if (!r.ok) {
        return Response.json(
          {
            error: r.reason,
            short: r.short ?? [],
          },
          { status: 409 },
        );
      }

      // Agregar sello cuando se proporciona
      // un teléfono válido.
      if (card) {
        return stamped(
          slug,
          card,
          await store.addStamp(
            slug,
            card,
            null,
          ),
        );
      }

      return Response.json(
        ownerView(r.state),
      );
    }

    // ======================================
    // REABASTECER INVENTARIO
    // ======================================

    case "restock": {
      const r = await store.restock(
        slug,
        a.adds,
      );

      if (!r.ok) {
        return Response.json(
          { error: r.reason },
          { status: 409 },
        );
      }

      return Response.json(
        ownerView(r.state),
      );
    }

    // ======================================
    // AGREGAR SELLO
    // ======================================

    case "stamp": {
      const card =
        a.cardId ??
        (a.phone
          ? phoneCardId(a.phone)
          : null);

      if (!card) {
        return Response.json(
          { error: "bad_phone" },
          { status: 400 },
        );
      }

      return stamped(
        slug,
        card,
        await store.addStamp(
          slug,
          card,
          a.name?.trim() || null,
        ),
      );
    }

    // ======================================
    // MARCAR AGOTADO
    // ======================================

    case "soldOut":
      return Response.json(
        ownerView(
          await store.setSoldOut(
            slug,
            a.dishId,
            a.soldOut,
          ),
        ),
      );

    // ======================================
    // ABRIR JORNADA
    // ======================================

    case "open":
      return Response.json(
        ownerView(
          await store.open(
            slug,
            a.counts,
          ),
        ),
      );

    // ======================================
    // CERRAR JORNADA
    // ======================================

    case "close": {
      const {
        state,
        cashUp,
      } = await store.close(slug);

      return Response.json({
        ...ownerView(state),
        closedCashUp: cashUp,
      });
    }

    // ======================================
    // GUARDAR MENÚ
    // ======================================

    case "saveMenu": {
      const s = (
        await store.get(slug)
      )!;

      const keys = new Set(
        a.ingredients.map(
          (i) => i.key,
        ),
      );

      const names = new Set(
        a.ingredients.map(
          (i) =>
            i.name.toLowerCase(),
        ),
      );

      // Evitar ingredientes duplicados
      if (
        names.size !==
        a.ingredients.length
      ) {
        return Response.json(
          {
            error:
              "duplicate_ingredient",
          },
          { status: 400 },
        );
      }

      // Validar recetas
      if (
        a.dishes.some(
          (d) =>
            d.recipe.some(
              (r) =>
                !keys.has(
                  r.ingredient,
                ),
            ),
        )
      ) {
        return Response.json(
          { error: "bad_recipe" },
          { status: 400 },
        );
      }

      // Platillos que permanecerán
      const kept = new Set(
        a.dishes.flatMap(
          (d) =>
            d.id
              ? [d.id]
              : [],
        ),
      );

      // No eliminar platillos con
      // apartados activos.
      const held =
        s.reservations.filter(
          (r) =>
            isActive(r) &&
            r.lines.some(
              (l) =>
                !kept.has(
                  l.dishId,
                ),
            ),
        );

      if (held.length) {
        return Response.json(
          { error: "dish_reserved" },
          { status: 409 },
        );
      }

      // Guardar menú
      const next =
        await store.saveMenu(
          slug,
          {
            ingredients:
              a.ingredients,

            dishes:
              a.dishes.map(
                (d) => ({
                  ...d,

                  nameEn:
                    d.nameEn ||
                    d.nameEs,

                  // Mantener imagen anterior
                  // cuando no se envía otra.
                  imageUrl:
                    d.imageUrl ===
                    undefined
                      ? (
                          s.dishes.find(
                            (existing) =>
                              existing.id ===
                              d.id,
                          )?.imageUrl ??
                          null
                        )
                      : d.imageUrl,
                }),
              ),
          },
        );

      return Response.json(
        ownerView(next),
      );
    }

    // ======================================
    // GUARDAR CONFIGURACIÓN
    // ======================================

    case "saveSettings": {
      if (!store.saveSettings) {
        return Response.json(
          {
            error:
              "settings_not_supported",
          },
          { status: 501 },
        );
      }

      const next =
        await store.saveSettings(
          slug,
          {
            name: a.name,
            settings: a.settings,
          },
        );

      return Response.json(
        ownerView(next),
      );
    }

    // ======================================
    // REINICIAR DEMOSTRACIÓN
    // ======================================

    case "reset":
      if (!demoMode()) {
        return Response.json(
          { error: "demo_off" },
          { status: 403 },
        );
      }

      return Response.json(
        ownerView(
          await store.reset(slug),
        ),
      );

    // ======================================
    // ENTREGAR O CANCELAR APARTADO
    //
    // Esta operación conserva el flujo
    // original de PayPal y códigos de
    // entrega de los apartados.
    // ======================================

    case "deliver":
    case "cancelReservation": {
      try {
        if (
          a.action === "deliver"
        ) {
          const r = await deliver(
            slug,
            a.reservationId,
            {
              code: a.code,
              lastName: a.lastName,
            },
          );

          if (r !== "ok") {
            return Response.json(
              { error: r },
              {
                status:
                  r === "wrong_code" ||
                  r === "wrong_last_name"
                    ? 403
                    : 409,
              },
            );
          }
        } else {
          await cancel(
            slug,
            a.reservationId,
          );
        }
      } catch (e) {
        console.error(
          `${a.action} failed`,
          e,
        );

        return Response.json(
          {
            error:
              e instanceof PayPalError
                ? "paypal"
                : "failed",
          },
          { status: 502 },
        );
      }

      return Response.json(
        ownerView(
          (await store.get(slug))!,
        ),
      );
    }

    // ======================================
    // CANJE DE RECOMPENSAS
    //
    // IMPORTANTE:
    // El sistema antiguo canjeaba
    // recompensas sin verificar PIN.
    //
    // A partir de ahora rechazamos
    // esta operación para que el cliente
    // utilice la ruta independiente de
    // canje mediante PIN.
    //
    // No descontamos sellos aquí.
    // No descontamos inventario aquí.
    // ======================================

    case "redeem": {
      return Response.json(
        {
          error: "pin_required",
          message:
            "Para canjear una recompensa es necesario validar el PIN del negocio.",
        },
        {
          status: 409,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }
  }
}
