-- ==========================================
-- TODAVÍA HAY
-- 0020: PERMISOS DEL SERVIDOR EN TABLAS NUEVAS
-- ==========================================
--
-- En proyectos nuevos de Supabase, las tablas
-- creadas por SQL ya no reciben permisos
-- automáticos para la API. El servidor
-- (service_role) recibía "permission denied
-- for table table_tabs". Se dan permisos solo
-- a service_role; anon y authenticated siguen
-- sin acceso (RLS sin políticas).
--
-- Se puede correr varias veces.
-- ==========================================

grant select, insert, update, delete on table
  table_tabs,
  table_tab_items,
  restaurant_tables,
  dine_in_requests,
  inventory_purchases,
  inventory_purchase_items,
  business_expenses,
  platform_admins,
  platform_plan_audit
to service_role;

-- Que la API vea los permisos de inmediato.
notify pgrst, 'reload schema';
