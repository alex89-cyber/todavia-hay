-- 0019: cuentas de mesa (abrir mesa, tomar pedido, cobrar).
--
-- Una cuenta pertenece a una mesa (o a un grupo de mesas juntas) mientras
-- está abierta. Cada platillo pedido descuenta inventario en ese momento,
-- igual que una venta de mostrador, para que la página pública muestre lo
-- que de verdad queda. Cancelar un platillo lo regresa. Se cobra en uno
-- o varios pagos; cada pago es una venta (sales) con su método, ligada
-- con sales.table_tab_id.
--
-- Todo se hace con las funciones de abajo, solo desde el servidor.

create table if not exists table_tabs (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses (id) on delete cascade,
  table_id     uuid not null references restaurant_tables (id),
  -- Nombre que se ve en la cuenta y el corte: "Mesa 1" o "Mesa 1 + Mesa 2".
  table_label  text not null,
  party_size   int not null check (party_size between 1 and 50),
  status       text not null default 'open' check (status in ('open', 'paid', 'cancelled')),
  opened_by    uuid references auth.users (id) on delete set null,
  opened_at    timestamptz not null default now(),
  closed_by    uuid references auth.users (id) on delete set null,
  closed_at    timestamptz,
  sale_id      uuid references sales (id) on delete set null
);

-- Una sola cuenta abierta por mesa.
create unique index if not exists table_tabs_one_open
  on table_tabs (table_id) where status = 'open';
create index if not exists table_tabs_business_status
  on table_tabs (business_id, status);

create table if not exists table_tab_items (
  id            uuid primary key default gen_random_uuid(),
  tab_id        uuid not null references table_tabs (id) on delete cascade,
  business_id   uuid not null references businesses (id) on delete cascade,
  dish_id       uuid not null references dishes (id),
  qty           int not null check (qty between 1 and 99),
  -- Precio al momento de pedir.
  price_cents   int not null check (price_cents >= 0),
  note          text check (note is null or char_length(note) <= 140),
  added_by      uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz,
  cancelled_by  uuid references auth.users (id) on delete set null
);

create index if not exists table_tab_items_tab on table_tab_items (tab_id);

alter table sales add column if not exists table_tab_id uuid references table_tabs (id) on delete set null;

alter table table_tabs      enable row level security;
alter table table_tab_items enable row level security;

-- ------------------------------------------
-- Abrir mesa
-- ------------------------------------------

create or replace function open_table_tab(
  p_business uuid,
  p_table uuid,
  p_party int,
  p_user uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table restaurant_tables%rowtype;
  v_label text;
  v_tab uuid;
begin
  if not is_server() then
    raise exception 'forbidden';
  end if;

  if p_party is null or p_party < 1 or p_party > 50 then
    raise exception 'invalid_party_size';
  end if;

  select * into v_table
  from restaurant_tables
  where id = p_table and business_id = p_business
  for update;

  if not found then
    raise exception 'table_not_found';
  end if;

  if not v_table.active then
    raise exception 'table_inactive';
  end if;

  -- Bloquea las demás mesas del grupo para que dos meseros no abran la
  -- misma mesa al mismo tiempo.
  if v_table.group_id is not null then
    perform id from restaurant_tables
    where business_id = p_business and group_id = v_table.group_id
    order by id
    for update;
  end if;

  if exists (
    select 1
    from table_tabs t
    join restaurant_tables rt on rt.id = t.table_id
    where t.business_id = p_business
      and t.status = 'open'
      and (
        rt.id = v_table.id
        or (v_table.group_id is not null and rt.group_id = v_table.group_id)
      )
  ) then
    raise exception 'table_busy';
  end if;

  select string_agg(name, ' + ' order by name)
  into v_label
  from restaurant_tables
  where business_id = p_business
    and (id = v_table.id or (v_table.group_id is not null and group_id = v_table.group_id));

  insert into table_tabs (business_id, table_id, table_label, party_size, opened_by)
  values (p_business, v_table.id, v_label, p_party, p_user)
  returning id into v_tab;

  return v_tab;
end;
$$;

-- ------------------------------------------
-- Agregar platillos a la cuenta
-- p_lines: [{"dish_id": "...", "qty": 2, "note": "sin cebolla"}, ...]
-- ------------------------------------------

create or replace function add_table_tab_items(
  p_tab uuid,
  p_lines jsonb,
  p_user uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tab table_tabs%rowtype;
  v_line jsonb;
  v_dish dishes%rowtype;
  v_qty int;
  v_note text;
begin
  if not is_server() then
    raise exception 'forbidden';
  end if;

  select * into v_tab from table_tabs where id = p_tab for update;
  if not found then
    raise exception 'tab_not_found';
  end if;
  if v_tab.status <> 'open' then
    raise exception 'tab_closed';
  end if;

  if not exists (select 1 from businesses where id = v_tab.business_id and is_open) then
    raise exception 'closed';
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array'
     or jsonb_array_length(p_lines) = 0
     or jsonb_array_length(p_lines) > 50 then
    raise exception 'invalid_items';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_qty := (v_line->>'qty')::int;
    v_note := nullif(trim(coalesce(v_line->>'note', '')), '');

    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'invalid_quantity';
    end if;
    if v_note is not null and char_length(v_note) > 140 then
      raise exception 'note_too_long';
    end if;

    select * into v_dish
    from dishes
    where id = (v_line->>'dish_id')::uuid and business_id = v_tab.business_id;

    if not found or v_dish.archived then
      raise exception 'dish_not_found';
    end if;
    if v_dish.sold_out then
      raise exception 'sold_out' using detail = v_dish.id::text;
    end if;

    insert into table_tab_items (tab_id, business_id, dish_id, qty, price_cents, note, added_by)
    values (v_tab.id, v_tab.business_id, v_dish.id, v_qty, v_dish.price_cents, v_note, p_user);
  end loop;

  -- Descuenta todo junto; si falta algo, se deshace la orden completa.
  perform take_stock(
    v_tab.business_id,
    (select jsonb_agg(jsonb_build_object('dish_id', l->>'dish_id', 'qty', (l->>'qty')::int))
     from jsonb_array_elements(p_lines) l)
  );
end;
$$;

-- ------------------------------------------
-- Cancelar un platillo de la cuenta
-- ------------------------------------------

create or replace function cancel_table_tab_item(
  p_item uuid,
  p_user uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item table_tab_items%rowtype;
  v_status text;
begin
  if not is_server() then
    raise exception 'forbidden';
  end if;

  select * into v_item from table_tab_items where id = p_item for update;
  if not found then
    raise exception 'item_not_found';
  end if;

  select status into v_status from table_tabs where id = v_item.tab_id for update;
  if v_status <> 'open' then
    raise exception 'tab_closed';
  end if;

  if v_item.cancelled_at is not null then
    return;
  end if;

  -- Si ya se pagó parte, la cuenta no puede quedar debajo de lo pagado.
  if (
    select coalesce(sum(qty * price_cents), 0)
    from table_tab_items
    where tab_id = v_item.tab_id and cancelled_at is null and id <> v_item.id
  ) < (
    select coalesce(sum(total_cents), 0) from sales where table_tab_id = v_item.tab_id
  ) then
    raise exception 'already_paid';
  end if;

  update table_tab_items
  set cancelled_at = now(), cancelled_by = p_user
  where id = p_item;

  perform give_back_stock(
    v_item.business_id,
    jsonb_build_array(jsonb_build_object('dish_id', v_item.dish_id, 'qty', v_item.qty))
  );
end;
$$;

-- ------------------------------------------
-- Cobrar la cuenta, completa o en varios pagos
--
-- Cada pago es una venta (sales) con su método y su monto, ligada a la
-- cuenta con table_tab_id. p_amount null = lo que falta. El pago que
-- completa el total cierra la cuenta y lleva los platillos (sale_items),
-- así cada platillo se cuenta una sola vez en el corte.
-- ------------------------------------------

drop function if exists pay_table_tab(uuid, text, uuid);

create or replace function pay_table_tab(
  p_tab uuid,
  p_method text,
  p_user uuid default null,
  p_amount int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tab table_tabs%rowtype;
  v_day uuid;
  v_sale uuid;
  v_total int;
  v_paid int;
  v_amount int;
begin
  if not is_server() then
    raise exception 'forbidden';
  end if;

  if p_method is null or p_method not in ('cash', 'card', 'transfer') then
    raise exception 'invalid_payment_method';
  end if;

  select * into v_tab from table_tabs where id = p_tab for update;
  if not found then
    raise exception 'tab_not_found';
  end if;
  if v_tab.status <> 'open' then
    raise exception 'tab_closed';
  end if;

  if not exists (select 1 from table_tab_items where tab_id = p_tab and cancelled_at is null) then
    raise exception 'empty_tab';
  end if;

  select coalesce(sum(qty * price_cents), 0) into v_total
  from table_tab_items
  where tab_id = p_tab and cancelled_at is null;

  select coalesce(sum(total_cents), 0) into v_paid
  from sales
  where table_tab_id = p_tab;

  v_amount := coalesce(p_amount, v_total - v_paid);
  if v_amount <= 0 or v_amount > v_total - v_paid then
    raise exception 'invalid_amount';
  end if;

  select id into v_day
  from days
  where business_id = v_tab.business_id and closed_at is null
  order by opened_at desc
  limit 1;

  insert into sales (business_id, day_id, method, total_cents, table_tab_id)
  values (v_tab.business_id, v_day, p_method::payment_method, v_amount, v_tab.id)
  returning id into v_sale;

  if v_paid + v_amount = v_total then
    -- Un renglón por platillo. Si el precio cambió a media cuenta, se
    -- guarda el promedio.
    insert into sale_items (sale_id, dish_id, qty, price_cents)
    select v_sale, dish_id, sum(qty), round(sum(qty * price_cents)::numeric / sum(qty))::int
    from table_tab_items
    where tab_id = p_tab and cancelled_at is null
    group by dish_id;

    update table_tabs
    set status = 'paid', closed_at = now(), closed_by = p_user, sale_id = v_sale
    where id = p_tab;
  end if;

  update businesses set updated_at = now() where id = v_tab.business_id;

  return v_sale;
end;
$$;

-- ------------------------------------------
-- Cancelar la cuenta completa (se fueron sin pedir, error, etc.)
-- Regresa al inventario lo que no se había cancelado.
-- ------------------------------------------

create or replace function cancel_table_tab(
  p_tab uuid,
  p_user uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tab table_tabs%rowtype;
  v_lines jsonb;
begin
  if not is_server() then
    raise exception 'forbidden';
  end if;

  select * into v_tab from table_tabs where id = p_tab for update;
  if not found then
    raise exception 'tab_not_found';
  end if;
  if v_tab.status <> 'open' then
    raise exception 'tab_closed';
  end if;

  if exists (select 1 from sales where table_tab_id = p_tab) then
    raise exception 'has_payments';
  end if;

  select jsonb_agg(jsonb_build_object('dish_id', dish_id, 'qty', qty))
  into v_lines
  from table_tab_items
  where tab_id = p_tab and cancelled_at is null;

  update table_tab_items
  set cancelled_at = now(), cancelled_by = p_user
  where tab_id = p_tab and cancelled_at is null;

  if v_lines is not null then
    perform give_back_stock(v_tab.business_id, v_lines);
  end if;

  update table_tabs
  set status = 'cancelled', closed_at = now(), closed_by = p_user
  where id = p_tab;
end;
$$;

revoke execute on function open_table_tab(uuid, uuid, int, uuid) from public, anon, authenticated;
revoke execute on function add_table_tab_items(uuid, jsonb, uuid) from public, anon, authenticated;
revoke execute on function cancel_table_tab_item(uuid, uuid) from public, anon, authenticated;
revoke execute on function pay_table_tab(uuid, text, uuid, int) from public, anon, authenticated;
revoke execute on function cancel_table_tab(uuid, uuid) from public, anon, authenticated;
grant execute on function open_table_tab(uuid, uuid, int, uuid) to service_role;
grant execute on function add_table_tab_items(uuid, jsonb, uuid) to service_role;
grant execute on function cancel_table_tab_item(uuid, uuid) to service_role;
grant execute on function pay_table_tab(uuid, text, uuid, int) to service_role;
grant execute on function cancel_table_tab(uuid, uuid) to service_role;
