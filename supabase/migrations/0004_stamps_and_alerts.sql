-- ¿Todavía hay? · stamp card and "avísame cuando haya"

-- ---------------------------------------------------------------- stamp card
-- Every PayPal order handed over adds a stamp to the payer's card at that
-- stall. stamps_per_reward stamps buy one reward dish, given at the counter.

alter table businesses
  add column if not exists stamps_per_reward int not null default 10 check (stamps_per_reward > 0),
  add column if not exists reward_dish_id uuid references dishes (id) on delete set null;

-- PayPal's payer id, known once the customer approves.
alter table reservations add column if not exists payer_id text;

create table if not exists stamp_cards (
  business_id       uuid not null references businesses (id) on delete cascade,
  payer_id          text not null,
  stamps            int not null default 0 check (stamps >= 0),
  rewards_redeemed  int not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (business_id, payer_id)
);

alter table stamp_cards enable row level security;
drop policy if exists owner_all on stamp_cards;
create policy owner_all on stamp_cards for all using (owns(business_id)) with check (owns(business_id));

-- Same as 0003, plus the stamp.
create or replace function deliver_reservation(p_reservation uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_res reservations;
  v_day uuid;
  v_sale uuid;
begin
  select * into v_res from reservations where id = p_reservation;
  if v_res.id is null or not can_manage(v_res.business_id) then raise exception 'forbidden'; end if;

  update reservations set status = 'captured', updated_at = now()
  where id = p_reservation and status = 'authorized';
  if not found then return null; end if;

  select id into v_day from days
  where business_id = v_res.business_id and closed_at is null
  order by opened_at desc limit 1;

  insert into sales (business_id, day_id, method, total_cents, reservation_id)
  values (v_res.business_id, v_day, 'paypal', v_res.total_cents, v_res.id)
  returning id into v_sale;

  insert into sale_items (sale_id, dish_id, qty, price_cents)
  select v_sale, ri.dish_id, ri.qty, d.price_cents
  from reservation_items ri join dishes d on d.id = ri.dish_id
  where ri.reservation_id = p_reservation;

  if v_res.payer_id is not null then
    insert into stamp_cards (business_id, payer_id, stamps) values (v_res.business_id, v_res.payer_id, 1)
    on conflict (business_id, payer_id) do update set stamps = stamp_cards.stamps + 1, updated_at = now();
  end if;

  update businesses set updated_at = now() where id = v_res.business_id;
  return v_sale;
end $$;

-- Spends the stamps and takes the reward dish out of stock. Not a sale: no money moves.
create or replace function redeem_reward(p_business uuid, p_payer text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_per int;
  v_dish uuid;
  v_left int;
begin
  if not can_manage(p_business) then raise exception 'forbidden'; end if;
  select stamps_per_reward, reward_dish_id into v_per, v_dish from businesses where id = p_business and is_open;
  if not found then raise exception 'closed'; end if;
  if v_dish is null then raise exception 'no_reward'; end if;
  if exists (select 1 from dishes where id = v_dish and sold_out) then
    raise exception 'insufficient_stock' using detail = 'sold_out';
  end if;

  update stamp_cards set stamps = stamps - v_per, rewards_redeemed = rewards_redeemed + 1, updated_at = now()
  where business_id = p_business and payer_id = p_payer and stamps >= v_per
  returning stamps into v_left;
  if not found then raise exception 'not_enough_stamps'; end if;

  perform take_stock(p_business, jsonb_build_array(jsonb_build_object('dish_id', v_dish, 'qty', 1)));
  update businesses set updated_at = now() where id = p_business;
  return v_left;
end $$;

-- ---------------------------------------------------------------- alerts
-- A browser push subscription waiting for the stall to open (dish_id null) or
-- for a dish to come back. Sent once, then deleted.

create table if not exists push_watches (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  dish_id     uuid references dishes (id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  lang        text not null default 'es' check (lang in ('es', 'en')),
  created_at  timestamptz not null default now()
);

create unique index if not exists push_watches_once
  on push_watches (business_id, endpoint, coalesce(dish_id, '00000000-0000-0000-0000-000000000000'));

alter table push_watches enable row level security;
drop policy if exists owner_all on push_watches;
create policy owner_all on push_watches for all using (owns(business_id)) with check (owns(business_id));

create or replace function add_watch(p_business uuid, p_dish uuid, p_endpoint text, p_p256dh text, p_auth text, p_lang text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_manage(p_business) then raise exception 'forbidden'; end if;
  if p_dish is not null and not exists (select 1 from dishes where id = p_dish and business_id = p_business) then
    raise exception 'unknown_dish';
  end if;
  -- Old subscriptions the browser never renewed.
  delete from push_watches where business_id = p_business and created_at < now() - interval '30 days';
  insert into push_watches (business_id, dish_id, endpoint, p256dh, auth, lang)
  values (p_business, p_dish, p_endpoint, p_p256dh, p_auth, p_lang)
  on conflict (business_id, endpoint, coalesce(dish_id, '00000000-0000-0000-0000-000000000000'))
  do update set p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang, created_at = now();
end $$;

-- Takes the watches that are due: deleted here so two requests never send twice.
create or replace function claim_watches(p_business uuid, p_open boolean, p_dishes uuid[])
returns setof push_watches
language plpgsql security definer set search_path = public as $$
begin
  if not can_manage(p_business) then raise exception 'forbidden'; end if;
  return query
  delete from push_watches
  where business_id = p_business
    and ((dish_id is null and p_open) or dish_id = any (p_dishes))
  returning *;
end $$;

-- ---------------------------------------------------------------- demo
update businesses set reward_dish_id = '20000000-0000-4000-8000-000000000003'
where id = 'b0000000-0000-4000-8000-000000000001';
