-- Cuentas: dueños por invitación (varios por negocio), clientes con nombre y
-- apellido, apartados ligados a la cuenta y sellos que pasan a la cuenta.
-- Las tarjetas de sellos de una cuenta usan payer_id = 'user:<uuid>'.

-- ------------------------------------------
-- Perfiles
-- ------------------------------------------

create table if not exists profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text not null default '',
  last_name   text not null default '',
  -- Últimos 10 dígitos; los sellos del mostrador con este teléfono van a la cuenta.
  phone       text unique check (phone is null or phone ~ '^[0-9]{10}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table profiles enable row level security;
drop policy if exists own_profile on profiles;
create policy own_profile on profiles for select using (id = auth.uid());

-- Nombre y apellido salen de lo que escribió al registrarse, o del nombre de Google.
create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full text := trim(coalesce(v_meta->>'full_name', v_meta->>'name', ''));
  v_first text := trim(coalesce(v_meta->>'first_name', v_meta->>'given_name', ''));
  v_last text := trim(coalesce(v_meta->>'last_name', v_meta->>'family_name', ''));
begin
  if v_first = '' and v_full <> '' then
    v_first := split_part(v_full, ' ', 1);
    v_last := trim(substr(v_full, length(split_part(v_full, ' ', 1)) + 1));
  end if;
  insert into profiles (id, first_name, last_name)
  values (new.id, left(v_first, 60), left(v_last, 60))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Usuarios que ya existían antes de esta migración.
insert into profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ------------------------------------------
-- Quién administra cada negocio
-- ------------------------------------------

create table if not exists business_members (
  business_id  uuid not null references businesses (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'owner' check (role in ('owner', 'staff')),
  created_at   timestamptz not null default now(),
  primary key (business_id, user_id)
);

alter table business_members enable row level security;
drop policy if exists own_membership on business_members;
create policy own_membership on business_members for select using (user_id = auth.uid());

-- El dueño original de cada negocio también es miembro.
insert into business_members (business_id, user_id, role)
select id, owner_id, 'owner' from businesses where owner_id is not null
on conflict do nothing;

-- Borrar la cuenta de un dueño ya no borra su negocio (antes era on delete cascade).
alter table businesses drop constraint if exists businesses_owner_id_fkey;
alter table businesses
  add constraint businesses_owner_id_fkey foreign key (owner_id) references auth.users (id) on delete set null;

-- owns() ahora cuenta a todos los miembros.
create or replace function owns(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from businesses where id = b and owner_id = auth.uid())
      or exists (select 1 from business_members where business_id = b and user_id = auth.uid())
$$;

-- ------------------------------------------
-- Apartados de una cuenta
-- ------------------------------------------

alter table reservations
  add column if not exists customer_id uuid references auth.users (id) on delete set null;

create index if not exists reservations_customer_idx
  on reservations (customer_id, created_at desc)
  where customer_id is not null;

-- ------------------------------------------
-- Pasar los sellos de una tarjeta a otra (teléfono → cuenta)
-- ------------------------------------------

create or replace function merge_stamp_cards(p_from text, p_to text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_card record;
  v_moved int := 0;
begin
  if not is_server() then
    raise exception 'server only';
  end if;
  if p_from = p_to then
    return 0;
  end if;

  for v_card in
    select * from stamp_cards where payer_id = p_from for update
  loop
    insert into stamp_cards (business_id, payer_id, stamps, rewards_redeemed, updated_at)
    values (v_card.business_id, p_to, v_card.stamps, v_card.rewards_redeemed, now())
    on conflict (business_id, payer_id) do update
      set stamps = stamp_cards.stamps + excluded.stamps,
          rewards_redeemed = stamp_cards.rewards_redeemed + excluded.rewards_redeemed,
          updated_at = now();

    -- El historial sigue a la tarjeta (stamp_events y loyalty_rewards, si existen).
    if to_regclass('public.stamp_events') is not null then
      execute 'update stamp_events set payer_id = $1 where business_id = $2 and payer_id = $3'
        using p_to, v_card.business_id, p_from;
    end if;
    if to_regclass('public.loyalty_rewards') is not null then
      begin
        execute 'update loyalty_rewards set payer_id = $1 where business_id = $2 and payer_id = $3'
          using p_to, v_card.business_id, p_from;
      exception when undefined_column then
        null;
      end;
    end if;

    delete from stamp_cards where business_id = v_card.business_id and payer_id = p_from;
    v_moved := v_moved + 1;
  end loop;

  return v_moved;
end;
$$;

revoke all on function merge_stamp_cards(text, text) from public, anon, authenticated;
grant execute on function merge_stamp_cards(text, text) to service_role;
