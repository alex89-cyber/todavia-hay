
-- ====================================================
-- ¿TODAVÍA HAY?
-- 0007_dish_images.sql
-- Fotografías de platillos
-- ====================================================

-- 1. Agregar la columna para guardar la imagen.

ALTER TABLE public.dishes
ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Crear bucket para fotografías.
-- Las imágenes pueden verse públicamente,
-- pero no se habilitan subidas anónimas.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'dish-images',
  'dish-images',
  true,
  5242880,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 3. Permitir la lectura pública de fotografías.

DROP POLICY IF EXISTS
  "Public can view dish images"
ON storage.objects;

CREATE POLICY
  "Public can view dish images"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'dish-images'
);

-- 4. Actualizar la función de guardado de menú.
-- Conserva la lógica de ingredientes, recetas
-- y archivado de la migración 0006.

CREATE OR REPLACE FUNCTION public.save_menu(
  p_business uuid,
  p_ingredients jsonb,
  p_dishes jsonb
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
        sort
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
        v_sort
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

-- 5. Restringir ejecución al servidor.

REVOKE ALL ON FUNCTION public.save_menu(
  uuid, jsonb, jsonb
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.save_menu(
  uuid, jsonb, jsonb
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_menu(
  uuid, jsonb, jsonb
) TO service_role;

-- 6. Comprobar que existe la función.

SELECT
  n.nspname AS schema_name,
  p.proname AS function_name
FROM pg_proc AS p
JOIN pg_namespace AS n
  ON n.oid = p.pronamespace
WHERE
  n.nspname = 'public'
  AND p.proname = 'save_menu';
