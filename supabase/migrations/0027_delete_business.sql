-- ==========================================
-- 0027: BORRAR UN NEGOCIO DESDE EL PORTAL DE SOCIOS
-- ==========================================
--
-- Borra el negocio y TODO su historial (ventas,
-- apartados, mesas, compras, gastos, menú,
-- inventario y personal). Las cuentas de las
-- personas (dueño, empleados, clientes) NO se
-- borran: solo pierden el acceso a este negocio.
--
-- Varias tablas apuntan a otras sin "on delete
-- cascade", así que se borran en orden.
-- Solo el servidor (service_role) puede llamarla.
-- ==========================================

create or replace function delete_business(p_business uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_server() then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from businesses where id = p_business) then
    raise exception 'business_not_found';
  end if;

  -- Ventas primero: apuntan a apartados y platillos.
  delete from sales where business_id = p_business;

  -- Mesas abiertas o cerradas (sus platillos y comandas
  -- se van en cascada).
  update reservations set table_tab_id = null where business_id = p_business;
  delete from table_tabs where business_id = p_business;
  delete from dine_in_requests where business_id = p_business;

  delete from reservations where business_id = p_business;

  -- Compras de insumos y gastos.
  delete from inventory_purchase_items
   where purchase_id in (
     select id from inventory_purchases where business_id = p_business
   );
  delete from inventory_purchases where business_id = p_business;
  delete from business_expenses where business_id = p_business;

  delete from reward_pin_redemptions where business_id = p_business;
  delete from platform_plan_audit where business_id = p_business;

  -- Lo demás (menú, inventario, mesas, personal,
  -- sellos, cortes…) se borra en cascada.
  delete from businesses where id = p_business;
end;
$$;

revoke all on function delete_business(uuid) from public, anon, authenticated;
grant execute on function delete_business(uuid) to service_role;

notify pgrst, 'reload schema';
