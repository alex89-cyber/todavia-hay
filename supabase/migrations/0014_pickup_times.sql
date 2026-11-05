-- Recoger: "para ahorita" o "para una hora", confirmación del cliente,
-- "Listo" del negocio y cobro si nadie lo recoge.

alter table reservations
  add column if not exists pickup_mode text not null default 'asap'
    check (pickup_mode in ('asap', 'scheduled')),
  add column if not exists pickup_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists no_show boolean not null default false,
  add column if not exists confirm_asked_at timestamptz,
  add column if not exists prep_alerted_at timestamptz;

create index if not exists reservations_pickup_at_idx
  on reservations (business_id, pickup_at)
  where pickup_at is not null;

-- Teléfonos a los que avisar: el del dueño (reservation_id nulo) o el del
-- cliente para un pedido. Solo el servidor la usa.
create table if not exists pickup_push (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  reservation_id uuid references reservations (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  lang text not null default 'es' check (lang in ('es', 'en')),
  created_at timestamptz not null default now(),
  unique nulls not distinct (business_id, reservation_id, endpoint)
);

alter table pickup_push enable row level security;
-- Sin políticas: anon y authenticated no ven nada; la service role sí.
