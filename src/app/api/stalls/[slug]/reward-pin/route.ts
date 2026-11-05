
import { connection } from "next/server";
import { randomUUID } from "node:crypto";
import { isOwner } from "@/lib/owner-auth";
import {
  findRewardBusiness,
  pinFor,
  rewardDatabase,
} from "@/lib/reward-pin";

type Context = {
  params: Promise<{ slug: string }>;
};

const noCache = {
  "Cache-Control": "no-store",
};

function failure(
  code: string,
  status: number,
  detail?: string,
) {
  return Response.json(
    {
      error: code,
      ...(process.env.NODE_ENV === "development"
        ? { detail }
        : {}),
    },
    { status, headers: noCache },
  );
}

async function stateFor(businessId: string) {
  const db = rewardDatabase();

  // Crear el PIN solamente si no existe.
  const { error: insertError } = await db
    .from("reward_pin_state")
    .upsert(
      {
        business_id: businessId,
      },
      {
        onConflict: "business_id",
        ignoreDuplicates: true,
      },
    );

  if (insertError) {
    throw new Error(
      `reward_pin_state: ${insertError.message}`,
    );
  }

  const { data, error } = await db
    .from("reward_pin_state")
    .select("nonce")
    .eq("business_id", businessId)
    .single();

  if (error) {
    throw new Error(
      `read_reward_pin: ${error.message}`,
    );
  }

  return data;
}

export async function GET(
  _request: Request,
  context: Context,
) {
  await connection();

  if (!(await isOwner())) {
    return failure("unauthorized", 401);
  }

  try {
    const { slug } = await context.params;
    const business = await findRewardBusiness(slug);

    if (!business) {
      return failure("business_not_found", 404);
    }

    const state = await stateFor(business.id);

    return Response.json(
      {
        pin: pinFor(business.id, state.nonce),
      },
      { headers: noCache },
    );
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : "Unknown error";

    console.error(
      "[reward-pin] GET failed:",
      detail,
    );

    return failure(
      "pin_unavailable",
      500,
      detail,
    );
  }
}

export async function POST(
  _request: Request,
  context: Context,
) {
  if (!(await isOwner())) {
    return failure("unauthorized", 401);
  }

  try {
    const { slug } = await context.params;
    const business = await findRewardBusiness(slug);

    if (!business) {
      return failure("business_not_found", 404);
    }

    const current = await stateFor(business.id);
    const db = rewardDatabase();
    const nextNonce = randomUUID();

    // Evitar sobrescribir un PIN que haya
    // cambiado mientras se procesaba la petición.
    const { data, error } = await db
      .from("reward_pin_state")
      .update({
        nonce: nextNonce,
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", business.id)
      .eq("nonce", current.nonce)
      .select("nonce")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return failure(
        "pin_changed",
        409,
        "The PIN changed during this operation.",
      );
    }

    return Response.json(
      {
        pin: pinFor(business.id, data.nonce),
        regenerated: true,
      },
      { headers: noCache },
    );
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : "Unknown error";

    console.error(
      "[reward-pin] POST failed:",
      detail,
    );

    return failure(
      "pin_unavailable",
      500,
      detail,
    );
  }
}
