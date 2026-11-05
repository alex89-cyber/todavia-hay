
import { cookies } from "next/headers";

import { PAYER_COOKIE } from "@/lib/stall";

import {
  createNonce,
  findRewardBusiness,
  pinFor,
  rewardDatabase,
  verifyPin,
} from "@/lib/reward-pin";

type Context = {
  params: Promise<{ slug: string }>;
};

const headers = {
  "Cache-Control": "no-store",
};

export async function POST(
  request: Request,
  context: Context,
) {
  try {
    const { slug } = await context.params;

    const body: unknown = await request
      .json()
      .catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      !("pin" in body) ||
      typeof body.pin !== "string" ||
      !/^\d{6}$/.test(body.pin)
    ) {
      return Response.json(
        { error: "invalid_pin_format" },
        { status: 400, headers },
      );
    }

    const cookieStore = await cookies();

    const card =
      cookieStore.get(PAYER_COOKIE)?.value;

    if (!card || card.length > 200) {
      return Response.json(
        { error: "card_not_identified" },
        { status: 401, headers },
      );
    }

    const business =
      await findRewardBusiness(slug);

    if (!business) {
      return Response.json(
        { error: "not_found" },
        { status: 404, headers },
      );
    }

    const db = rewardDatabase();

    const { data: state, error: stateError } =
      await db
        .from("reward_pin_state")
        .select("nonce")
        .eq("business_id", business.id)
        .maybeSingle();

    if (stateError) {
      throw new Error(stateError.message);
    }

    if (!state) {
      return Response.json(
        { error: "pin_not_ready" },
        { status: 409, headers },
      );
    }

    const correctPin = pinFor(
      business.id,
      state.nonce,
    );

    const matches = verifyPin(
      body.pin,
      correctPin,
    );

    const { data, error } = await db.rpc(
      "redeem_stamps_with_pin",
      {
        p_business: business.id,
        p_card: card,
        p_expected_nonce: state.nonce,
        p_next_nonce: createNonce(),
        p_pin_matches: matches,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.ok) {
      const code =
        typeof data?.error === "string"
          ? data.error
          : "redeem_failed";

      return Response.json(
        { error: code },
        {
          status:
            code === "invalid_pin"
              ? 400
              : code === "pin_locked"
                ? 429
                : 409,
          headers,
        },
      );
    }

    return Response.json(
      {
        ok: true,
        stampsRemaining:
          data.stampsRemaining,
        reward: data.reward,
      },
      { headers },
    );
  } catch (error) {
    console.error(
      "Reward PIN redemption:",
      error,
    );

    return Response.json(
      { error: "redeem_failed" },
      { status: 500, headers },
    );
  }
}
