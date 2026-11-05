
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  isOwner,
  unauthorized,
} from "@/lib/owner-auth";

import {
  validateLoyaltyConfig,
} from "@/lib/loyalty-config";

import type {
  LoyaltyConfigInput,
  LoyaltyCardStatus,
} from "@/lib/store/types";

type Context = {
  params: Promise<{ slug: string }>;
};

type ExtendedConfig = LoyaltyConfigInput & {
  rewardText: string;
  rewardConditions: string;
  stampEmoji: string;
  rewardEmoji: string;
  stampColor: string;
};

type BusinessRow = {
  id: string;
  slug: string;
  timezone: string;
  loyalty_enabled: boolean;
  stamps_per_reward: number;
  reward_dish_id: string | null;
  loyalty_period_kind:
    LoyaltyConfigInput["periodKind"];
  loyalty_period_days: number;
  loyalty_expiry_action:
    LoyaltyConfigInput["expiryAction"];
  loyalty_reward_valid_days: number | null;
  loyalty_reward_text: string | null;
  loyalty_reward_conditions: string | null;
  loyalty_stamp_emoji: string | null;
  loyalty_reward_emoji: string | null;
  loyalty_stamp_color: string | null;
};

const headers = {
  "Cache-Control": "no-store",
};

const saveSchema = z.object({
  action: z.literal("saveConfig"),
  enabled: z.boolean(),
  stampsPerReward: z.number().int().min(1).max(100),
  rewardDishId: z.string().uuid().nullable(),
  periodKind: z.enum([
    "none",
    "calendar_week",
    "calendar_month",
    "rolling_days",
  ]),
  periodDays: z.number().int().min(1).max(365),
  expiryAction: z.enum(["reset", "keep"]),
  rewardValidDays: z.number().int().min(1).max(365).nullable(),

  rewardText: z.string().trim().max(150),
  rewardConditions: z.string().max(500),
  stampEmoji: z.string().min(1).max(20),
  rewardEmoji: z.string().min(1).max(20),
  stampColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const cardSchema = z.object({
  action: z.literal("getCard"),
  cardId: z.string().trim().min(1).max(100),
});

const actionSchema = z.discriminatedUnion("action", [
  saveSchema,
  cardSchema,
]);

function database() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("supabase_not_configured");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function apiError(
  error: string,
  status: number,
  details?: string,
) {
  return Response.json(
    {
      error,
      ...(details ? { details } : {}),
    },
    { status, headers },
  );
}

async function getBusiness(
  slug: string,
): Promise<BusinessRow | null> {
  const { data, error } = await database()
    .from("businesses")
    .select(`
      id,
      slug,
      timezone,
      loyalty_enabled,
      stamps_per_reward,
      reward_dish_id,
      loyalty_period_kind,
      loyalty_period_days,
      loyalty_expiry_action,
      loyalty_reward_valid_days,
      loyalty_reward_text,
      loyalty_reward_conditions,
      loyalty_stamp_emoji,
      loyalty_reward_emoji,
      loyalty_stamp_color
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    const err = new Error(error.message);
    err.name = error.code ?? "database_error";
    throw err;
  }

  return data as BusinessRow | null;
}

function publicConfig(
  business: BusinessRow,
): ExtendedConfig {
  return {
    enabled: business.loyalty_enabled,
    stampsPerReward: business.stamps_per_reward,
    rewardDishId: business.reward_dish_id,
    periodKind: business.loyalty_period_kind,
    periodDays: business.loyalty_period_days,
    expiryAction: business.loyalty_expiry_action,
    rewardValidDays: business.loyalty_reward_valid_days,

    rewardText:
      business.loyalty_reward_text ?? "",
    rewardConditions:
      business.loyalty_reward_conditions ?? "",
    stampEmoji:
      business.loyalty_stamp_emoji || "⭐",
    rewardEmoji:
      business.loyalty_reward_emoji || "🎁",
    stampColor:
      business.loyalty_stamp_color || "#B4230B",
  };
}

function failure(
  operation: string,
  cause: unknown,
) {
  console.error(
    `Loyalty ${operation} failed:`,
    cause,
  );

  // El detalle solo se devuelve a la sesión
  // autorizada del dueño, nunca al público.
  const details =
    cause instanceof Error
      ? `${cause.name}: ${cause.message}`
      : "Error desconocido de base de datos";

  return apiError(
    "loyalty_operation_failed",
    500,
    details,
  );
}

// ==========================================
// GET: DATOS PARA EL EDITOR
// ==========================================

export async function GET(
  _request: Request,
  ctx: Context,
) {
  await connection();

  if (!(await isOwner((await ctx.params).slug))) {
    return unauthorized();
  }

  try {
    const { slug } = await ctx.params;
    const business = await getBusiness(slug);

    if (!business) {
      return apiError("not_found", 404);
    }

    // El editor utiliza texto libre;
    // no necesita cargar el catálogo.
    return Response.json(
      {
        slug: business.slug,
        timezone: business.timezone,
        config: publicConfig(business),
      },
      { headers },
    );
  } catch (cause) {
    return failure("load", cause);
  }
}

// ==========================================
// POST: GUARDAR REGLAS O CONSULTAR TARJETA
// ==========================================

export async function POST(
  request: Request,
  ctx: Context,
) {
  if (!(await isOwner((await ctx.params).slug))) {
    return unauthorized();
  }

  const body = await request
    .json()
    .catch(() => null);

  const parsed = actionSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      "invalid_request",
      400,
      parsed.error.issues
        .map((issue) =>
          `${issue.path.join(".")}: ${issue.message}`,
        )
        .join("; "),
    );
  }

  try {
    const { slug } = await ctx.params;
    const business = await getBusiness(slug);

    if (!business) {
      return apiError("not_found", 404);
    }

    const db = database();
    const action = parsed.data;

    // --------------------------------------
    // CONSULTAR TARJETA
    // --------------------------------------

    if (action.action === "getCard") {
      const { data, error } = await db.rpc(
        "get_loyalty_card",
        {
          p_business: business.id,
          p_card: action.cardId,
        },
      );

      if (error) {
        const err = new Error(error.message);
        err.name = error.code ?? "rpc_error";
        throw err;
      }

      return Response.json(
        {
          card: data as LoyaltyCardStatus,
          timezone: business.timezone,
        },
        { headers },
      );
    }

    // --------------------------------------
    // VALIDACIÓN DE REGLAS
    // --------------------------------------

    const baseConfig: LoyaltyConfigInput = {
      enabled: action.enabled,
      stampsPerReward: action.stampsPerReward,
      rewardDishId: action.rewardDishId,
      periodKind: action.periodKind,
      periodDays: action.periodDays,
      expiryAction: action.expiryAction,
      rewardValidDays: action.rewardValidDays,
    };

    const validation =
      validateLoyaltyConfig(baseConfig);

    if (!validation.ok) {
      return apiError(
        validation.reason,
        400,
        validation.message,
      );
    }

    if (
      action.enabled &&
      action.rewardText.trim().length < 2
    ) {
      return apiError(
        "reward_text_required",
        400,
        "Escribe el nombre del premio.",
      );
    }

    // --------------------------------------
    // GUARDADO ATÓMICO EN SUPABASE
    // --------------------------------------
    //
    // La migración 0012 crea esta función.
    // Dentro se llama a la función original
    // save_loyalty_config para no alterar
    // la administración histórica de sellos.

    const { error } = await db.rpc(
      "save_loyalty_custom_config",
      {
        p_business: business.id,
        p_enabled: action.enabled,
        p_stamps_per_reward:
          action.stampsPerReward,
        p_reward_dish: action.rewardDishId,
        p_period_kind: action.periodKind,
        p_period_days: action.periodDays,
        p_expiry_action: action.expiryAction,
        p_reward_valid_days:
          action.rewardValidDays,

        p_reward_text: action.rewardText.trim(),
        p_reward_conditions:
          action.rewardConditions.trim(),
        p_stamp_emoji: action.stampEmoji,
        p_reward_emoji: action.rewardEmoji,
        p_stamp_color: action.stampColor,
      },
    );

    if (error) {
      const err = new Error(error.message);
      err.name = error.code ?? "rpc_error";
      throw err;
    }

    const updated = await getBusiness(slug);

    if (!updated) {
      return apiError("not_found", 404);
    }

    return Response.json(
      {
        ok: true,
        config: publicConfig(updated),
      },
      { headers },
    );
  } catch (cause) {
    return failure("save", cause);
  }
}
