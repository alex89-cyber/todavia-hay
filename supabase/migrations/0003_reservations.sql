-- ¿Todavía hay? · reservations made by the agent
-- Stock is taken when the customer reserves, so the public page and the
-- owner's panel already count it; it goes back if the hold is voided or expires.

-- Lines: [{"dish_id": "...", "qty": 2}, ...]
create or replace function reserve(p_business uuid, p_customer text, p_lines jsonb, p_pickup_by timestamptz)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not can_manage(p_business) then raise exception 'forbidden'; end if;
  if not exists (select 1 from businesses where id = p_business and is_open) then
    raise exception 'closed';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) l
    join dishes d on d.id = (l->>'dish_id')::uuid
    where d.business_id = p_business and d.sold_out
  ) then
    raise exception 'insufficient_stock' using detail = 'sold_out';
  end if;

  perform take_stock(p_business, p_lines);

  insert into reservations (business_id, customer_name, pickup_by, total_cents)
  select p_business, left(p_customer, 80), p_pickup_by, coalesce(sum(d.price_cents * (l->>'qty')::int), 0)
  from jsonb_array_elements(p_lines) l
  join dishes d on d.id = (l->>'dish_id')::uuid and d.business_id = p_business
  returning id into v_id;

  insert into reservation_items (reservation_id, dish_id, qty)
  select v_id, d.id, (l->>'qty')::int
  from jsonb_array_elements(p_lines) l
  join dishes d on d.id = (l->>'dish_id')::uuid and d.business_id = p_business;

  update businesses set updated_at = now() where id = p_business;
  return v_id;
end $$;

-- held/authorized → voided/expired, stock back. Returns false if already finished.
create or replace function release_reservation(p_reservation uuid, p_status reservation_status)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid;
  v_lines jsonb;
begin
  if p_status not in ('voided', 'expired') then raise exception 'bad_status'; end if;
  select business_id into v_business from reservations where id = p_reservation;
  if v_business is null or not can_manage(v_business) then raise exception 'forbidden'; end if;

  update reservations set status = p_status, updated_at = now()
  where id = p_reservation and status in ('held', 'authorized');
  if not found then return false; end if;

  select jsonb_agg(jsonb_build_object('dish_id', dish_id, 'qty', qty)) into v_lines
  from reservation_items where reservation_id = p_reservation;
  perform give_back_stock(v_business, v_lines);

  update businesses set updated_at = now() where id = v_business;
  return true;
end $$;

-- authorized → captured: the PayPal payment was taken, so it becomes a sale.
-- Stock was already taken when reserving. Returns the sale id, or null.
create or replace function deliver_reservation(p_reservation uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_res reservations;
  v_day uuid;
  v_sale uuid;
begin
  select * into v_res from reservations where id = p_reservation;
  if v_res.id is null or not can_manage(v_res.business_id) then raise exception 'forbidden'; end if;

  update reservations set status = 'captured', updated_at = now()
  where id = p_reservation and status = 'authorized';
  if not found then return null; end if;

  select id into v_day from days
  where business_id = v_res.business_id and closed_at is null
  order by opened_at desc limit 1;

  insert into sales (business_id, day_id, method, total_cents, reservation_id)
  values (v_res.business_id, v_day, 'paypal', v_res.total_cents, v_res.id)
  returning id into v_sale;

  insert into sale_items (sale_id, dish_id, qty, price_cents)
  select v_sale, ri.dish_id, ri.qty, d.price_cents
  from reservation_items ri join dishes d on d.id = ri.dish_id
  where ri.reservation_id = p_reservation;

  update businesses set updated_at = now() where id = v_res.business_id;
  return v_sale;
end $$;
