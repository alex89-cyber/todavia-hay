-- ==========================================
-- TODAVÍA HAY
-- 0021: SECCIONES DEL MENÚ
-- ==========================================
--
-- Cada negocio agrupa sus platillos en
-- secciones ("Tacos", "Bebidas"...). Un
-- platillo está en una sola sección; sin
-- sección se muestra al final en "Otros".
-- to_kitchen: si la sección se prepara en
-- cocina (lo usará la pantalla de cocina).
--
-- save_menu recibe un 4.º parámetro con las
-- secciones. La versión de 3 parámetros se
-- queda para que el código viejo siga
-- funcionando mientras se publica el nuevo.
--
-- Se puede correr varias veces.
-- ==========================================

create table if not exists menu_sections (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses (id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 1 and 60),
  to_kitchen   boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists menu_sections_business on menu_sections (business_id, sort);

alter table menu_sections enable row level security;

alter table dishes
  add column if not exists section_id uuid references menu_sections (id) on delete set null;

grant select, insert, update, delete on table menu_sections to service_role;

CREATE OR REPLACE FUNCTION public.save_menu(
  p_business uuid,
  p_ingredients jsonb,
  p_dishes jsonb,
  p_sections jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keys jsonb := '{}'::jsonb;
  v_ing jsonb;
  v_dish jsonb;
  v_item jsonb;
  v_id uuid;
  v_kept_ing uuid[] := '{}';
  v_kept_dish uuid[] := '{}';
  v_sort int := 0;
  v_sec jsonb;
  v_sec_keys jsonb := '{}'::jsonb;
  v_kept_sec uuid[] := '{}';
  v_sec_sort int := 0;

BEGIN

  IF NOT can_manage(p_business) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- ==========================================
  -- INGREDIENTES
  -- ==========================================

  FOR v_ing IN
    SELECT *
    FROM jsonb_array_elements(p_ingredients)
  LOOP

    v_id := NULL;

    IF (v_ing->>'key') !~ '^new:' THEN

      UPDATE public.ingredients
      SET
        name = v_ing->>'name',
        unit = v_ing->>'unit',
        archived = false
      WHERE
        id = (v_ing->>'key')::uuid
        AND business_id = p_business
      RETURNING id INTO v_id;

    END IF;

    IF v_id IS NULL THEN

      INSERT INTO public.ingredients (
        business_id,
        name,
        unit,
        stock
      )
      VALUES (
        p_business,
        v_ing->>'name',
        v_ing->>'unit',
        0
      )
      RETURNING id INTO v_id;

    END IF;

    v_keys := v_keys ||
      jsonb_build_object(
        v_ing->>'key',
        v_id::text
      );

    v_kept_ing := v_kept_ing || v_id;

  END LOOP;

  -- Archivar ingredientes eliminados.

  UPDATE public.ingredients
  SET archived = true
  WHERE
    business_id = p_business
    AND NOT archived
    AND NOT (id = ANY(v_kept_ing));

  -- ==========================================
  -- SECCIONES (NULL = no tocarlas)
  -- ==========================================

  IF p_sections IS NOT NULL THEN

    FOR v_sec IN
      SELECT *
      FROM jsonb_array_elements(p_sections)
    LOOP

      v_sec_sort := v_sec_sort + 1;
      v_id := NULL;

      IF (v_sec->>'key') !~ '^new:' THEN

        UPDATE public.menu_sections
        SET
          name = TRIM(v_sec->>'name'),
          to_kitchen = COALESCE((v_sec->>'to_kitchen')::boolean, true),
          sort = v_sec_sort
        WHERE
          id = (v_sec->>'key')::uuid
          AND business_id = p_business
        RETURNING id INTO v_id;

      END IF;

      IF v_id IS NULL THEN

        INSERT INTO public.menu_sections (
          business_id,
          name,
          to_kitchen,
          sort
        )
        VALUES (
          p_business,
          TRIM(v_sec->>'name'),
          COALESCE((v_sec->>'to_kitchen')::boolean, true),
          v_sec_sort
        )
        RETURNING id INTO v_id;

      END IF;

      v_sec_keys := v_sec_keys ||
        jsonb_build_object(
          v_sec->>'key',
          v_id::text
        );

      v_kept_sec := v_kept_sec || v_id;

    END LOOP;

    -- Secciones borradas: sus platillos pasan a "Otros".
    DELETE FROM public.menu_sections
    WHERE
      business_id = p_business
      AND NOT (id = ANY(v_kept_sec));

  END IF;

  -- ==========================================
  -- PLATILLOS
  -- ==========================================

  FOR v_dish IN
    SELECT *
    FROM jsonb_array_elements(p_dishes)
  LOOP

    v_sort := v_sort + 1;
    v_id := NULL;

    -- Actualizar platillo existente.

    IF COALESCE(v_dish->>'id', '') <> '' THEN

      UPDATE public.dishes
      SET
        name_es = v_dish->>'name_es',
        name_en = v_dish->>'name_en',

        -- Guardar fotografía si se recibió.
        -- Si no se envía image_url, conservar la anterior.
        image_url = CASE
          WHEN v_dish ? 'image_url'
          THEN NULLIF(
            TRIM(v_dish->>'image_url'),
            ''
          )
          ELSE image_url
        END,

        price_cents =
          (v_dish->>'price_cents')::int,
        sort = v_sort,
        section_id = CASE
          WHEN p_sections IS NULL THEN section_id
          ELSE (v_sec_keys->>(v_dish->>'section'))::uuid
        END,
        archived = false
      WHERE
        id = (v_dish->>'id')::uuid
        AND business_id = p_business
      RETURNING id INTO v_id;

    END IF;

    -- Crear platillo nuevo.

    IF v_id IS NULL THEN

      INSERT INTO public.dishes (
        business_id,
        name_es,
        name_en,
        image_url,
        price_cents,
        sort,
        section_id
      )
      VALUES (
        p_business,
        v_dish->>'name_es',
        v_dish->>'name_en',
        NULLIF(
          TRIM(v_dish->>'image_url'),
          ''
        ),
        (v_dish->>'price_cents')::int,
        v_sort,
        CASE
          WHEN p_sections IS NULL THEN NULL
          ELSE (v_sec_keys->>(v_dish->>'section'))::uuid
        END
      )
      RETURNING id INTO v_id;

    END IF;

    -- ========================================
    -- RECETAS
    -- ========================================

    DELETE FROM public.recipe_items
    WHERE dish_id = v_id;

    FOR v_item IN
      SELECT *
      FROM jsonb_array_elements(
        COALESCE(
          v_dish->'recipe',
          '[]'::jsonb
        )
      )
    LOOP

      IF v_keys ? (v_item->>'ingredient') THEN

        INSERT INTO public.recipe_items (
          dish_id,
          ingredient_id,
          qty
        )
        VALUES (
          v_id,
          (
            v_keys->>(
              v_item->>'ingredient'
            )
          )::uuid,
          (v_item->>'qty')::numeric
        )
        ON CONFLICT (
          dish_id,
          ingredient_id
        )
        DO UPDATE SET
          qty = EXCLUDED.qty;

      END IF;

    END LOOP;

    v_kept_dish := v_kept_dish || v_id;

  END LOOP;

  -- Archivar platillos eliminados.

  UPDATE public.dishes
  SET archived = true
  WHERE
    business_id = p_business
    AND NOT archived
    AND NOT (id = ANY(v_kept_dish));

  UPDATE public.businesses
  SET updated_at = NOW()
  WHERE id = p_business;

END;
$$;

revoke all on function public.save_menu(uuid, jsonb, jsonb, jsonb) from public;
revoke all on function public.save_menu(uuid, jsonb, jsonb, jsonb) from anon, authenticated;
grant execute on function public.save_menu(uuid, jsonb, jsonb, jsonb) to service_role;

-- Que la API vea la tabla y la función de inmediato.
notify pgrst, 'reload schema';
