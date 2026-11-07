-- ¿Todavía hay? · objetos que existían en el Supabase del hackathon
-- pero no tenían migración (se crearon a mano):
--   1. businesses.settings: la página del negocio (logo, portada, galería,
--      colores, horarios, ubicación, redes, orden de secciones).
--   2. close_day_with_snapshot: cierra el día y guarda la foto del corte
--      (days.cash_up, columna de 0003_cash_up_history) para el historial.
-- Se puede correr más de una vez.

alter table businesses
  add column if not exists settings jsonb;

create or replace function close_day_with_snapshot(p_business uuid, p_snapshot jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_day uuid;
begin
  if not can_manage(p_business) then raise exception 'forbidden'; end if;
  update days set closed_at = now(), cash_up = p_snapshot
  where business_id = p_business and closed_at is null
  returning id into v_day;
  update businesses set is_open = false, updated_at = now() where id = p_business;
  return v_day;
end $$;

