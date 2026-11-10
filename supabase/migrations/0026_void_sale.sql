-- ==========================================
-- TODAVÍA HAY
-- 0026: ANULAR UNA VENTA RÁPIDA
-- ==========================================
--
-- "Anular venta" en el panel: para una venta
-- del cobro rápido hecha por error.
--
-- - Solo ventas del día abierto.
-- - Solo cobro rápido: las que vienen de un
--   apartado o de una mesa se manejan allá.
-- - Regresa el inventario de la receta.
-- - Borra la venta (y sus platillos en cascada),
--   así ya no cuenta en el corte.
--
-- Solo el servidor (service_role).
-- Se puede correr varias veces.
-- ==========================================

create or replace function void_sale(
  p_business uuid,
  p_sale uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale sales%rowtype;
  v_lines jsonb;
begin
  if not is_server() then
    raise exception 'forbidden';
  end if;

  select * into v_sale from sales
  where id = p_sale and business_id = p_business
  for update;

  if not found then
    raise exception 'sale_not_found';
  end if;

  if v_sale.reservation_id is not null or v_sale.table_tab_id is not null then
    raise exception 'sale_not_quick';
  end if;

  if v_sale.day_id is null or not exists (
    select 1 from days where id = v_sale.day_id and closed_at is null
  ) then
    raise exception 'sale_day_closed';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('dish_id', dish_id, 'qty', qty)),
    '[]'::jsonb
  )
  into v_lines
  from sale_items
  where sale_id = v_sale.id;

  perform give_back_stock(p_business, v_lines);

  delete from sales where id = v_sale.id;

  update businesses set updated_at = now() where id = p_business;
end;
$$;

revoke execute on function void_sale(uuid, uuid) from public, anon, authenticated;
grant execute on function void_sale(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
