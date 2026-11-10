-- ==========================================
-- TODAVÍA HAY
-- 0025: INDICACIONES POR PLATILLO EN APARTADOS
-- ==========================================
--
-- El chatbot pregunta si cada platillo va
-- "con todo" y guarda lo que el cliente pida
-- quitar (ej. "sin cebolla") en la comanda.
--
-- - reservation_items.note: indicación del
--   cliente para ese platillo (máx. 140).
-- - seat_reservation: al sentar un apartado
--   "comer aquí", la nota pasa a la cuenta de
--   la mesa y a la comanda de cocina.
--
-- No cambia el inventario.
-- Se puede correr varias veces.
-- ==========================================

alter table reservation_items
  add column if not exists note text
  check (note is null or char_length(note) <= 140);

grant select, insert, update, delete on table reservation_items to service_role;

create or replace function seat_reservation(
  p_tab uuid,
  p_reservation uuid,
  p_user uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tab table_tabs%rowtype;
  v_res reservations%rowtype;
  v_plus boolean;
  v_ticket uuid;
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

  select * into v_res from reservations where id = p_reservation for update;
  if not found or v_res.business_id <> v_tab.business_id then
    raise exception 'reservation_not_found';
  end if;
  if v_res.status <> 'authorized' then
    raise exception 'reservation_not_active';
  end if;

  select plan = 'plus' into v_plus from businesses where id = v_tab.business_id;

  -- Plus: comanda para la cocina. Si ya estaba lista, queda servida
  -- (si luego quitan un platillo, ya se preparó: es merma).
  if v_plus then
    insert into kitchen_tickets (
      business_id, table_tab_id, label, status, created_by, created_at,
      ready_at, served_at, served_by
    )
    values (
      v_tab.business_id, v_tab.id, v_tab.table_label,
      case when v_res.ready_at is null then 'pending' else 'served' end,
      p_user,
      coalesce(v_res.ready_at, now()),
      v_res.ready_at,
      case when v_res.ready_at is null then null else now() end,
      case when v_res.ready_at is null then null else p_user end
    )
    returning id into v_ticket;
  end if;

  insert into table_tab_items (tab_id, business_id, dish_id, qty, price_cents, note, added_by, ticket_id)
  select
    v_tab.id, v_tab.business_id, d.id, ri.qty, d.price_cents, ri.note, p_user,
    case
      when v_plus and coalesce((select to_kitchen from menu_sections where id = d.section_id), true)
        then v_ticket
      else null
    end
  from reservation_items ri
  join dishes d on d.id = ri.dish_id
  where ri.reservation_id = v_res.id;

  if v_ticket is not null and not exists (
    select 1 from table_tab_items where ticket_id = v_ticket
  ) then
    delete from kitchen_tickets where id = v_ticket;
  end if;

  -- El apartado queda cerrado: la venta se registra al cobrar la mesa.
  update reservations
  set status = 'captured', table_tab_id = v_tab.id, updated_at = now()
  where id = v_res.id;

  if v_res.party_size is not null and v_res.party_size > v_tab.party_size then
    update table_tabs set party_size = v_res.party_size where id = v_tab.id;
  end if;

  update businesses set updated_at = now() where id = v_tab.business_id;
end;
$$;

revoke execute on function seat_reservation(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function seat_reservation(uuid, uuid, uuid) to service_role;

-- Que la API vea la columna de inmediato.
notify pgrst, 'reload schema';
