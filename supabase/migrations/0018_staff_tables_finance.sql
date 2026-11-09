-- 0018: lo que se creó a mano en el Supabase del SaaS (planes, personal,
-- mesas, compras y gastos), ahora como migración para que un proyecto
-- nuevo quede igual.
--
-- Se puede correr sobre una base que ya lo tiene: todo es "if not exists"
-- o "create or replace", así que no borra ni duplica nada.
--
-- Además:
-- - Activa RLS en las tablas nuevas. La app las usa solo desde el
--   servidor (clave service_role), que no pasa por RLS. Sin políticas,
--   nadie más puede leerlas con la clave pública.
-- - Las funciones solo las puede llamar el servidor.

-- ------------------------------------------
-- Pagos por transferencia
-- ------------------------------------------

alter type payment_method add value if not exists 'transfer';

-- ------------------------------------------
-- Planes y portal de socios
-- ------------------------------------------

alter table businesses add column if not exists plan text not null default 'basic';

do $$ begin
  alter table businesses
    add constraint businesses_plan_check check (plan in ('basic', 'medium', 'plus'));
exception when duplicate_object then null;
end $$;

create table if not exists platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists platform_plan_audit (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses (id),
  admin_user_id  uuid not null references auth.users (id),
  old_plan       text not null,
  new_plan       text not null,
  changed_at     timestamptz not null default now()
);

-- ------------------------------------------
-- Roles del personal
-- ------------------------------------------

alter table business_members drop constraint if exists business_members_role_check;
alter table business_members
  add constraint business_members_role_check
  check (role in ('owner', 'manager', 'waiter', 'kitchen', 'staff'));

-- ------------------------------------------
-- Mesas y reservas para comer ahí
-- ------------------------------------------

create table if not exists restaurant_tables (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses (id) on delete cascade,
  name         text not null,
  capacity     int not null default 2 check (capacity between 1 and 50),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  group_id     uuid,
  constraint restaurant_tables_business_id_name_key unique (business_id, name),
  constraint restaurant_tables_id_business_unique unique (id, business_id)
);

alter table restaurant_tables add column if not exists group_id uuid;

create table if not exists dine_in_requests (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses (id) on delete cascade,
  customer_name   text not null
    check (char_length(trim(customer_name)) between 2 and 120),
  customer_phone  text,
  requested_at    timestamptz not null,
  party_size      int not null check (party_size between 1 and 50),
  items           jsonb not null check (
    jsonb_typeof(items) = 'array'
    and jsonb_array_length(items) between 1 and 30
  ),
  status          text not null default 'pending' check (
    status in ('pending', 'confirmed', 'rejected', 'arrived', 'cancelled', 'completed')
  ),
  table_id        uuid references restaurant_tables (id) on delete set null,
  reservation_id  uuid,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint dine_in_requests_check check (status <> 'arrived' or table_id is not null),
  constraint dine_in_requests_table_business_fk
    foreign key (table_id, business_id) references restaurant_tables (id, business_id)
);

-- ------------------------------------------
-- Compras de inventario y gastos
-- ------------------------------------------

create table if not exists inventory_purchases (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses (id),
  supplier      text,
  purchased_at  timestamptz not null default now(),
  created_by    uuid references auth.users (id),
  notes         text,
  created_at    timestamptz not null default now(),
  constraint inventory_purchases_id_business_id_key unique (id, business_id)
);

create table if not exists inventory_purchase_items (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null,
  purchase_id       uuid not null,
  ingredient_id     uuid not null references ingredients (id),
  quantity          numeric not null check (quantity > 0),
  total_cost_cents  bigint not null check (total_cost_cents >= 0),
  created_at        timestamptz not null default now(),
  constraint inventory_purchase_items_purchase_id_business_id_fkey
    foreign key (purchase_id, business_id) references inventory_purchases (id, business_id)
);

create table if not exists business_expenses (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses (id),
  category      text not null check (category in (
    'rent', 'electricity', 'water', 'gas', 'payroll',
    'transport', 'maintenance', 'supplies', 'other'
  )),
  description   text not null,
  amount_cents  bigint not null check (amount_cents >= 0),
  expense_date  date not null default current_date,
  created_by    uuid references auth.users (id),
  created_at    timestamptz not null default now()
);

alter table platform_admins          enable row level security;
alter table platform_plan_audit      enable row level security;
alter table restaurant_tables        enable row level security;
alter table dine_in_requests         enable row level security;
alter table inventory_purchases      enable row level security;
alter table inventory_purchase_items enable row level security;
alter table business_expenses        enable row level security;

-- ------------------------------------------
-- Entregar un apartado y anotar cómo pagó
-- ------------------------------------------

create or replace function deliver_reservation_with_method(p_reservation uuid, p_method text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res reservations%rowtype;
  v_day uuid;
  v_sale uuid;
begin
  if not is_server() then
    raise exception 'forbidden';
  end if;

  if p_method is null or p_method not in ('cash', 'card', 'transfer') then
    raise exception 'invalid_payment_method';
  end if;

  select * into v_res from reservations where id = p_reservation for update;
  if not found then
    raise exception 'reservation_not_found';
  end if;

  if v_res.status <> 'authorized' then
    return null;
  end if;

  if exists (select 1 from sales where reservation_id = p_reservation) then
    raise exception 'sale_already_exists';
  end if;

  select id into v_day
  from days
  where business_id = v_res.business_id and closed_at is null
  order by opened_at desc
  limit 1;

  insert into sales (business_id, day_id, method, total_cents, reservation_id)
  values (v_res.business_id, v_day, p_method::payment_method, v_res.total_cents, v_res.id)
  returning id into v_sale;

  insert into sale_items (sale_id, dish_id, qty, price_cents)
  select v_sale, ri.dish_id, ri.qty, d.price_cents
  from reservation_items ri
  join dishes d on d.id = ri.dish_id
  where ri.reservation_id = p_reservation;

  update reservations
  set status = 'captured', updated_at = now()
  where id = p_reservation;

  if v_res.payer_id is not null then
    perform add_stamp(v_res.business_id, v_res.payer_id, v_res.customer_name);
  end if;

  update businesses set updated_at = now() where id = v_res.business_id;

  return v_sale;
end;
$$;

-- ------------------------------------------
-- Juntar y separar mesas
-- ------------------------------------------

create or replace function manage_table_group(
  p_business uuid,
  p_action text,
  p_table_ids uuid[] default null,
  p_group_id uuid default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_ids uuid[];
  v_count integer;
  v_group uuid;
  v_free integer;
begin
  if not is_server() then
    raise exception 'forbidden';
  end if;

  if p_action = 'join' then
    select array_agg(distinct x order by x) into v_ids from unnest(p_table_ids) as x;

    if coalesce(array_length(v_ids, 1), 0) < 2 then
      raise exception 'select_at_least_two_tables';
    end if;

    -- Bloquea las mesas para que dos meseros no junten las mismas.
    perform id from restaurant_tables
    where business_id = p_business and id = any (v_ids)
    order by id
    for update;

    select count(*), count(*) filter (where active and group_id is null)
    into v_count, v_free
    from restaurant_tables
    where business_id = p_business and id = any (v_ids);

    if v_count <> array_length(v_ids, 1) or v_free <> v_count then
      raise exception 'tables_unavailable';
    end if;

    v_group := gen_random_uuid();

    update restaurant_tables
    set group_id = v_group
    where business_id = p_business and id = any (v_ids);

    return v_group;

  elsif p_action = 'separate' then
    if p_group_id is null then
      raise exception 'missing_group_id';
    end if;

    perform id from restaurant_tables
    where business_id = p_business and group_id = p_group_id
    order by id
    for update;

    update restaurant_tables
    set group_id = null
    where business_id = p_business and group_id = p_group_id;

    if not found then
      raise exception 'group_not_found';
    end if;

    return p_group_id;
  end if;

  raise exception 'invalid_action';
end;
$$;

-- ------------------------------------------
-- Registrar una compra de inventario
-- ------------------------------------------

create or replace function register_inventory_purchase(
  p_business uuid,
  p_items jsonb,
  p_supplier text default null,
  p_created_by uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_item jsonb;
  v_ingredient uuid;
  v_quantity numeric;
  v_cost bigint;
  v_adds jsonb := '{}'::jsonb;
begin
  if not is_server() then
    raise exception 'forbidden';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 100 then
    raise exception 'invalid_items';
  end if;

  if not exists (select 1 from businesses where id = p_business and is_open) then
    raise exception 'closed';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'invalid_item';
    end if;

    v_ingredient := (v_item->>'ingredient_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_cost := (v_item->>'total_cost_cents')::bigint;

    if v_ingredient is null
       or v_quantity is null or v_quantity <= 0 or v_quantity > 1000000
       or v_cost is null or v_cost < 0 then
      raise exception 'invalid_quantity_or_cost';
    end if;

    if not exists (
      select 1 from ingredients where id = v_ingredient and business_id = p_business
    ) then
      raise exception 'ingredient_not_found';
    end if;

    if v_adds ? v_ingredient::text then
      raise exception 'duplicate_ingredient';
    end if;

    v_adds := v_adds || jsonb_build_object(v_ingredient::text, v_quantity);
  end loop;

  insert into inventory_purchases (business_id, supplier, created_by, notes)
  values (p_business, nullif(trim(p_supplier), ''), p_created_by, p_notes)
  returning id into v_purchase_id;

  insert into inventory_purchase_items (business_id, purchase_id, ingredient_id, quantity, total_cost_cents)
  select p_business, v_purchase_id,
         (item->>'ingredient_id')::uuid,
         (item->>'quantity')::numeric,
         (item->>'total_cost_cents')::bigint
  from jsonb_array_elements(p_items) as item;

  perform restock(p_business, v_adds);

  return v_purchase_id;
end;
$$;

-- ------------------------------------------
-- Cambiar el plan de un negocio
-- ------------------------------------------

create or replace function th_change_business_plan(p_business_id uuid, p_admin_id uuid, p_new_plan text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_old_plan text;
begin
  if p_new_plan is null or p_new_plan not in ('basic', 'medium', 'plus') then
    raise exception 'Plan inválido';
  end if;

  if not exists (select 1 from public.platform_admins where user_id = p_admin_id) then
    raise exception 'Administrador no autorizado';
  end if;

  select plan into v_old_plan from public.businesses where id = p_business_id for update;
  if not found then
    raise exception 'Negocio no encontrado';
  end if;

  if v_old_plan = p_new_plan then
    return;
  end if;

  update public.businesses set plan = p_new_plan where id = p_business_id;

  insert into public.platform_plan_audit (business_id, admin_user_id, old_plan, new_plan)
  values (p_business_id, p_admin_id, v_old_plan, p_new_plan);
end;
$$;

-- Solo el servidor (service_role) llama estas funciones.
revoke execute on function deliver_reservation_with_method(uuid, text) from public, anon, authenticated;
revoke execute on function manage_table_group(uuid, text, uuid[], uuid) from public, anon, authenticated;
revoke execute on function register_inventory_purchase(uuid, jsonb, text, uuid, text) from public, anon, authenticated;
revoke execute on function th_change_business_plan(uuid, uuid, text) from public, anon, authenticated;
grant execute on function deliver_reservation_with_method(uuid, text) to service_role;
grant execute on function manage_table_group(uuid, text, uuid[], uuid) to service_role;
grant execute on function register_inventory_purchase(uuid, jsonb, text, uuid, text) to service_role;
grant execute on function th_change_business_plan(uuid, uuid, text) to service_role;
