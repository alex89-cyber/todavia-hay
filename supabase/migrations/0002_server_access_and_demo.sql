-- ¿Todavía hay? · server access + demo stall
-- The app server talks to Supabase with the service-role key, so the stock
-- functions must accept it as well as a signed-in owner. The demo stall has
-- no owner account (judges use it without signing in).

alter table businesses alter column owner_id drop not null;

-- PostgREST switches to the service_role role for the secret key (new
-- sb_secret_ keys and legacy service_role JWTs alike); `role` keeps that value
-- inside security definer functions, where current_user does not.
create or replace function is_server() returns boolean
language sql stable as $$
  select current_setting('role', true) = 'service_role'
      or coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '') = 'service_role'
$$;

create or replace function can_manage(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_server() or owns(b)
$$;

-- Same as 0001, plus: service role allowed, and sold-out dishes are refused.
create or replace function record_sale(p_business uuid, p_lines jsonb, p_method payment_method)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_sale uuid;
  v_day uuid;
begin
  if not can_manage(p_business) then raise exception 'forbidden'; end if;
  if not exists (select 1 from businesses where id = p_business and is_open) then
    raise exception 'closed';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) l
    join dishes d on d.id = (l->>'dish_id')::uuid
    where d.business_id = p_business and d.sold_out
  ) then
    raise exception 'insufficient_stock' using detail = 'sold_out';
  end if;

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

-- RN-02: opening count. counts: {"<ingredient_id>": 12000, ...}
create or replace function open_day(p_business uuid, p_counts jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_day uuid;
begin
  if not can_manage(p_business) then raise exception 'forbidden'; end if;

  update ingredients i set stock = greatest(0, (p_counts->>i.id::text)::numeric)
  where i.business_id = p_business and p_counts ? i.id::text;

  update days set closed_at = now() where business_id = p_business and closed_at is null;
  update dishes set sold_out = false where business_id = p_business;

  insert into days (business_id, opening_count)
  select p_business, coalesce(jsonb_object_agg(id::text, stock), '{}'::jsonb)
  from ingredients where business_id = p_business
  returning id into v_day;

  update businesses set is_open = true, updated_at = now() where id = p_business;
  return v_day;
end $$;

-- RN-06: close. The cash-up is computed by the app from the day's sales.
create or replace function close_day(p_business uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_day uuid;
begin
  if not can_manage(p_business) then raise exception 'forbidden'; end if;
  update days set closed_at = now()
  where business_id = p_business and closed_at is null
  returning id into v_day;
  update businesses set is_open = false, updated_at = now() where id = p_business;
  return v_day;
end $$;

-- ------------------------------------------------------------ Demo stall
-- Fixed ids so the app's demo reset can find it. Re-running this file resets it.

-- Sales and reservations first: their items point at dishes without a cascade.
delete from sales where business_id in (select id from businesses where slug = 'birria-dona-lupe');
delete from reservations where business_id in (select id from businesses where slug = 'birria-dona-lupe');
delete from businesses where slug = 'birria-dona-lupe';

insert into businesses (id, owner_id, slug, name, is_open)
values ('b0000000-0000-4000-8000-000000000001', null, 'birria-dona-lupe', 'Birria Doña Lupe', false);

insert into ingredients (id, business_id, name, unit, stock) values
  ('10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Carne de birria', 'g', 12000),
  ('10000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Consomé', 'ml', 15000),
  ('10000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'Tortilla', 'pz', 300),
  ('10000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'Queso Oaxaca', 'g', 2500),
  ('10000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'Cebolla y cilantro', 'g', 3000);

insert into dishes (id, business_id, name_es, name_en, price_cents, sort) values
  ('20000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Plato de birria', 'Birria plate', 14000, 1),
  ('20000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Orden de tacos dorados (3)', 'Crispy tacos (3)', 9000, 2),
  ('20000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'Quesabirria', 'Quesabirria', 4500, 3),
  ('20000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'Vaso de consomé', 'Cup of consomé', 3000, 4);

insert into recipe_items (dish_id, ingredient_id, qty) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 250),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 300),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 4),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 30),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 150),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 3),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 100),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', 20),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 80),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', 50),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 1),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 60),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 350);
