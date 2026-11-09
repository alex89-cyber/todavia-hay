
"use client";

import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import type { Dictionary } from "@/dictionaries";
import { fill } from "@/lib/format";
import type { OwnerView } from "@/lib/stall";

const UNITS = ["g", "kg", "ml", "l", "pz"] as const;

type Unit = (typeof UNITS)[number];

type IngredientRow = {
  key: string;
  name: string;
  unit: Unit;
};

type RecipeRow = {
  ingredient: string;
  qty: string;
};

type SectionRow = {
  key: string;
  name: string;
  toKitchen: boolean;
};

type DishRow = {
  rowKey: string;
  id: string | null;
  /** Clave de la sección; null = "Otros". */
  section: string | null;
  nameEs: string;
  nameEn: string;
  imageUrl: string | null;
  price: string;
  recipe: RecipeRow[];
};

type EditorState = {
  ingredients: IngredientRow[];
  sections: SectionRow[];
  dishes: DishRow[];
};

/** Platillos en el orden en que se ven: por sección y luego "Otros". */
function grouped(
  sections: SectionRow[],
  dishes: DishRow[],
): { section: SectionRow | null; dishes: DishRow[] }[] {
  const keys = new Set(sections.map((x) => x.key));
  return [
    ...sections.map((section) => ({
      section,
      dishes: dishes.filter((d) => d.section === section.key),
    })),
    {
      section: null,
      dishes: dishes.filter((d) => !d.section || !keys.has(d.section)),
    },
  ];
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

let seq = 0;

const newKey = () =>
  `new:${Date.now().toString(36)}${(seq++).toString(36)}`;

const asUnit = (unit: string): Unit =>
  ((UNITS as readonly string[]).includes(unit)
    ? unit
    : "pz") as Unit;

const input =
  "w-full min-w-0 rounded-xl border border-line bg-background px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10";

function fromView(view: OwnerView): EditorState {
  return {
    ingredients: view.ingredients.map((ingredient) => ({
      key: ingredient.id,
      name: ingredient.name,
      unit: asUnit(ingredient.unit),
    })),

    sections: (view.sections ?? []).map((section) => ({
      key: section.id,
      name: section.name,
      toKitchen: section.toKitchen,
    })),

    dishes: view.dishes.map((dish) => ({
      rowKey: dish.id,
      id: dish.id,
      section: dish.sectionId ?? null,
      nameEs: dish.nameEs,
      nameEn:
        dish.nameEn === dish.nameEs
          ? ""
          : dish.nameEn,
      imageUrl: dish.imageUrl ?? null,
      price: String(dish.priceCents / 100),
      recipe: dish.recipe.map((recipe) => ({
        ingredient: recipe.ingredientId,
        qty: String(recipe.qty),
      })),
    })),
  };
}

function PhotoEditor({
  slug,
  lang,
  dish,
  onImageChange,
}: {
  slug: string;
  lang: "es" | "en";
  dish: DishRow;
  onImageChange: (url: string | null) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const [success, setSuccess] = useState(false);

  const es = lang === "es";

  async function upload(file: File) {
    setError(null);
    setSuccess(false);
    setBroken(false);

    if (!IMAGE_TYPES.includes(file.type)) {
      setError(
        es
          ? "Usa una fotografía JPG, PNG o WebP."
          : "Please use a JPG, PNG or WebP photo.",
      );
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError(
        es
          ? "La fotografía debe pesar menos de 5 MB."
          : "The photo must be smaller than 5 MB.",
      );
      return;
    }

    if (file.size === 0) {
      setError(
        es
          ? "El archivo está vacío."
          : "The file is empty.",
      );
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `/api/stalls/${encodeURIComponent(slug)}/image`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (response.status === 401) {
        throw new Error(
          es
            ? "Tu sesión terminó. Vuelve a ingresar al panel."
            : "Your session expired. Please sign in again.",
        );
      }

      const result = await response.json().catch(
        () => null,
      );

      if (!response.ok || !result?.imageUrl) {
        throw new Error(
          es
            ? "No se pudo subir la fotografía. Revisa Supabase Storage."
            : "The photo could not be uploaded. Check Supabase Storage.",
        );
      }

      onImageChange(result.imageUrl);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : es
            ? "Error al subir la fotografía."
            : "Photo upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  function chooseFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    // Permite elegir otra vez el mismo archivo.
    event.target.value = "";

    if (file) {
      void upload(file);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-background p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">
            {es
              ? "Fotografía del platillo"
              : "Dish photo"}
          </h3>

          <p className="mt-1 text-xs text-muted">
            {es
              ? "Usa una foto real de tu platillo."
              : "Use a real photo of your dish."}
          </p>
        </div>

        {dish.imageUrl && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => {
              onImageChange(null);
              setSuccess(false);
              setError(null);
              setBroken(false);
            }}
            className="text-xs font-semibold text-bad underline disabled:opacity-50"
          >
            {es ? "Quitar foto" : "Remove photo"}
          </button>
        )}
      </div>

      <div className="relative mb-3 flex h-52 items-center justify-center overflow-hidden rounded-xl bg-surface sm:h-60">
        {dish.imageUrl && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={dish.imageUrl}
            src={dish.imageUrl}
            alt={dish.nameEs || "Platillo"}
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-center text-muted">
            <span className="text-4xl">📷</span>

            <span className="text-sm">
              {dish.imageUrl && broken
                ? es
                  ? "No se pudo mostrar la fotografía."
                  : "Photo could not be displayed."
                : es
                  ? "Todavía no hay fotografía"
                  : "No photo yet"}
            </span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/85">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
              <p className="text-sm font-semibold">
                {es
                  ? "Subiendo fotografía..."
                  : "Uploading photo..."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Abrir cámara trasera en dispositivos compatibles */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={chooseFile}
        disabled={uploading}
        className="hidden"
        aria-label={
          es ? "Tomar fotografía" : "Take photo"
        }
      />

      {/* Elegir archivo o imagen de la galería */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={chooseFile}
        disabled={uploading}
        className="hidden"
        aria-label={
          es ? "Elegir fotografía" : "Choose photo"
        }
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => cameraRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <span>📷</span>
          {es ? "Tomar foto" : "Take photo"}
        </button>

        <button
          type="button"
          disabled={uploading}
          onClick={() => galleryRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-bold transition hover:bg-background disabled:opacity-50"
        >
          <span>🖼️</span>
          {es ? "Elegir archivo" : "Choose file"}
        </button>
      </div>

      <p className="mt-3 text-xs text-muted">
        {es
          ? "JPG, PNG o WebP. Máximo 5 MB. Después presiona Guardar cambios."
          : "JPG, PNG or WebP. Maximum 5 MB. Then press Save changes."}
      </p>

      {success && (
        <p className="mt-2 text-sm font-semibold text-ok">
          {es
            ? "Fotografía subida. Guarda los cambios del menú."
            : "Photo uploaded. Save the menu changes."}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-2 text-sm font-semibold text-bad"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function MenuEditor({
  initial,
  lang,
  t,
}: {
  initial: OwnerView;
  lang: string;
  t: Dictionary;
}) {
  const m = t.menu;
  const es = lang === "es";
  const photoLang = es ? "es" : "en";

  const ui = {
    ingredient: es ? "Ingrediente" : "Ingredient",
    unit: es ? "Unidad de medida" : "Unit of measure",
    dishesDescription: es
      ? "Administra tus platillos, fotografías, precios y recetas."
      : "Manage your dishes, photos, prices and recipes.",
    dishNumber: es ? "PLATILLO" : "DISH",
    recipeDescription: es
      ? "Ingredientes y cantidades por porción."
      : "Ingredients and quantities per serving.",
    ingredientsCount: es ? "ingredientes" : "ingredients",
    dishesCount: es ? "platillos" : "dishes",
    sections: es ? "Secciones del menú" : "Menu sections",
    sectionsHint: es
      ? "Agrupa tus platillos (Tacos, Bebidas, Postres...). Los que no tengan sección salen al final en “Otros”."
      : "Group your dishes (Tacos, Drinks, Desserts...). Dishes without a section show last under “Other”.",
    sectionName: es ? "Nombre de la sección" : "Section name",
    toKitchen: es ? "Se prepara en cocina" : "Made in the kitchen",
    toKitchenHint: es
      ? "Plan Plus: sus platillos llegan a la pantalla de cocina."
      : "Plus plan: its dishes go to the kitchen screen.",
    addSection: es ? "+ Agregar sección" : "+ Add section",
    removeSection: es ? "Quitar sección" : "Remove section",
    removeSectionConfirm: es
      ? "¿Quitar la sección “{name}”? Sus platillos pasan a “Otros”; no se borran."
      : "Remove the “{name}” section? Its dishes move to “Other”; they are not deleted.",
    section: es ? "Sección" : "Section",
    other: es ? "Otros" : "Other",
    noSections: es
      ? "Todavía no tienes secciones. Todos tus platillos están en “Otros”."
      : "No sections yet. All your dishes are under “Other”.",
    addDishIn: es ? "+ Agregar platillo en {name}" : "+ Add dish to {name}",
    emptySectionName: es
      ? "Ponle nombre a todas las secciones."
      : "Give every section a name.",
    duplicateSection: es
      ? "Hay dos secciones con el mismo nombre."
      : "Two sections have the same name.",
  };

  const [ingredients, setIngredients] = useState(
    () => fromView(initial).ingredients,
  );

  const [dishes, setDishes] = useState(
    () => fromView(initial).dishes,
  );

  const [sections, setSections] = useState(
    () => fromView(initial).sections,
  );

  const groups = useMemo(
    () => grouped(sections, dishes),
    [sections, dishes],
  );

  const [saved, setSaved] = useState(
    () => JSON.stringify(fromView(initial)),
  );

  const [busy, setBusy] = useState(false);

  const [note, setNote] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const dirty = useMemo(
    () =>
      JSON.stringify({ ingredients, sections, dishes }) !== saved,
    [ingredients, sections, dishes, saved],
  );

  const unitOf = new Map(
    ingredients.map((ingredient) => [
      ingredient.key,
      ingredient.unit,
    ]),
  );

  const setDish = (
    rowKey: string,
    patch: Partial<DishRow>,
  ) => {
    setDishes((previous) =>
      previous.map((dish) =>
        dish.rowKey === rowKey
          ? { ...dish, ...patch }
          : dish,
      ),
    );
  };

  const setRecipe = (
    rowKey: string,
    update: (rows: RecipeRow[]) => RecipeRow[],
  ) => {
    setDishes((previous) =>
      previous.map((dish) =>
        dish.rowKey === rowKey
          ? { ...dish, recipe: update(dish.recipe) }
          : dish,
      ),
    );
  };

  /** Sube o baja un platillo dentro de su sección. */
  const move = (rowKey: string, by: number) => {
    setDishes((previous) => {
      const group = grouped(sections, previous).find((g) =>
        g.dishes.some((d) => d.rowKey === rowKey),
      );
      if (!group) return previous;
      const at = group.dishes.findIndex((d) => d.rowKey === rowKey);
      const other = group.dishes[at + by];
      if (!other) return previous;

      const a = previous.findIndex((d) => d.rowKey === rowKey);
      const b = previous.findIndex((d) => d.rowKey === other.rowKey);
      const next = [...previous];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  const moveSection = (index: number, by: number) => {
    setSections((previous) => {
      const target = index + by;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const setSection = (key: string, patch: Partial<SectionRow>) =>
    setSections((previous) =>
      previous.map((section) =>
        section.key === key ? { ...section, ...patch } : section,
      ),
    );

  function removeSection(row: SectionRow) {
    const used = dishes.some((dish) => dish.section === row.key);
    if (
      used &&
      !window.confirm(
        fill(ui.removeSectionConfirm, { name: row.name || "?" }),
      )
    ) {
      return;
    }
    setSections((previous) => previous.filter((x) => x.key !== row.key));
    setDishes((previous) =>
      previous.map((dish) =>
        dish.section === row.key ? { ...dish, section: null } : dish,
      ),
    );
  }

  function addDish(section: string | null) {
    setDishes((previous) => [
      ...previous,
      {
        rowKey: newKey(),
        id: null,
        section,
        nameEs: "",
        nameEn: "",
        imageUrl: null,
        price: "",
        recipe: [{ ingredient: "", qty: "" }],
      },
    ]);
  }

  function removeIngredient(row: IngredientRow) {
    const used = dishes.some((dish) =>
      dish.recipe.some(
        (recipe) => recipe.ingredient === row.key,
      ),
    );

    if (
      used &&
      !window.confirm(
        fill(m.removeIngredientConfirm, {
          name: row.name || "?",
        }),
      )
    ) {
      return;
    }

    setIngredients((previous) =>
      previous.filter(
        (ingredient) => ingredient.key !== row.key,
      ),
    );

    setDishes((previous) =>
      previous.map((dish) => ({
        ...dish,
        recipe: dish.recipe.filter(
          (recipe) => recipe.ingredient !== row.key,
        ),
      })),
    );
  }

  function validate(): string | null {
    if (!dishes.length) {
      return m.errors.no_dishes;
    }

    if (
      ingredients.some(
        (ingredient) => !ingredient.name.trim(),
      ) ||
      dishes.some((dish) => !dish.nameEs.trim())
    ) {
      return m.errors.empty_name;
    }

    if (sections.some((section) => !section.name.trim())) {
      return ui.emptySectionName;
    }

    const sectionNames = sections.map((section) =>
      section.name.trim().toLowerCase(),
    );

    if (new Set(sectionNames).size !== sectionNames.length) {
      return ui.duplicateSection;
    }

    const names = ingredients.map((ingredient) =>
      ingredient.name.trim().toLowerCase(),
    );

    if (new Set(names).size !== names.length) {
      return m.errors.duplicate_ingredient;
    }

    if (
      dishes.some((dish) =>
        dish.recipe.some(
          (recipe) =>
            recipe.ingredient &&
            !(Number(recipe.qty) > 0),
        ),
      )
    ) {
      return m.errors.bad_qty;
    }

    return null;
  }

  async function save() {
    const problem = validate();

    if (problem) {
      setNote({ ok: false, text: problem });
      return;
    }

    setBusy(true);
    setNote(null);

    const body = {
      action: "saveMenu",

      ingredients: ingredients.map((ingredient) => ({
        key: ingredient.key,
        name: ingredient.name.trim(),
        unit: ingredient.unit,
      })),

      sections: sections.map((section) => ({
        key: section.key,
        name: section.name.trim(),
        toKitchen: section.toKitchen,
      })),

      // En el orden en que se ven: así queda el orden de cada sección.
      dishes: groups.flatMap((g) => g.dishes).map((dish) => ({
        id: dish.id,
        section: dish.section,
        nameEs: dish.nameEs.trim(),
        nameEn: dish.nameEn.trim(),

        // La URL se guarda internamente.
        // El dueño nunca necesita escribirla.
        imageUrl: dish.imageUrl,

        priceCents: Math.round(
          Math.max(0, Number(dish.price) || 0) * 100,
        ),

        recipe: Object.entries(
          dish.recipe.reduce<Record<string, number>>(
            (acc, recipe) => {
              if (recipe.ingredient) {
                acc[recipe.ingredient] =
                  (acc[recipe.ingredient] ?? 0) +
                  Number(recipe.qty);
              }

              return acc;
            },
            {},
          ),
        ).map(([ingredient, qty]) => ({
          ingredient,
          qty,
        })),
      })),
    };

    let response: Response | null = null;

    try {
      response = await fetch(
        `/api/stalls/${initial.slug}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
    } catch {
      response = null;
    }

    setBusy(false);

    if (response?.status === 401) {
      window.location.reload();
      return;
    }

    const json = await response
      ?.json()
      .catch(() => null);

    if (!response?.ok) {
      const key = (json?.error ?? "generic") as
        keyof typeof m.errors;

      setNote({
        ok: false,
        text:
          (json?.error === "duplicate_section"
            ? ui.duplicateSection
            : null) ??
          m.errors[key] ??
          (es
            ? "No se pudo guardar el menú."
            : "Could not save the menu."),
      });

      return;
    }

    const fresh = fromView(json as OwnerView);

    setIngredients(fresh.ingredients);
    setSections(fresh.sections);
    setDishes(fresh.dishes);
    setSaved(JSON.stringify(fresh));

    setNote({
      ok: true,
      text: m.saved,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 pb-32 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={`/${lang}/panel/${initial.slug}`}
            className="text-sm font-semibold text-brand hover:underline"
          >
            {m.back}
          </Link>

          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {m.title}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {m.intro}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-background px-3 py-2 text-muted">
            {ingredients.length} {ui.ingredientsCount}
          </span>

          <span className="rounded-full bg-background px-3 py-2 text-muted">
            {dishes.length} {ui.dishesCount}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.7fr)]">
        {/* INGREDIENTES */}
        <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-background text-lg">
                  📦
                </span>

                <h2 className="text-base font-bold">
                  {m.ingredients}
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-muted">
                {m.ingredientsHint}
              </p>
            </div>

            <span className="rounded-lg bg-background px-2 py-1 text-xs font-semibold text-muted">
              {ingredients.length}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {ingredients.map((row, index) => (
              <div
                key={row.key}
                className="rounded-xl border border-line bg-background p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted">
                    {ui.ingredient} {index + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeIngredient(row)}
                    aria-label={m.removeIngredient}
                    className="rounded-lg px-2 py-1 text-lg text-bad hover:bg-surface"
                  >
                    ×
                  </button>
                </div>

                <input
                  className={input}
                  value={row.name}
                  placeholder={m.ingredientName}
                  aria-label={m.ingredientName}
                  onChange={(event) =>
                    setIngredients((previous) =>
                      previous.map((ingredient) =>
                        ingredient.key === row.key
                          ? {
                              ...ingredient,
                              name: event.target.value,
                            }
                          : ingredient,
                      ),
                    )
                  }
                />

                <label className="mt-2 block">
                  <span className="mb-1 block text-xs text-muted">
                    {ui.unit}
                  </span>

                  <select
                    className={input}
                    value={row.unit}
                    aria-label={m.unit}
                    onChange={(event) =>
                      setIngredients((previous) =>
                        previous.map((ingredient) =>
                          ingredient.key === row.key
                            ? {
                                ...ingredient,
                                unit: asUnit(
                                  event.target.value,
                                ),
                              }
                            : ingredient,
                        ),
                      )
                    }
                  >
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {m.units[unit]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setIngredients((previous) => [
                ...previous,
                {
                  key: newKey(),
                  name: "",
                  unit: "g",
                },
              ])
            }
            className="w-full rounded-xl border border-brand px-4 py-3 text-sm font-semibold text-brand transition hover:bg-background"
          >
            {m.addIngredient}
          </button>
        </section>

        {/* PLATILLOS */}
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-lg">
                  🍽️
                </span>

                <h2 className="text-base font-bold">
                  {m.dishes}
                </h2>
              </div>

              <p className="text-sm text-muted">
                {ui.dishesDescription}
              </p>
            </div>

            <span className="rounded-lg bg-surface px-2 py-1 text-xs font-semibold text-muted">
              {dishes.length}
            </span>
          </div>

          {/* SECCIONES */}
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
            <div>
              <h3 className="text-base font-bold">{ui.sections}</h3>
              <p className="mt-1 text-sm text-muted">{ui.sectionsHint}</p>
            </div>

            {sections.length === 0 && (
              <p className="rounded-xl bg-background p-3 text-sm text-muted">
                {ui.noSections}
              </p>
            )}

            {sections.map((section, index) => (
              <div
                key={section.key}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-background p-3"
              >
                <input
                  className={`${input} min-w-[10rem] flex-1 font-semibold`}
                  value={section.name}
                  maxLength={60}
                  placeholder={ui.sectionName}
                  aria-label={ui.sectionName}
                  onChange={(event) =>
                    setSection(section.key, { name: event.target.value })
                  }
                />

                <label
                  className="flex items-center gap-2 text-sm"
                  title={ui.toKitchenHint}
                >
                  <input
                    type="checkbox"
                    checked={section.toKitchen}
                    onChange={(event) =>
                      setSection(section.key, {
                        toKitchen: event.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-[var(--color-brand,#a63822)]"
                  />
                  {ui.toKitchen}
                </label>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveSection(index, -1)}
                    disabled={index === 0}
                    aria-label={m.moveUp}
                    className="rounded-lg border border-line px-2.5 py-1 text-base disabled:opacity-20"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(index, 1)}
                    disabled={index === sections.length - 1}
                    aria-label={m.moveDown}
                    className="rounded-lg border border-line px-2.5 py-1 text-base disabled:opacity-20"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSection(section)}
                    aria-label={ui.removeSection}
                    className="rounded-lg px-2 py-1 text-lg text-bad hover:bg-surface"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}

            <p className="text-xs text-muted">{ui.toKitchenHint}</p>

            <button
              type="button"
              onClick={() =>
                setSections((previous) => [
                  ...previous,
                  { key: newKey(), name: "", toKitchen: true },
                ])
              }
              className="w-full rounded-xl border border-brand px-4 py-3 text-sm font-semibold text-brand transition hover:bg-background"
            >
              {ui.addSection}
            </button>
          </div>

          {groups.map((group) =>
            group.section === null &&
            group.dishes.length === 0 &&
            sections.length > 0 ? null : (
          <div
            key={group.section?.key ?? "other"}
            className="flex min-w-0 flex-col gap-4"
          >
            {sections.length > 0 && (
              <h3 className="mt-2 flex items-baseline gap-2 border-b border-line pb-2 text-lg font-black">
                {group.section?.name.trim() || (group.section ? "…" : ui.other)}
                <span className="text-xs font-semibold text-muted">
                  {group.dishes.length} {ui.dishesCount}
                </span>
              </h3>
            )}

          {group.dishes.map((dish, index) => (
            <article
              key={dish.rowKey}
              className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:shadow-md sm:p-5"
            >
              {/* NOMBRE */}
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="text-xs font-semibold text-muted">
                    {ui.dishNumber} {index + 1}
                  </span>

                  {sections.length > 0 && (
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted">
                      {ui.section}
                      <select
                        className={`${input} py-1.5`}
                        value={dish.section ?? ""}
                        onChange={(event) =>
                          setDish(dish.rowKey, {
                            section: event.target.value || null,
                          })
                        }
                      >
                        {sections.map((section) => (
                          <option key={section.key} value={section.key}>
                            {section.name.trim() || "…"}
                          </option>
                        ))}
                        <option value="">{ui.other}</option>
                      </select>
                    </label>
                  )}

                  <input
                    className={`${input} font-semibold`}
                    value={dish.nameEs}
                    placeholder={m.dishNameEs}
                    aria-label={m.dishNameEs}
                    onChange={(event) =>
                      setDish(dish.rowKey, {
                        nameEs: event.target.value,
                      })
                    }
                  />

                  <input
                    className={input}
                    value={dish.nameEn}
                    placeholder={m.dishNameEn}
                    aria-label={m.dishNameEn}
                    onChange={(event) =>
                      setDish(dish.rowKey, {
                        nameEn: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-line">
                  <button
                    type="button"
                    onClick={() => move(dish.rowKey, -1)}
                    disabled={index === 0}
                    aria-label={m.moveUp}
                    className="px-3 py-1.5 text-lg disabled:opacity-20"
                  >
                    ↑
                  </button>

                  <div className="border-t border-line" />

                  <button
                    type="button"
                    onClick={() => move(dish.rowKey, 1)}
                    disabled={
                      index === group.dishes.length - 1
                    }
                    aria-label={m.moveDown}
                    className="px-3 py-1.5 text-lg disabled:opacity-20"
                  >
                    ↓
                  </button>
                </div>
              </div>

              {/* FOTO REAL */}
              <PhotoEditor
                slug={initial.slug}
                lang={photoLang}
                dish={dish}
                onImageChange={(imageUrl) =>
                  setDish(dish.rowKey, {
                    imageUrl,
                  })
                }
              />

              {/* PRECIO */}
              <div className="rounded-xl bg-background p-3">
                <label className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-muted">
                    {m.price}
                  </span>

                  <span className="text-lg font-semibold">
                    $
                  </span>

                  <input
                    className={`${input} min-w-0 flex-1 text-right font-semibold tabular-nums`}
                    inputMode="decimal"
                    value={dish.price}
                    onChange={(event) =>
                      setDish(dish.rowKey, {
                        price: event.target.value.replace(
                          /[^\d.]/g,
                          "",
                        ),
                      })
                    }
                  />

                  <span className="text-xs font-semibold text-muted">
                    {initial.currency}
                  </span>
                </label>
              </div>

              {/* RECETA */}
              <div className="flex flex-col gap-3 border-t border-line pt-4">
                <div>
                  <h3 className="text-sm font-bold">
                    {m.recipe}
                  </h3>

                  <p className="mt-1 text-xs text-muted">
                    {ui.recipeDescription}
                  </p>
                </div>

                {dish.recipe.map((recipe, recipeIndex) => (
                  <div
                    key={recipeIndex}
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)_76px_30px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_100px_45px_32px]"
                  >
                    <select
                      className={input}
                      value={recipe.ingredient}
                      aria-label={m.chooseIngredient}
                      onChange={(event) =>
                        setRecipe(dish.rowKey, (rows) =>
                          rows.map((r, i) =>
                            i === recipeIndex
                              ? {
                                  ...r,
                                  ingredient:
                                    event.target.value,
                                }
                              : r,
                          ),
                        )
                      }
                    >
                      <option value="">
                        {m.chooseIngredient}
                      </option>

                      {ingredients
                        .filter((i) => i.name.trim())
                        .map((ingredient) => (
                          <option
                            key={ingredient.key}
                            value={ingredient.key}
                          >
                            {ingredient.name}
                          </option>
                        ))}
                    </select>

                    <input
                      className={`${input} text-right`}
                      inputMode="decimal"
                      value={recipe.qty}
                      aria-label={m.qty}
                      onChange={(event) =>
                        setRecipe(dish.rowKey, (rows) =>
                          rows.map((r, i) =>
                            i === recipeIndex
                              ? {
                                  ...r,
                                  qty:
                                    event.target.value.replace(
                                      /[^\d.]/g,
                                      "",
                                    ),
                                }
                              : r,
                          ),
                        )
                      }
                    />

                    <span className="text-center text-xs text-muted">
                      {unitOf.get(recipe.ingredient) ??
                        ""}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setRecipe(dish.rowKey, (rows) =>
                          rows.filter(
                            (_, i) => i !== recipeIndex,
                          ),
                        )
                      }
                      aria-label={m.removeFromRecipe}
                      className="rounded-lg px-1 py-1 text-xl text-bad"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {!dish.recipe.some(
                  (recipe) => recipe.ingredient,
                ) && (
                  <p className="rounded-lg bg-background p-3 text-xs font-semibold text-warn">
                    {m.recipeEmpty}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setRecipe(dish.rowKey, (rows) => [
                        ...rows,
                        {
                          ingredient: "",
                          qty: "",
                        },
                      ])
                    }
                    className="rounded-full border border-line px-3 py-2 text-sm font-semibold hover:bg-background"
                  >
                    {m.addToRecipe}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          fill(m.removeDishConfirm, {
                            name:
                              dish.nameEs || m.newDish,
                          }),
                        )
                      ) {
                        setDishes((previous) =>
                          previous.filter(
                            (item) =>
                              item.rowKey !== dish.rowKey,
                          ),
                        );
                      }
                    }}
                    className="text-sm font-semibold text-bad underline"
                  >
                    {m.removeDish}
                  </button>
                </div>
              </div>
            </article>
          ))}

          <button
            type="button"
            onClick={() => addDish(group.section?.key ?? null)}
            className="w-full rounded-xl border border-dashed border-brand px-4 py-4 text-sm font-semibold text-brand hover:bg-surface"
          >
            {sections.length > 0
              ? fill(ui.addDishIn, {
                  name:
                    group.section?.name.trim() ||
                    (group.section ? "…" : ui.other),
                })
              : m.addDish}
          </button>
          </div>
          ),
          )}
        </section>
      </div>

      {/* BARRA PARA GUARDAR */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
          {note ? (
            <p
              className={`text-center text-sm font-semibold lg:mr-auto ${
                note.ok ? "text-ok" : "text-bad"
              }`}
            >
              {note.text}
            </p>
          ) : (
            dirty && (
              <p className="text-center text-sm text-muted lg:mr-auto">
                {m.unsaved}
              </p>
            )
          )}

          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty}
            className="w-full rounded-xl bg-brand px-8 py-3 text-base font-bold text-white shadow-sm disabled:opacity-50 lg:w-auto lg:min-w-64"
          >
            {busy ? m.saving : m.save}
          </button>
        </div>
      </div>
    </div>
  );
}
