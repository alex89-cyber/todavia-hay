-- ¿Todavía hay? · restock during the day, and stamps for counter sales

-- A card belongs to a PayPal payer id or to a phone ("tel:5512345678"). The
-- label is what the owner sees: the customer's name or phone.
alter table stamp_cards add column if not exists label text;

-- Adds stock to ingredients mid-day: {"<ingredient_id>": 2000, ...}. The day's
-- opening count grows by the same amount so the cash-up still reports usage.
-- Dishes made from a restocked ingredient lose their "sold out" mark.
create or replace function restock(p_business uuid, p_adds jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_adds jsonb;
begin
  if not can_manage(p_business) then raise exception 'forbidden'; end if;
  if not exists (select 1 from businesses where id = p_business and is_open) then
    raise exception 'closed';
  end if;

  select coalesce(jsonb_object_agg(i.id::text, (e.value)::numeric), '{}'::jsonb) into v_adds
  from jsonb_each_text(p_adds) e
  join ingredients i on i.id::text = e.key and i.business_id = p_business
  where (e.value)::numeric > 0;
  if v_adds = '{}'::jsonb then return; end if;

  update ingredients i set stock = i.stock + (v_adds->>i.id::text)::numeric
  where i.business_id = p_business and v_adds ? i.id::text;

  update days d set opening_count = d.opening_count || (
    select jsonb_object_agg(e.key, coalesce((d.opening_count->>e.key)::numeric, 0) + (e.value)::numeric)
    from jsonb_each_text(v_adds) e
  )
  where d.business_id = p_business and d.closed_at is null;

  update dishes set sold_out = false
  where business_id = p_business and sold_out
    and id in (select dish_id from recipe_items where v_adds ? ingredient_id::text);

  update businesses set updated_at = now() where id = p_business;
end $$;

-- One stamp on a card, creating it if needed. Returns the stamps it now has.
create or replace function add_stamp(p_business uuid, p_card text, p_label text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_stamps int;
begin
  if not can_manage(p_business) then raise exception 'forbidden'; end if;
  insert into stamp_cards (business_id, payer_id, stamps, label)
  values (p_business, p_card, 1, nullif(p_label, ''))
  on conflict (business_id, payer_id) do update
    set stamps = stamp_cards.stamps + 1,
        label = coalesce(nullif(p_label, ''), stamp_cards.label),
        updated_at = now()
  returning stamps into v_stamps;
  update businesses set updated_at = now() where id = p_business;
  return v_stamps;
end $$;

-- Same as 0004, plus the customer's name as the card's label.
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

  if v_res.payer_id is not null then
    insert into stamp_cards (business_id, payer_id, stamps, label)
    values (v_res.business_id, v_res.payer_id, 1, v_res.customer_name)
    on conflict (business_id, payer_id) do update
      set stamps = stamp_cards.stamps + 1, label = excluded.label, updated_at = now();
  end if;

  update businesses set updated_at = now() where id = v_res.business_id;
  return v_sale;
end $$;
