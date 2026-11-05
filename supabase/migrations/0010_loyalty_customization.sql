
-- ============================================================
-- ¿TODAVÍA HAY?
-- Migración 0010: Personalización de recompensas
--
-- Esta migración:
-- 1. Agrega reglas independientes para cada negocio.
-- 2. Permite configurar periodos y vencimientos.
-- 3. Prepara el historial de movimientos de sellos.
-- 4. Prepara el registro de premios obtenidos.
-- 5. Conserva los saldos de sellos existentes.
--
-- IMPORTANTE:
-- No modifica las funciones actuales de PayPal,
-- reservas, inventario o canje de recompensas.
-- ============================================================


-- ============================================================
-- 1. CONFIGURACIÓN DEL PROGRAMA POR NEGOCIO
-- ============================================================

alter table public.businesses
  add column if not exists loyalty_enabled
    boolean not null default true,

  add column if not exists loyalty_period_kind
    text not null default 'none',

  add column if not exists loyalty_period_days
    integer not null default 30,

  add column if not exists loyalty_expiry_action
    text not null default 'reset',

  add column if not exists loyalty_reward_valid_days
    integer,

  add column if not exists loyalty_rules_updated_at
    timestamptz not null default now();


-- Los negocios existentes conservan su comportamiento
-- anterior: programa activo y sellos sin vencimiento.

alter table public.businesses
  drop constraint if exists businesses_loyalty_period_kind_check;

alter table public.businesses
  add constraint businesses_loyalty_period_kind_check
  check (
    loyalty_period_kind in (
      'none',
      'calendar_week',
      'calendar_month',
      'rolling_days'
    )
  );


-- La cantidad de días solo se utiliza cuando
-- loyalty_period_kind = 'rolling_days'.

alter table public.businesses
  drop constraint if exists businesses_loyalty_period_days_check;

alter table public.businesses
  add constraint businesses_loyalty_period_days_check
  check (
    loyalty_period_days between 1 and 365
  );


-- Al vencer, el negocio podrá reiniciar los sellos
-- incompletos o conservarlos.

alter table public.businesses
  drop constraint if exists businesses_loyalty_expiry_action_check;

alter table public.businesses
  add constraint businesses_loyalty_expiry_action_check
  check (
    loyalty_expiry_action in ('reset', 'keep')
  );


-- NULL significa que los premios obtenidos
-- no tienen vencimiento.

alter table public.businesses
  drop constraint if exists businesses_loyalty_reward_valid_days_check;

alter table public.businesses
  add constraint businesses_loyalty_reward_valid_days_check
  check (
    loyalty_reward_valid_days is null
    or loyalty_reward_valid_days between 1 and 365
  );


-- La cantidad de sellos necesarios ya existe
-- como businesses.stamps_per_reward.
-- No se crea otra columna para evitar duplicados.


-- ============================================================
-- 2. PERIODO ACTUAL DE CADA TARJETA
-- ============================================================

alter table public.stamp_cards
  add column if not exists period_started_at
    timestamptz,

  add column if not exists period_ends_at
    timestamptz,

  add column if not exists period_rules_updated_at
    timestamptz;


-- Las tarjetas existentes conservan sus sellos.
-- Los campos de periodo permanecen en NULL hasta
-- que la lógica nueva gestione su siguiente periodo.


-- ============================================================
-- 3. HISTORIAL DE MOVIMIENTOS DE SELLOS
-- ============================================================

create table if not exists public.stamp_events (
  id uuid primary key default gen_random_uuid(),

  business_id uuid not null,

  payer_id text not null,

  event_type text not null,

  stamps_delta integer not null default 0,

  balance_after integer not null,

  description text,

  created_at timestamptz not null default now(),

  constraint stamp_events_card_fk
    foreign key (business_id, payer_id)
    references public.stamp_cards (
      business_id,
      payer_id
    )
    on delete cascade,

  constraint stamp_events_balance_check
    check (balance_after >= 0),

  constraint stamp_events_type_check
    check (
      event_type in (
        'opening_balance',
        'earned',
        'redeemed',
        'expired',
        'adjustment'
      )
    )
);


create index if not exists
  stamp_events_card_date_idx
on public.stamp_events (
  business_id,
  payer_id,
  created_at desc
);


-- Evita duplicar el saldo inicial si se ejecuta
-- accidentalmente la migración más de una vez.

create unique index if not exists
  stamp_events_one_opening_balance_idx
on public.stamp_events (
  business_id,
  payer_id
)
where event_type = 'opening_balance';


-- Registrar los saldos existentes como referencia
-- histórica, sin sumarlos nuevamente.

insert into public.stamp_events (
  business_id,
  payer_id,
  event_type,
  stamps_delta,
  balance_after,
  description
)
select
  sc.business_id,
  sc.payer_id,
  'opening_balance',
  0,
  sc.stamps,
  'Saldo existente antes de activar el historial'
from public.stamp_cards sc
on conflict do nothing;


-- ============================================================
-- 4. PREMIOS OBTENIDOS POR LOS CLIENTES
-- ============================================================

create table if not exists public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),

  business_id uuid not null,

  payer_id text not null,

  reward_dish_id uuid
    references public.dishes(id)
    on delete set null,

  stamps_required integer not null,

  earned_at timestamptz not null default now(),

  expires_at timestamptz,

  redeemed_at timestamptz,

  constraint loyalty_rewards_card_fk
    foreign key (business_id, payer_id)
    references public.stamp_cards (
      business_id,
      payer_id
    )
    on delete cascade,

  constraint loyalty_rewards_stamps_check
    check (stamps_required > 0),

  constraint loyalty_rewards_expiration_check
    check (
      expires_at is null
      or expires_at > earned_at
    ),

  constraint loyalty_rewards_redemption_check
    check (
      redeemed_at is null
      or redeemed_at >= earned_at
    )
);


create index if not exists
  loyalty_rewards_card_idx
on public.loyalty_rewards (
  business_id,
  payer_id,
  earned_at desc
);


create index if not exists
  loyalty_rewards_available_idx
on public.loyalty_rewards (
  business_id,
  payer_id,
  expires_at
)
where redeemed_at is null;


-- Los premios nuevos se registrarán aquí cuando
-- implementemos la lógica de asignación.
--
-- No convertimos automáticamente los sellos
-- anteriores en premios, porque podrían haberse
-- contabilizado con reglas diferentes.


-- ============================================================
-- 5. SEGURIDAD DE LAS TABLAS NUEVAS
-- ============================================================

alter table public.stamp_events
  enable row level security;

alter table public.loyalty_rewards
  enable row level security;


-- Los propietarios pueden consultar los registros
-- correspondientes a sus propios negocios.

drop policy if exists owner_read_stamp_events
  on public.stamp_events;

create policy owner_read_stamp_events
on public.stamp_events
for select
to authenticated
using (
  public.owns(business_id)
);


drop policy if exists owner_read_loyalty_rewards
  on public.loyalty_rewards;

create policy owner_read_loyalty_rewards
on public.loyalty_rewards
for select
to authenticated
using (
  public.owns(business_id)
);


-- Los registros se crearán y modificarán desde
-- la lógica segura del servidor, no directamente
-- desde el navegador del cliente.

revoke insert, update, delete
on public.stamp_events
from anon, authenticated;

revoke insert, update, delete
on public.loyalty_rewards
from anon, authenticated;


-- ============================================================
-- FIN DE LA MIGRACIÓN 0010
-- ============================================================
