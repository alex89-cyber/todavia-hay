
-- ============================================================
-- ¿TODAVÍA HAY?
-- 0011_loyalty_functions.sql
--
-- Reglas reales de recompensas por negocio.
--
-- REQUIERE:
-- 0010_loyalty_customization.sql
--
-- Conserva:
-- - Sellos existentes
-- - Ventas y reservas
-- - Inventario
-- - Pagos con PayPal
-- ============================================================


-- ============================================================
-- 1. CALCULAR EL PERIODO DEL NEGOCIO
-- ============================================================

create or replace function public.loyalty_period_bounds(
  p_business uuid,
  p_at timestamptz default now()
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business record;
  v_local timestamp;
  v_start timestamp;
  v_end timestamp;
  v_weekday integer;
begin
  select
    timezone,
    loyalty_period_kind,
    loyalty_period_days
  into v_business
  from businesses
  where id = p_business;

  if not found then
    raise exception 'unknown_business';
  end if;

  if v_business.loyalty_period_kind = 'none' then
    starts_at := null;
    ends_at := null;
    return next;
    return;
  end if;

  if v_business.loyalty_period_kind = 'rolling_days' then
    starts_at := p_at;
    ends_at :=
      p_at
      + make_interval(
          days => v_business.loyalty_period_days
        );
    return next;
    return;
  end if;

  v_local := p_at at time zone v_business.timezone;

  if v_business.loyalty_period_kind =
     'calendar_month' then

    v_start := date_trunc('month', v_local);
    v_end := v_start + interval '1 month';

  elsif v_business.loyalty_period_kind =
        'calendar_week' then

    v_weekday := extract(
      isodow from v_local
    )::integer;

    v_start :=
      date_trunc('day', v_local)
      - make_interval(days => v_weekday - 1);

    v_end := v_start + interval '7 days';

  else
    raise exception 'invalid_loyalty_period';
  end if;

  starts_at :=
    v_start at time zone v_business.timezone;

  ends_at :=
    v_end at time zone v_business.timezone;

  return next;
end;
$$;


-- ============================================================
-- 2. SINCRONIZAR EL PERIODO DE UNA TARJETA
-- ============================================================

create or replace function public.loyalty_sync_card(
  p_business uuid,
  p_card text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business record;
  v_card record;
  v_bounds record;
  v_balance integer;
begin
  if not can_manage(p_business) then
    raise exception 'forbidden';
  end if;

  select
    loyalty_period_kind,
    loyalty_expiry_action,
    loyalty_rules_updated_at
  into v_business
  from businesses
  where id = p_business;

  if not found then
    raise exception 'unknown_business';
  end if;

  select *
  into v_card
  from stamp_cards
  where business_id = p_business
    and payer_id = p_card
  for update;

  if not found then
    return 0;
  end if;

  v_balance := v_card.stamps;

  if v_business.loyalty_period_kind = 'none' then

    update stamp_cards
    set
      period_started_at = null,
      period_ends_at = null,
      period_rules_updated_at =
        v_business.loyalty_rules_updated_at
    where business_id = p_business
      and payer_id = p_card;

    return v_balance;
  end if;

  -- Si el dueño cambió las reglas, conservamos
  -- el saldo y comenzamos un periodo compatible.
  if
    v_card.period_rules_updated_at is null
    or v_card.period_rules_updated_at
       is distinct from
       v_business.loyalty_rules_updated_at
  then

    select *
    into v_bounds
    from loyalty_period_bounds(
      p_business,
      now()
    );

    update stamp_cards
    set
      period_started_at = v_bounds.starts_at,
      period_ends_at = v_bounds.ends_at,
      period_rules_updated_at =
        v_business.loyalty_rules_updated_at
    where business_id = p_business
      and payer_id = p_card;

    return v_balance;
  end if;

  if
    v_card.period_ends_at is not null
    and now() >= v_card.period_ends_at
  then

    if v_business.loyalty_expiry_action = 'reset'
       and v_balance > 0 then

      update stamp_cards
      set
        stamps = 0,
        updated_at = now()
      where business_id = p_business
        and payer_id = p_card;

      insert into stamp_events (
        business_id,
        payer_id,
        event_type,
        stamps_delta,
        balance_after,
        description
      )
      values (
        p_business,
        p_card,
        'expired',
        -v_balance,
        0,
        'Vencimiento de sellos incompletos'
      );

      v_balance := 0;

    end if;

    select *
    into v_bounds
    from loyalty_period_bounds(
      p_business,
      now()
    );

    update stamp_cards
    set
      period_started_at = v_bounds.starts_at,
      period_ends_at = v_bounds.ends_at,
      period_rules_updated_at =
        v_business.loyalty_rules_updated_at
    where business_id = p_business
      and payer_id = p_card;

  end if;

  return v_balance;
end;
$$;


-- ============================================================
-- 3. CONFIGURAR RECOMPENSAS POR NEGOCIO
-- ============================================================

create or replace function public.save_loyalty_config(
  p_business uuid,
  p_enabled boolean,
  p_stamps_per_reward integer,
  p_reward_dish uuid,
  p_period_kind text,
  p_period_days integer,
  p_expiry_action text,
  p_reward_valid_days integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can_manage(p_business) then
    raise exception 'forbidden';
  end if;

  if p_stamps_per_reward not between 1 and 100 then
    raise exception 'invalid_stamps_per_reward';
  end if;

  if p_period_kind not in (
    'none',
    'calendar_week',
    'calendar_month',
    'rolling_days'
  ) then
    raise exception 'invalid_period';
  end if;

  if p_period_days not between 1 and 365 then
    raise exception 'invalid_period_days';
  end if;

  if p_expiry_action not in ('reset', 'keep') then
    raise exception 'invalid_expiry_action';
  end if;

  if
    p_reward_valid_days is not null
    and p_reward_valid_days not between 1 and 365
  then
    raise exception 'invalid_reward_validity';
  end if;

  if
    p_reward_dish is not null
    and not exists (
      select 1
      from dishes
      where id = p_reward_dish
        and business_id = p_business
    )
  then
    raise exception 'reward_not_found';
  end if;

  -- Los sellos de los clientes NO se modifican.
  update businesses
  set
    loyalty_enabled = p_enabled,
    stamps_per_reward = p_stamps_per_reward,
    reward_dish_id = p_reward_dish,
    loyalty_period_kind = p_period_kind,
    loyalty_period_days = p_period_days,
    loyalty_expiry_action = p_expiry_action,
    loyalty_reward_valid_days = p_reward_valid_days,
    loyalty_rules_updated_at = now(),
    updated_at = now()
  where id = p_business;
end;
$$;


-- ============================================================
-- 4. AGREGAR SELLOS Y REGISTRAR PREMIOS
-- ============================================================

create or replace function public.add_stamp(
  p_business uuid,
  p_card text,
  p_label text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business record;
  v_balance integer;
  v_bounds record;
  v_reward_expires timestamptz;
begin
  if not can_manage(p_business) then
    raise exception 'forbidden';
  end if;

  select *
  into v_business
  from businesses
  where id = p_business
  for share;

  if not found then
    raise exception 'unknown_business';
  end if;

  if not v_business.loyalty_enabled then
    -- Desactivado: no sumar sellos nuevos.
    select coalesce(stamps, 0)
    into v_balance
    from stamp_cards
    where business_id = p_business
      and payer_id = p_card;

    return coalesce(v_balance, 0);
  end if;

  insert into stamp_cards (
    business_id,
    payer_id,
    stamps,
    label
  )
  values (
    p_business,
    p_card,
    0,
    nullif(p_label, '')
  )
  on conflict (business_id, payer_id)
  do update set
    label = coalesce(
      excluded.label,
      stamp_cards.label
    );

  perform loyalty_sync_card(
    p_business,
    p_card
  );

  select *
  into v_bounds
  from loyalty_period_bounds(
    p_business,
    now()
  );

  -- Para rolling_days se mantiene el primer
  -- periodo que ya tenga la tarjeta.
  update stamp_cards
  set
    period_started_at =
      coalesce(
        period_started_at,
        v_bounds.starts_at
      ),
    period_ends_at =
      coalesce(
        period_ends_at,
        v_bounds.ends_at
      ),
    stamps = stamps + 1,
    updated_at = now()
  where business_id = p_business
    and payer_id = p_card
  returning stamps into v_balance;

  insert into stamp_events (
    business_id,
    payer_id,
    event_type,
    stamps_delta,
    balance_after,
    description
  )
  values (
    p_business,
    p_card,
    'earned',
    1,
    v_balance,
    'Sello obtenido por compra'
  );

  -- Cada tarjeta completada se convierte en
  -- un premio registrado.
  --
  -- Los sellos restantes permanecen
  -- disponibles para seguir acumulando.

  while v_balance >= v_business.stamps_per_reward loop

    v_reward_expires :=
      case
        when v_business.loyalty_reward_valid_days
             is null
        then null
        else
          now() +
          make_interval(
            days =>
              v_business.loyalty_reward_valid_days
          )
      end;

    insert into loyalty_rewards (
      business_id,
      payer_id,
      reward_dish_id,
      stamps_required,
      earned_at,
      expires_at
    )
    values (
      p_business,
      p_card,
      v_business.reward_dish_id,
      v_business.stamps_per_reward,
      now(),
      v_reward_expires
    );

    v_balance :=
      v_balance -
      v_business.stamps_per_reward;

    update stamp_cards
    set
      stamps = v_balance,
      updated_at = now()
    where business_id = p_business
      and payer_id = p_card;

    insert into stamp_events (
      business_id,
      payer_id,
      event_type,
      stamps_delta,
      balance_after,
      description
    )
    values (
      p_business,
      p_card,
      'redeemed',
      -v_business.stamps_per_reward,
      v_balance,
      'Sellos convertidos en premio pendiente de canje'
    );

  end loop;

  update businesses
  set updated_at = now()
  where id = p_business;

  return v_balance;
end;
$$;


-- ============================================================
-- 5. CONSULTAR EL PROGRESO DEL CLIENTE
-- ============================================================

create or replace function public.get_loyalty_card(
  p_business uuid,
  p_card text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business record;
  v_card record;
  v_rewards integer;
  v_next_expiration timestamptz;
begin
  if not can_manage(p_business) then
    raise exception 'forbidden';
  end if;

  perform loyalty_sync_card(
    p_business,
    p_card
  );

  select *
  into v_business
  from businesses
  where id = p_business;

  select *
  into v_card
  from stamp_cards
  where business_id = p_business
    and payer_id = p_card;

  select
    count(*)::integer,
    min(expires_at)
      filter (where expires_at is not null)
  into
    v_rewards,
    v_next_expiration
  from loyalty_rewards
  where business_id = p_business
    and payer_id = p_card
    and redeemed_at is null
    and (
      expires_at is null
      or expires_at > now()
    );

  return jsonb_build_object(
    'cardId', p_card,
    'enabled', v_business.loyalty_enabled,
    'stamps', coalesce(v_card.stamps, 0),
    'stampsRequired',
      v_business.stamps_per_reward,
    'stampsRemaining',
      greatest(
        0,
        v_business.stamps_per_reward
          - coalesce(v_card.stamps, 0)
      ),
    'periodStartedAt',
      v_card.period_started_at,
    'periodEndsAt',
      v_card.period_ends_at,
    'availableRewards',
      v_rewards,
    'nextRewardExpiresAt',
      v_next_expiration,
    'expired',
      false
  );
end;
$$;


-- ============================================================
-- 6. CANJEAR PREMIOS
-- ============================================================

create or replace function public.redeem_reward(
  p_business uuid,
  p_payer text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business record;
  v_reward record;
  v_balance integer;
  v_dish uuid;
begin
  if not can_manage(p_business) then
    raise exception 'forbidden';
  end if;

  select *
  into v_business
  from businesses
  where id = p_business;

  if not found or not v_business.is_open then
    raise exception 'closed';
  end if;

  perform loyalty_sync_card(
    p_business,
    p_payer
  );

  -- Buscar el premio pendiente más antiguo.
  select *
  into v_reward
  from loyalty_rewards
  where business_id = p_business
    and payer_id = p_payer
    and redeemed_at is null
    and (
      expires_at is null
      or expires_at > now()
    )
  order by earned_at, id
  limit 1
  for update;

  if found then
    v_dish := v_reward.reward_dish_id;
  else
    -- Compatibilidad con sellos históricos
    -- obtenidos antes de esta migración.
    select stamps
    into v_balance
    from stamp_cards
    where business_id = p_business
      and payer_id = p_payer
    for update;

    if coalesce(v_balance, 0)
       < v_business.stamps_per_reward then
      raise exception 'not_enough_stamps';
    end if;

    v_dish := v_business.reward_dish_id;
  end if;

  if v_dish is null then
    raise exception 'no_reward';
  end if;

  if not exists (
    select 1
    from dishes
    where id = v_dish
      and business_id = p_business
  ) then
    raise exception 'no_reward';
  end if;

  if exists (
    select 1
    from dishes
    where id = v_dish
      and sold_out
  ) then
    raise exception 'insufficient_stock'
      using detail = 'sold_out';
  end if;

  -- Descontar inventario. Si falla,
  -- PostgreSQL revierte toda la operación.
  perform take_stock(
    p_business,
    jsonb_build_array(
      jsonb_build_object(
        'dish_id', v_dish,
        'qty', 1
      )
    )
  );

  if v_reward.id is not null then

    update loyalty_rewards
    set redeemed_at = now()
    where id = v_reward.id;

  else

    update stamp_cards
    set
      stamps =
        stamps - v_business.stamps_per_reward,
      rewards_redeemed = rewards_redeemed + 1,
      updated_at = now()
    where business_id = p_business
      and payer_id = p_payer;

    insert into stamp_events (
      business_id,
      payer_id,
      event_type,
      stamps_delta,
      balance_after,
      description
    )
    select
      p_business,
      p_payer,
      'redeemed',
      -v_business.stamps_per_reward,
      stamps,
      'Canje de recompensa con sellos históricos'
    from stamp_cards
    where business_id = p_business
      and payer_id = p_payer;

  end if;

  if v_reward.id is not null then
    update stamp_cards
    set
      rewards_redeemed = rewards_redeemed + 1,
      updated_at = now()
    where business_id = p_business
      and payer_id = p_payer;
  end if;

  select coalesce(stamps, 0)
  into v_balance
  from stamp_cards
  where business_id = p_business
    and payer_id = p_payer;

  update businesses
  set updated_at = now()
  where id = p_business;

  return coalesce(v_balance, 0);
end;
$$;


-- ============================================================
-- 7. ENTREGAS PAYPAL
-- ============================================================

-- Mantiene el flujo original:
-- autorización -> captura -> venta -> sello.
--
-- El sello ahora pasa por add_stamp para
-- aplicar las reglas de cada negocio.

create or replace function public.deliver_reservation(
  p_reservation uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res reservations;
  v_day uuid;
  v_sale uuid;
begin
  select *
  into v_res
  from reservations
  where id = p_reservation
  for update;

  if v_res.id is null
     or not can_manage(v_res.business_id) then
    raise exception 'forbidden';
  end if;

  update reservations
  set
    status = 'captured',
    updated_at = now()
  where id = p_reservation
    and status = 'authorized';

  if not found then
    return null;
  end if;

  select id
  into v_day
  from days
  where business_id = v_res.business_id
    and closed_at is null
  order by opened_at desc
  limit 1;

  insert into sales (
    business_id,
    day_id,
    method,
    total_cents,
    reservation_id
  )
  values (
    v_res.business_id,
    v_day,
    'paypal',
    v_res.total_cents,
    v_res.id
  )
  returning id into v_sale;

  insert into sale_items (
    sale_id,
    dish_id,
    qty,
    price_cents
  )
  select
    v_sale,
    ri.dish_id,
    ri.qty,
    d.price_cents
  from reservation_items ri
  join dishes d on d.id = ri.dish_id
  where ri.reservation_id = p_reservation;

  if v_res.payer_id is not null then
    perform add_stamp(
      v_res.business_id,
      v_res.payer_id,
      v_res.customer_name
    );
  end if;

  update businesses
  set updated_at = now()
  where id = v_res.business_id;

  return v_sale;
end;
$$;


-- ============================================================
-- 8. PERMISOS
-- ============================================================

-- Las funciones contienen verificaciones de
-- autorización. Restringimos su ejecución
-- directa a usuarios autenticados y al servicio.

revoke all on function
  public.save_loyalty_config(
    uuid, boolean, integer, uuid,
    text, integer, text, integer
  )
from public, anon;

revoke all on function
  public.loyalty_sync_card(uuid, text)
from public, anon;

revoke all on function
  public.get_loyalty_card(uuid, text)
from public, anon;

revoke all on function
  public.loyalty_period_bounds(uuid, timestamptz)
from public, anon;

-- Los permisos adicionales para RPC se
-- gestionan mediante los roles del proyecto.


-- ============================================================
-- FIN DE 0011
-- ============================================================
