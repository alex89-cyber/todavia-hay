-- ¿Todavía hay? · a public order number per reservation, counted from 1 each business day

alter table reservations add column if not exists order_number int;

create or replace function set_order_number()
returns trigger
language plpgsql set search_path = public as $$
declare
  v_since timestamptz;
begin
  if new.order_number is not null then return new; end if;
  select opened_at into v_since from days
  where business_id = new.business_id
  order by opened_at desc limit 1;
  select coalesce(max(order_number), 0) + 1 into new.order_number
  from reservations
  where business_id = new.business_id
    and created_at >= coalesce(v_since, '-infinity'::timestamptz);
  return new;
end $$;

drop trigger if exists reservations_order_number on reservations;
create trigger reservations_order_number
  before insert on reservations
  for each row execute function set_order_number();
