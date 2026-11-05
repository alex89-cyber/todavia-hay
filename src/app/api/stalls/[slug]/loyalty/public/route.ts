
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

const NO_STORE = {
  "Cache-Control": "no-store",
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  await connection();

  const { slug } = await context.params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(
      "Public loyalty: Supabase is not configured.",
    );

    return Response.json(
      { error: "service_unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }

  try {
    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase
      .from("businesses")
      .select(`
        loyalty_enabled,
        stamps_per_reward,
        loyalty_reward_text,
        loyalty_reward_conditions,
        loyalty_stamp_emoji,
        loyalty_reward_emoji,
        loyalty_stamp_color
      `)
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error(
        "Public loyalty database error:",
        error.message,
      );

      return Response.json(
        { error: "loyalty_unavailable" },
        { status: 503, headers: NO_STORE },
      );
    }

    if (!data) {
      return Response.json(
        { error: "not_found" },
        { status: 404, headers: NO_STORE },
      );
    }

    return Response.json(
      {
        enabled: data.loyalty_enabled !== false,
        stampsPerReward: data.stamps_per_reward,
        rewardText: data.loyalty_reward_text ?? "",
        rewardConditions:
          data.loyalty_reward_conditions ?? "",
        stampEmoji: data.loyalty_stamp_emoji || "⭐",
        rewardEmoji: data.loyalty_reward_emoji || "🎁",
        stampColor: data.loyalty_stamp_color || "#B4230B",
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error(
      "Public loyalty request failed:",
      error,
    );

    return Response.json(
      { error: "loyalty_unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }
}
