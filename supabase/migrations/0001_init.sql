-- ¿Todavía hay? · initial schema
-- One owner per business (MVP decision #10). Stock lives on `ingredients`
-- and is changed only through the functions at the bottom, so that two
-- phones selling the last portion at the same time cannot both succeed.

create extension if not exists pgcrypto;

create table businesses (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  slug          text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name          text not null,
  currency      text not null default 'MXN',
  timezone      text not null default 'America/Mexico_City',
  is_open       boolean not null default false,
  -- How long a reservation is held before it is voided and stock returns.
  hold_minutes  int not null default 45 check (hold_minutes between 10 and 240),
  updated_at    timestamptz not null default now()
);

create table ingredients (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses (id) on delete cascade,
  name         text not null,
  unit         text not null,               -- g, ml, pz
  stock        numeric not null default 0 check (stock >= 0),
  unique (business_id, name)
);

create table dishes (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses (id) on delete cascade,
  name_es      text not null,
  name_en      text not null,
  price_cents  int not null check (price_cents >= 0),
  sold_out     boolean not null default false,   -- RN-05 manual switch
  sort         int not null default 0
);

create table recipe_items (
  dish_id        uuid not null references dishes (id) on delete cascade,
  ingredient_id  uuid not null references ingredients (id) on delete cascade,
  qty            numeric not null check (qty > 0),
  primary key (dish_id, ingredient_id)
);

-- One row per open/close cycle; the cash-up (corte de caja, RN-06) reads sales by day_id.
create table days (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses (id) on delete cascade,
  opened_at    timestamptz not null default now(),
  closed_at    timestamptz,
  opening_count jsonb not null default '{}'::jsonb   -- {ingredient_id: stock} at RN-02
);

create type payment_method as enum ('cash', 'card', 'paypal');

create table sales (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses (id) on delete cascade,
  day_id          uuid references days (id) on delete set null,
  method          payment_method not null,
  total_cents     int not null,
  reservation_id  uuid,
  created_at      timestamptz not null default now()
);

create table sale_items (
  sale_id      uuid not null references sales (id) on delete cascade,
  dish_id      uuid not null references dishes (id),
  qty          int not null check (qty > 0),
  price_cents  int not null,
  primary key (sale_id, dish_id)
);

-- held: stock set aside, waiting for PayPal approval
-- authorized: customer approved, payment held by PayPal, waiting for pickup
-- captured: delivered and charged (a sale row exists)
-- voided / expired: stock returned
create type reservation_status as enum ('held', 'authorized', 'captured', 'voided', 'expired');

create table reservations (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references businesses (id) on delete cascade,
  customer_name            text not null,
  pickup_by                timestamptz not null,
  status                   reservation_status not null default 'held',
  total_cents              int not null,
  paypal_order_id          text unique,
  paypal_authorization_id  text unique,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table reservation_items (
  reservation_id  uuid not null references reservations (id) on delete cascade,
  dish_id         uuid not null references dishes (id),
  qty             int not null check (qty > 0),
  primary key (reservation_id, dish_id)
);

alter table sales
  add constraint sales_reservation_fk foreign key (reservation_id) references reservations (id);

create index on sales (business_id, created_at);
create index on reservations (business_id, status, pickup_by);

-- ---------------------------------------------------------------- RLS
-- Owners manage their own rows. The public page and the agent read through
-- the server with the service role, so anon gets no direct table access.

alter table businesses        enable row level security;
alter table ingredients       enable row level security;
alter table dishes            enable row level security;
alter table recipe_items      enable row level security;
alter table days              enable row level security;
alter table sales             enable row level security;
alter table sale_items        enable row level security;
alter table reservations      enable row level security;
alter table reservation_items enable row level security;

create function owns(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from businesses where id = b and owner_id = auth.uid())
$$;

create policy owner_all on businesses for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on ingredients for all using (owns(business_id)) with check (owns(business_id));
create policy owner_all on dishes for all using (owns(business_id)) with check (owns(business_id));
create policy owner_all on recipe_items for all
  using (owns((select business_id from dishes where id = dish_id)))
  with check (owns((select business_id from dishes where id = dish_id)));
create policy owner_all on days for all using (owns(business_id)) with check (owns(business_id));
create policy owner_all on sales for all using (owns(business_id)) with check (owns(business_id));
create policy owner_all on sale_items for all
  using (owns((select business_id from sales where id = sale_id)))
  with check (owns((select business_id from sales where id = sale_id)));
create policy owner_all on reservations for all using (owns(business_id)) with check (owns(business_id));
create policy owner_all on reservation_items for all
  using (owns((select business_id from reservations where id = reservation_id)))
  with check (owns((select business_id from reservations where id = reservation_id)));

-- ---------------------------------------------------------- Stock moves
-- lines: [{"dish_id": "...", "qty": 2}, ...]

-- Takes ingredients out for `lines`; raises 'insufficient_stock' if any
-- ingredient would go below zero. Rows are locked, so concurrent calls queue.
create function take_stock(p_business uuid, p_lines jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  short text;
begin
  with need as (
    select ri.ingredient_id, sum(ri.qty * (l->>'qty')::int) as qty
    from jsonb_array_elements(p_lines) l
    join dishes d on d.id = (l->>'dish_id')::uuid and d.business_id = p_business
    join recipe_items ri on ri.dish_id = d.id
    group by ri.ingredient_id
  ), locked as (
    select i.id, i.stock, n.qty
    from ingredients i join need n on n.ingredient_id = i.id
    for update of i
  )
  select string_agg(id::text, ',') into short from locked where stock < qty;

  if short is not null then
    raise exception 'insufficient_stock' using detail = short;
  end if;

  update ingredients i set stock = i.stock - n.qty
  from (
    select ri.ingredient_id, sum(ri.qty * (l->>'qty')::int) as qty
    from jsonb_array_elements(p_lines) l
    join recipe_items ri on ri.dish_id = (l->>'dish_id')::uuid
    group by ri.ingredient_id
  ) n
  where i.id = n.ingredient_id and i.business_id = p_business;

  update businesses set updated_at = now() where id = p_business;
end $$;

create function give_back_stock(p_business uuid, p_lines jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  update ingredients i set stock = i.stock + n.qty
  from (
    select ri.ingredient_id, sum(ri.qty * (l->>'qty')::int) as qty
    from jsonb_array_elements(p_lines) l
    join recipe_items ri on ri.dish_id = (l->>'dish_id')::uuid
    group by ri.ingredient_id
  ) n
  where i.id = n.ingredient_id and i.business_id = p_business;

  update businesses set updated_at = now() where id = p_business;
end $$;

-- RN-03 + RN-04: a counter sale. Returns the sale id.
create function record_sale(p_business uuid, p_lines jsonb, p_method payment_method)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_sale uuid;
  v_day uuid;
begin
  if not owns(p_business) then raise exception 'forbidden'; end if;
  perform take_stock(p_business, p_lines);

  select id into v_day from days
  where business_id = p_business and closed_at is null
  order by opened_at desc limit 1;

  insert into sales (business_id, day_id, method, total_cents)
  select p_business, v_day, p_method, coalesce(sum(d.price_cents * (l->>'qty')::int), 0)
  from jsonb_array_elements(p_lines) l join dishes d on d.id = (l->>'dish_id')::uuid
  returning id into v_sale;

  insert into sale_items (sale_id, dish_id, qty, price_cents)
  select v_sale, d.id, (l->>'qty')::int, d.price_cents
  from jsonb_array_elements(p_lines) l join dishes d on d.id = (l->>'dish_id')::uuid;

  return v_sale;
end $$;

revoke execute on function take_stock(uuid, jsonb) from public, anon, authenticated;
revoke execute on function give_back_stock(uuid, jsonb) from public, anon, authenticated;

-- Live updates for the public page (RN-07).
alter publication supabase_realtime add table businesses;
