-- ¿Todavía hay? · a 4-digit code the customer says at the counter to pick up a reservation

alter table reservations add column if not exists pickup_code text;

-- Every new reservation gets a code no other active reservation of the stall is using.
create or replace function set_pickup_code()
returns trigger
language plpgsql set search_path = public as $$
declare
  v_code text;
begin
  if new.pickup_code is not null then return new; end if;
  loop
    v_code := lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not exists (
      select 1 from reservations
      where business_id = new.business_id
        and pickup_code = v_code
        and status in ('held', 'authorized')
    );
  end loop;
  new.pickup_code := v_code;
  return new;
end $$;

drop trigger if exists reservations_pickup_code on reservations;
create trigger reservations_pickup_code
  before insert on reservations
  for each row execute function set_pickup_code();
