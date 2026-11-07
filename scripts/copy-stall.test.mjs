import { describe, expect, it } from "vitest";

import { copyStall, photoPaths, rewritePhotos } from "./copy-stall.mjs";

const SRC = "https://hack.supabase.co";
const DST = "https://saas.supabase.co";
const pic = (base, p) => `${base}/storage/v1/object/public/dish-images/${p}`;

/** Minimal in-memory stand-in for the parts of supabase-js the script uses. */
function fakeDb(tables, files = {}) {
  const db = structuredClone(tables);
  const key = (t, r) => (t === "recipe_items" ? `${r.dish_id}|${r.ingredient_id}` : r.id);
  const from = (t) => {
    db[t] ??= [];
    let op = "select";
    let payload;
    const filters = [];
    const q = {
      select: () => q,
      eq: (c, v) => (filters.push((r) => r[c] === v), q),
      in: (c, vs) => (filters.push((r) => vs.includes(r[c])), q),
      update: (p) => ((op = "update"), (payload = p), q),
      delete: () => ((op = "delete"), q),
      insert: (rows) => {
        db[t].push(...[rows].flat());
        return Promise.resolve({ data: null, error: null });
      },
      upsert: (rows) => {
        for (const r of [rows].flat()) {
          const i = db[t].findIndex((x) => key(t, x) === key(t, r));
          if (i >= 0) db[t][i] = { ...db[t][i], ...r };
          else db[t].push(r);
        }
        return Promise.resolve({ data: null, error: null });
      },
      maybeSingle: () => run().then((r) => ({ ...r, data: r.data[0] ?? null })),
      then: (ok, bad) => run().then(ok, bad),
    };
    const run = async () => {
      const hit = (r) => filters.every((f) => f(r));
      if (op === "update") db[t] = db[t].map((r) => (hit(r) ? { ...r, ...payload } : r));
      if (op === "delete") db[t] = db[t].filter((r) => !hit(r));
      return { data: structuredClone(db[t].filter(hit)), error: null };
    };
    return q;
  };
  const storage = {
    from: () => ({
      download: async (p) => ({ data: files[p] ?? null, error: files[p] ? null : { message: "no" } }),
      upload: async (p, blob) => ((files[p] = blob), { data: {}, error: null }),
    }),
  };
  return { db, files, client: { from, storage } };
}

describe("photos", () => {
  it("finds and rewrites bucket URLs anywhere in the rows", () => {
    const rows = [{ image_url: pic(SRC, "a/b%20c.jpg") }, { gallery: [pic(SRC, "g.png"), "https://x.com/y.png"] }];
    expect(photoPaths(rows, SRC)).toEqual(["a/b c.jpg", "g.png"]);
    expect(rewritePhotos(rows, SRC, DST)[1].gallery[0]).toBe(pic(DST, "g.png"));
  });
});

describe("copyStall", () => {
  const source = () =>
    fakeDb(
      {
        businesses: [{ id: "b1", owner_id: "u-hack", slug: "lupe", name: "Lupe", logo_url: pic(SRC, "logo.png"), reward_dish_id: "d2" }],
        ingredients: [{ id: "i1", business_id: "b1", name: "Carne", stock: 5, archived: false }],
        dishes: [
          { id: "d1", business_id: "b1", name_es: "Taco", image_url: pic(SRC, "taco.jpg"), archived: false },
          { id: "d2", business_id: "b1", name_es: "Quesabirria", image_url: null, archived: false },
        ],
        recipe_items: [{ dish_id: "d1", ingredient_id: "i1", qty: 80 }],
      },
      { "logo.png": { type: "image/png" }, "taco.jpg": { type: "image/jpeg" } },
    );

  it("dry run writes nothing", async () => {
    const src = source();
    const dst = fakeDb({ businesses: [] });
    const s = await copyStall({ src: src.client, dst: dst.client, srcUrl: SRC, dstUrl: DST, slug: "lupe", apply: false, log: () => {} });
    expect(s).toMatchObject({ platillos: 2, fotos: 2, existe_en_saas: false });
    expect(dst.db.businesses).toEqual([]);
  });

  it("updates an existing stall, keeps its owner, archives extras and moves photos", async () => {
    const src = source();
    const dst = fakeDb({
      businesses: [{ id: "b1", owner_id: "u-saas", slug: "lupe", name: "Old", reward_dish_id: null }],
      ingredients: [{ id: "i9", business_id: "b1", name: "Viejo", archived: false }],
      dishes: [{ id: "d9", business_id: "b1", name_es: "Viejo", archived: false }],
      recipe_items: [{ dish_id: "d1", ingredient_id: "i9", qty: 1 }],
    });
    const run = () =>
      copyStall({ src: src.client, dst: dst.client, srcUrl: SRC, dstUrl: DST, slug: "lupe", apply: true, log: () => {} });
    await run();
    await run(); // idempotent

    const b = dst.db.businesses[0];
    expect(b).toMatchObject({ owner_id: "u-saas", name: "Lupe", logo_url: pic(DST, "logo.png"), reward_dish_id: "d2" });
    expect(dst.db.dishes.find((d) => d.id === "d9").archived).toBe(true);
    expect(dst.db.ingredients.find((i) => i.id === "i9").archived).toBe(true);
    expect(dst.db.dishes.filter((d) => !d.archived)).toHaveLength(2);
    expect(dst.db.dishes.find((d) => d.id === "d1").image_url).toBe(pic(DST, "taco.jpg"));
    expect(dst.db.recipe_items).toEqual([{ dish_id: "d1", ingredient_id: "i1", qty: 80 }]);
    expect(Object.keys(dst.files).sort()).toEqual(["logo.png", "taco.jpg"]);
  });

  it("creates the stall without an owner when the SaaS does not have it", async () => {
    const src = source();
    const dst = fakeDb({ businesses: [] });
    await copyStall({ src: src.client, dst: dst.client, srcUrl: SRC, dstUrl: DST, slug: "lupe", apply: true, log: () => {} });
    expect(dst.db.businesses[0]).toMatchObject({ id: "b1", owner_id: null, slug: "lupe" });
  });
});
