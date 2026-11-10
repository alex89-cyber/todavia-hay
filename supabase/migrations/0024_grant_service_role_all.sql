-- ==========================================
-- TODAVÍA HAY
-- 0024: PERMISOS COMPLETOS DEL SERVIDOR
-- ==========================================
--
-- "Marcar agotado" fallaba con
-- "permission denied for table dishes":
-- el servidor (service_role) no tenía permiso
-- de UPDATE en una tabla vieja. 0020 solo cubrió
-- tablas nuevas. Aquí se dan los permisos a
-- TODAS las tablas del esquema public, y a las
-- que se creen después.
--
-- Solo service_role (el servidor). anon y
-- authenticated no cambian.
-- Se puede correr varias veces.
-- ==========================================

grant usage on schema public to service_role;

grant select, insert, update, delete
  on all tables in schema public
  to service_role;

grant usage, select, update
  on all sequences in schema public
  to service_role;

grant execute
  on all functions in schema public
  to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select, update on sequences to service_role;

alter default privileges in schema public
  grant execute on functions to service_role;

-- Que la API vea los permisos de inmediato.
notify pgrst, 'reload schema';
