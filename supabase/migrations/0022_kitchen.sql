-- ==========================================
-- TODAVÍA HAY
-- 0022: COCINA (PLAN PLUS)
-- ==========================================
--
-- Cada vez que el mesero envía platillos de
-- una mesa en un negocio Plus, se crea una
-- comanda (kitchen_tickets) con los platillos
-- cuyas secciones "se preparan en cocina"
-- (los que no tienen sección también van).
--
-- Pasos: pending → ready → served.
-- Quitar un platillo:
--   - comanda pendiente: se tacha y regresa
--     al inventario;
--   - comanda lista o servida: ya se preparó,
--     es merma y NO regresa al inventario.
--
-- Los apartados (recoger) no usan esta tabla:
-- la pantalla de cocina los toma de
-- reservations con las etapas de Recoger.
--
-- Se puede correr varias veces.
-- ==========================================

create table if not exists kitchen_tickets (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses (id) on delete cascade,
  table_tab_id  uuid not null references table_tabs (id) on delete cascade,
  label         text not null,
  status        text not null default 'pending'
    check (status in ('pending', 'ready', 'served', 'cancelled')),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  ready_at      timestamptz,
  ready_by      uuid references auth.users (id) on delete set null,
  served_at     timestamptz,
  served_by     uuid references auth.users (id) on delete set null
);

create index if not exists kitchen_tickets_open
  on kitchen_tickets (business_id, status, created_at);
create index if not exists kitchen_tickets_tab on kitchen_tickets (table_tab_id);

alter table kitchen_tickets enable row level security;

alter table table_tab_items
  add column if not exists ticket_id uuid references kitchen_tickets (id) on delete set null;

grant select, insert, update, delete on table kitchen_tickets to service_role;

-- ------------------------------------------
-- ¿Ya se preparó? (comanda lista o servida)
-- ------------------------------------------

create or replace function tab_item_prepared(p_ticket uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_ticket is not null and exists (
    select 1 from kitchen_tickets
    where id = p_ticket and status in ('ready', 'served')
  );
$$;

-- ------------------------------------------
-- Agregar platillos (igual que 0019, más la comanda en Plus)
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
  v_plus boolean;
  v_ticket uuid;
  v_kitchen boolean;
  v_item uuid;
  v_sent int := 0;
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

  select plan = 'plus' into v_plus from businesses where id = v_tab.business_id;

  if v_plus then
    insert into kitchen_tickets (business_id, table_tab_id, label, created_by)
    values (v_tab.business_id, v_tab.id, v_tab.table_label, p_user)
    returning id into v_ticket;
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

    -- Sin sección = sí va a cocina.
    v_kitchen := v_plus and coalesce(
      (select to_kitchen from menu_sections where id = v_dish.section_id),
      true
    );

    insert into table_tab_items (tab_id, business_id, dish_id, qty, price_cents, note, added_by, ticket_id)
    values (
      v_tab.id, v_tab.business_id, v_dish.id, v_qty, v_dish.price_cents, v_note, p_user,
      case when v_kitchen then v_ticket else null end
    )
    returning id into v_item;

    if v_kitchen then
      v_sent := v_sent + 1;
    end if;
  end loop;

  -- Si todo era de secciones que no pasan por cocina, no hay comanda.
  if v_ticket is not null and v_sent = 0 then
    delete from kitchen_tickets where id = v_ticket;
  end if;

  -- Descuenta todo junto; si falta algo, se deshace la orden completa.
  perform take_stock(
    v_tab.business_id,
    (select jsonb_agg(jsonb_build_object('dish_id', l->>'dish_id', 'qty', (l->>'qty')::int))
     from jsonb_array_elements(p_lines) l)
  );
end;
$$;

-- ------------------------------------------
-- Quitar un platillo de la cuenta
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

  -- Ya preparado = merma: no regresa al inventario.
  if not tab_item_prepared(v_item.ticket_id) then
    perform give_back_stock(
      v_item.business_id,
      jsonb_build_array(jsonb_build_object('dish_id', v_item.dish_id, 'qty', v_item.qty))
    );
  end if;

  -- Comanda pendiente sin platillos vivos: se cancela.
  if v_item.ticket_id is not null then
    update kitchen_tickets
    set status = 'cancelled'
    where id = v_item.ticket_id
      and status = 'pending'
      and not exists (
        select 1 from table_tab_items
        where ticket_id = v_item.ticket_id and cancelled_at is null
      );
  end if;
end;
$$;

-- ------------------------------------------
-- Cancelar toda la cuenta (sin pagos)
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

  -- Solo regresa al inventario lo que no se preparó.
  select jsonb_agg(jsonb_build_object('dish_id', dish_id, 'qty', qty))
  into v_lines
  from table_tab_items
  where tab_id = p_tab and cancelled_at is null and not tab_item_prepared(ticket_id);

  update table_tab_items
  set cancelled_at = now(), cancelled_by = p_user
  where tab_id = p_tab and cancelled_at is null;

  if v_lines is not null then
    perform give_back_stock(v_tab.business_id, v_lines);
  end if;

  update kitchen_tickets
  set status = 'cancelled'
  where table_tab_id = p_tab and status = 'pending';

  update table_tabs
  set status = 'cancelled', closed_at = now(), closed_by = p_user
  where id = p_tab;
end;
$$;

-- ------------------------------------------
-- Cocina marca lista / mesero marca servida
-- ------------------------------------------

create or replace function mark_kitchen_ticket(
  p_ticket uuid,
  p_business uuid,
  p_status text,
  p_user uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket kitchen_tickets%rowtype;
begin
  if not is_server() then
    raise exception 'forbidden';
  end if;

  select * into v_ticket
  from kitchen_tickets
  where id = p_ticket and business_id = p_business
  for update;
  if not found then
    raise exception 'ticket_not_found';
  end if;

  if p_status = 'ready' then
    if v_ticket.status <> 'pending' then
      raise exception 'ticket_not_pending';
    end if;
    update kitchen_tickets
    set status = 'ready', ready_at = now(), ready_by = p_user
    where id = p_ticket;
  elsif p_status = 'served' then
    if v_ticket.status <> 'ready' then
      raise exception 'ticket_not_ready';
    end if;
    update kitchen_tickets
    set status = 'served', served_at = now(), served_by = p_user
    where id = p_ticket;
  else
    raise exception 'invalid_status';
  end if;
end;
$$;

revoke execute on function tab_item_prepared(uuid) from public, anon, authenticated;
revoke execute on function add_table_tab_items(uuid, jsonb, uuid) from public, anon, authenticated;
revoke execute on function cancel_table_tab_item(uuid, uuid) from public, anon, authenticated;
revoke execute on function cancel_table_tab(uuid, uuid) from public, anon, authenticated;
revoke execute on function mark_kitchen_ticket(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function tab_item_prepared(uuid) to service_role;
grant execute on function add_table_tab_items(uuid, jsonb, uuid) to service_role;
grant execute on function cancel_table_tab_item(uuid, uuid) to service_role;
grant execute on function cancel_table_tab(uuid, uuid) to service_role;
grant execute on function mark_kitchen_ticket(uuid, uuid, text, uuid) to service_role;

-- Que la API vea la tabla y las funciones de inmediato.
notify pgrst, 'reload schema';
