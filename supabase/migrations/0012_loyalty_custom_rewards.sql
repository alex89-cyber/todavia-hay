
-- ¿TODAVÍA HAY?
-- Recompensas personalizadas
--
-- REQUIERE que las migraciones 0010 y 0011
-- estén instaladas correctamente.
--
-- No borra tarjetas ni premios existentes.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS loyalty_reward_text
    text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS loyalty_reward_conditions
    text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS loyalty_stamp_emoji
    text NOT NULL DEFAULT '⭐',
  ADD COLUMN IF NOT EXISTS loyalty_reward_emoji
    text NOT NULL DEFAULT '🎁',
  ADD COLUMN IF NOT EXISTS loyalty_stamp_color
    text NOT NULL DEFAULT '#B4230B';

-- Validación del color hexadecimal.
ALTER TABLE public.businesses
  ADD CONSTRAINT loyalty_stamp_color_hex
  CHECK (
    loyalty_stamp_color ~ '^#[0-9a-fA-F]{6}$'
  );

-- Guardado atómico: reglas anteriores + diseño nuevo.
-- Si falla alguna operación, ninguna se confirma.

CREATE OR REPLACE FUNCTION
public.save_loyalty_custom_config(
  p_business uuid,
  p_enabled boolean,
  p_stamps_per_reward integer,
  p_reward_dish uuid,
  p_period_kind text,
  p_period_days integer,
  p_expiry_action text,
  p_reward_valid_days integer,
  p_reward_text text,
  p_reward_conditions text,
  p_stamp_emoji text,
  p_reward_emoji text,
  p_stamp_color text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF length(trim(coalesce(p_reward_text, ''))) > 150
     OR length(coalesce(p_reward_conditions, '')) > 500
     OR length(coalesce(p_stamp_emoji, '')) > 20
     OR length(coalesce(p_reward_emoji, '')) > 20
     OR p_stamp_color !~ '^#[0-9a-fA-F]{6}$'
  THEN
    RAISE EXCEPTION 'invalid_loyalty_customization';
  END IF;

  -- Mantener la lógica original que administra
  -- las reglas y los sellos históricos.
  PERFORM public.save_loyalty_config(
    p_business => p_business,
    p_enabled => p_enabled,
    p_stamps_per_reward => p_stamps_per_reward,
    p_reward_dish => p_reward_dish,
    p_period_kind => p_period_kind,
    p_period_days => p_period_days,
    p_expiry_action => p_expiry_action,
    p_reward_valid_days => p_reward_valid_days
  );

  UPDATE public.businesses
  SET
    loyalty_reward_text =
      trim(coalesce(p_reward_text, '')),
    loyalty_reward_conditions =
      coalesce(p_reward_conditions, ''),
    loyalty_stamp_emoji =
      coalesce(nullif(p_stamp_emoji, ''), '⭐'),
    loyalty_reward_emoji =
      coalesce(nullif(p_reward_emoji, ''), '🎁'),
    loyalty_stamp_color = p_stamp_color
  WHERE id = p_business;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'business_not_found';
  END IF;
END;
$$;

-- Solo la API del servidor debe ejecutar
-- esta función mediante la service role key.
REVOKE ALL ON FUNCTION
public.save_loyalty_custom_config(
  uuid, boolean, integer, uuid, text,
  integer, text, integer, text, text,
  text, text, text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.save_loyalty_custom_config(
  uuid, boolean, integer, uuid, text,
  integer, text, integer, text, text,
  text, text, text
)
TO service_role;
