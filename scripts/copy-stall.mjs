#!/usr/bin/env node
// Copia un negocio (por defecto Birria Doña Lupe) del Supabase del hackathon
// al Supabase del SaaS: datos del negocio y su página, sellos configurados,
// ingredientes, platillos, recetas y fotos. No copia ventas, apartados,
// clientes ni sellos ganados (eso era de la demo).
//
//   ORIGEN_SUPABASE_URL=https://<ref-hackathon>.supabase.co \
//   ORIGEN_SERVICE_ROLE_KEY=<secret del hackathon> \
//   NEXT_PUBLIC_SUPABASE_URL=https://<ref-saas>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<secret del SaaS> \
//   node scripts/copy-stall.mjs [--slug birria-dona-lupe] [--aplicar]
//
// Sin --aplicar solo muestra lo que haría. Se puede correr varias veces:
// actualiza por id y no duplica. Platillos e ingredientes que estén en el SaaS
// pero no en el origen se archivan (no se borran, por las ventas pasadas).

import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

const BUCKET = "dish-images";

/** Public URL prefix of the photo bucket in a Supabase project. */
export const bucketPrefix = (url) => `${url.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/`;

/** Paths of every photo of the source bucket mentioned anywhere in the rows. */
export function photoPaths(rows, srcUrl) {
  const prefix = bucketPrefix(srcUrl);
  const text = JSON.stringify(rows);
  const found = new Set();
  let i = text.indexOf(prefix);
  while (i !== -1) {
    const rest = text.slice(i + prefix.length);
    const path = rest.match(/^[^"?#\\\s]+/)?.[0];
    if (path) found.add(decodeURIComponent(path));
    i = text.indexOf(prefix, i + prefix.length);
  }
  return [...found];
}

/** The rows with the source bucket URLs pointing at the destination bucket. */
export function rewritePhotos(rows, srcUrl, dstUrl) {
  return JSON.parse(JSON.stringify(rows).split(bucketPrefix(srcUrl)).join(bucketPrefix(dstUrl)));
}

const must = (what, r) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

/**
 * Copies one business from `src` to `dst` (two service-role Supabase clients).
 * Returns a summary; writes only when `apply` is true.
 */
export async function copyStall({ src, dst, srcUrl, dstUrl, slug, apply, log = console.log }) {
  const business = must(
    "negocio de origen",
    await src.from("businesses").select("*").eq("slug", slug).maybeSingle(),
  );
  if (!business) throw new Error(`No existe "${slug}" en el origen.`);

  const ingredients = must("ingredientes", await src.from("ingredients").select("*").eq("business_id", business.id));
  const dishes = must("platillos", await src.from("dishes").select("*").eq("business_id", business.id));
  const dishIds = dishes.map((d) => d.id);
  const recipes = dishIds.length
    ? must("recetas", await src.from("recipe_items").select("*").in("dish_id", dishIds))
    : [];

  const target = must(
    "negocio de destino",
    await dst.from("businesses").select("id").eq("slug", slug).maybeSingle(),
  );
  const businessId = target?.id ?? business.id;

  const oldIngredients = target
    ? must("ingredientes destino", await dst.from("ingredients").select("id").eq("business_id", businessId))
    : [];
  const oldDishes = target
    ? must("platillos destino", await dst.from("dishes").select("id").eq("business_id", businessId))
    : [];
  const keepI = new Set(ingredients.map((i) => i.id));
  const keepD = new Set(dishIds);
  const archiveI = oldIngredients.map((i) => i.id).filter((id) => !keepI.has(id));
  const archiveD = oldDishes.map((d) => d.id).filter((id) => !keepD.has(id));

  const photos = photoPaths([business, dishes], srcUrl);

  const summary = {
    negocio: business.name,
    existe_en_saas: Boolean(target),
    ingredientes: ingredients.length,
    platillos: dishes.length,
    recetas: recipes.length,
    fotos: photos.length,
    archivar_ingredientes: archiveI.length,
    archivar_platillos: archiveD.length,
  };
  log(summary);
  if (!apply) {
    log("Nada escrito. Vuelve a correrlo con --aplicar para copiar.");
    return summary;
  }

  for (const path of photos) {
    const blob = must(`descargar ${path}`, await src.storage.from(BUCKET).download(path));
    must(
      `subir ${path}`,
      await dst.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: blob.type || undefined }),
    );
  }

  const fix = (rows) => rewritePhotos(rows, srcUrl, dstUrl).map((r) => ({ ...r, business_id: businessId }));

  // Business first without the reward dish (it may not exist yet), the rest after the dishes.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, owner_id: _owner, reward_dish_id, ...fields } = rewritePhotos(business, srcUrl, dstUrl);
  if (target) {
    must("actualizar negocio", await dst.from("businesses").update(fields).eq("id", businessId));
  } else {
    must("crear negocio", await dst.from("businesses").insert({ ...fields, id: businessId, owner_id: null }));
  }

  if (archiveI.length) {
    must("archivar ingredientes", await dst.from("ingredients").update({ archived: true }).in("id", archiveI));
  }
  if (archiveD.length) {
    must("archivar platillos", await dst.from("dishes").update({ archived: true }).in("id", archiveD));
  }
  if (ingredients.length) {
    must("ingredientes", await dst.from("ingredients").upsert(fix(ingredients), { onConflict: "id" }));
  }
  if (dishes.length) {
    must("platillos", await dst.from("dishes").upsert(fix(dishes), { onConflict: "id" }));
    must("borrar recetas viejas", await dst.from("recipe_items").delete().in("dish_id", dishIds));
  }
  if (recipes.length) {
    must("recetas", await dst.from("recipe_items").insert(recipes));
  }
  if (reward_dish_id !== undefined) {
    must("premio de sellos", await dst.from("businesses").update({ reward_dish_id }).eq("id", businessId));
  }

  log(`Listo: ${business.name} copiado al SaaS.`);
  return summary;
}

async function main() {
  const argv = process.argv.slice(2);
  const slugAt = argv.indexOf("--slug");
  const slug = slugAt >= 0 ? argv[slugAt + 1] : "birria-dona-lupe";
  const apply = argv.includes("--aplicar");

  const srcUrl = process.env.ORIGEN_SUPABASE_URL;
  const srcKey = process.env.ORIGEN_SERVICE_ROLE_KEY;
  const dstUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const dstKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!srcUrl || !srcKey || !dstUrl || !dstKey) {
    console.error(
      "Faltan ORIGEN_SUPABASE_URL, ORIGEN_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }
  if (srcUrl.replace(/\/+$/, "") === dstUrl.replace(/\/+$/, "")) {
    console.error("El origen y el destino son el mismo proyecto de Supabase.");
    process.exit(1);
  }
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  await copyStall({
    src: createClient(srcUrl, srcKey, opts),
    dst: createClient(dstUrl, dstKey, opts),
    srcUrl,
    dstUrl,
    slug,
    apply,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
}
