
-- ¿TODAVÍA HAY?
-- PIN PRIVADO PARA CANJEAR RECOMPENSAS
--
-- No modifica add_stamp, redeem_reward,
-- deliver_reservation, PayPal ni inventario.
--
-- Requiere:
-- businesses(id, stamps_per_reward,
--   loyalty_reward_text)
-- stamp_cards(business_id, payer_id,
--   stamps, rewards_redeemed)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS
public.reward_pin_state (
  business_id uuid PRIMARY KEY
    REFERENCES public.businesses(id)
    ON DELETE CASCADE,

  nonce uuid NOT NULL
    DEFAULT gen_random_uuid(),

  failed_attempts integer NOT NULL DEFAULT 0,

  locked_until timestamptz,

  updated_at timestamptz NOT NULL
    DEFAULT now()
);

CREATE TABLE IF NOT EXISTS
public.reward_pin_redemptions (
  id uuid PRIMARY KEY
    DEFAULT gen_random_uuid(),

  business_id uuid NOT NULL
    REFERENCES public.businesses(id),

  payer_id text NOT NULL,

  stamps_spent integer NOT NULL
    CHECK (stamps_spent > 0),

  reward_description text NOT NULL,

  redeemed_at timestamptz NOT NULL
    DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
reward_pin_redemptions_business_idx
ON public.reward_pin_redemptions (
  business_id,
  redeemed_at DESC
);

-- Crea un estado inicial para los
-- negocios que ya existen.
INSERT INTO public.reward_pin_state (
  business_id
)
SELECT id
FROM public.businesses
ON CONFLICT (business_id) DO NOTHING;

ALTER TABLE public.reward_pin_state
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reward_pin_redemptions
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON public.reward_pin_state
FROM PUBLIC, anon, authenticated;

REVOKE ALL
ON public.reward_pin_redemptions
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
ON public.reward_pin_state
TO service_role;

GRANT SELECT, INSERT
ON public.reward_pin_redemptions
TO service_role;

-- Esta función se llama únicamente
-- desde nuestra API del servidor.
-- La API verifica el PIN con HMAC.
-- La base aplica los intentos, el saldo
-- y la rotación en una sola transacción.

CREATE OR REPLACE FUNCTION
public.redeem_stamps_with_pin(
  p_business uuid,
  p_card text,
  p_expected_nonce uuid,
  p_next_nonce uuid,
  p_pin_matches boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pin public.reward_pin_state%ROWTYPE;
  v_required integer;
  v_reward text;
  v_balance integer;
BEGIN
  SELECT *
  INTO v_pin
  FROM public.reward_pin_state
  WHERE business_id = p_business
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'pin_not_ready'
    );
  END IF;

  IF v_pin.locked_until IS NOT NULL
     AND v_pin.locked_until > now() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'pin_locked'
    );
  END IF;

  IF v_pin.nonce <> p_expected_nonce THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'pin_changed'
    );
  END IF;

  IF p_pin_matches IS DISTINCT FROM true THEN
    UPDATE public.reward_pin_state
    SET
      failed_attempts =
        CASE
          WHEN locked_until IS NOT NULL
               AND locked_until <= now()
            THEN 1
          ELSE failed_attempts + 1
        END,
      locked_until =
        CASE
          WHEN (
            CASE
              WHEN locked_until IS NOT NULL
                   AND locked_until <= now()
                THEN 1
              ELSE failed_attempts + 1
            END
          ) >= 5
            THEN now() + interval '15 minutes'
          ELSE NULL
        END,
      updated_at = now()
    WHERE business_id = p_business;

    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_pin'
    );
  END IF;

  SELECT
    stamps_per_reward,
    coalesce(
      nullif(trim(loyalty_reward_text), ''),
      'Recompensa'
    )
  INTO v_required, v_reward
  FROM public.businesses
  WHERE id = p_business;

  IF v_required IS NULL
     OR v_required < 1 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_reward'
    );
  END IF;

  -- Descontar exactamente los sellos
  -- necesarios, conservando el sobrante.
  UPDATE public.stamp_cards
  SET
    stamps = stamps - v_required,
    rewards_redeemed =
      rewards_redeemed + 1,
    updated_at = now()
  WHERE business_id = p_business
    AND payer_id = p_card
    AND stamps >= v_required
  RETURNING stamps INTO v_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'not_enough_stamps'
    );
  END IF;

  INSERT INTO public.reward_pin_redemptions (
    business_id,
    payer_id,
    stamps_spent,
    reward_description
  )
  VALUES (
    p_business,
    p_card,
    v_required,
    v_reward
  );

  -- PIN NUEVO: se confirma en la
  -- misma transacción que el canje.
  UPDATE public.reward_pin_state
  SET
    nonce = p_next_nonce,
    failed_attempts = 0,
    locked_until = NULL,
    updated_at = now()
  WHERE business_id = p_business;

  RETURN jsonb_build_object(
    'ok', true,
    'stampsRemaining', v_balance,
    'reward', v_reward
  );
END;
$$;

REVOKE ALL ON FUNCTION
public.redeem_stamps_with_pin(
  uuid, text, uuid, uuid, boolean
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.redeem_stamps_with_pin(
  uuid, text, uuid, uuid, boolean
)
TO service_role;
