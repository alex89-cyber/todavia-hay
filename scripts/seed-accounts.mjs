#!/usr/bin/env node
// Cuentas de prueba: invita a los dueños de Birria Doña Lupe y Tacos El Güero
// y a dos clientes (Ana Ramírez y Luis Pérez) con pedidos y sellos pasados.
// Los correos se pasan al correrlo; nunca se guardan en el repositorio.
//
//   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<secret> \
//   node scripts/seed-accounts.mjs \
//     --lupe dueno1@correo.com --guero dueno2@correo.com \
//     --ana cliente1@correo.com --luis cliente2@correo.com
//
// Cada persona recibe un correo de invitación para poner su contraseña (usa la
// plantilla "Invite user" de Supabase). Si ya tiene cuenta, no se le escribe.
// Se puede correr varias veces: no duplica negocios, miembros ni historial.

import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(" ")
    .split("--")
    .filter(Boolean)
    .map((a) => a.trim().split(/\s+/))
    .map(([k, v]) => [k, v]),
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const must = (what, r) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

// ------------------------------------------
// People
// ------------------------------------------

const PEOPLE = {
  lupe: { first: "Guadalupe", last: "Hernández", next: "/es/panel", business: "birria-dona-lupe" },
  guero: { first: "Ramón", last: "Gutiérrez", next: "/es/panel", business: "tacos-el-guero" },
  ana: { first: "Ana", last: "Ramírez", next: "/es/cuenta" },
  luis: { first: "Luis", last: "Pérez", next: "/es/cuenta" },
};

async function findUser(email) {
  for (let page = 1; page < 50; page++) {
    const { users } = must("listUsers", await sb.auth.admin.listUsers({ page, perPage: 200 }));
    const u = users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (users.length < 200) return null;
  }
  return null;
}

async function person(id, email) {
  const p = PEOPLE[id];
  let user = await findUser(email);
  if (user) {
    console.log(`· ${p.first} ${p.last}: ya tenía cuenta (${email})`);
  } else {
    user = must(
      `invitar ${email}`,
      await sb.auth.admin.inviteUserByEmail(email, {
        data: { first_name: p.first, last_name: p.last, next: p.next, lang: "es" },
      }),
    ).user;
    console.log(`· ${p.first} ${p.last}: invitación enviada a ${email}`);
  }
  // The trigger fills the name from the invitation; an older account may not have it.
  const prof = must("perfil", await sb.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle());
  if (!prof?.first_name || !prof?.last_name) {
    must("guardar perfil", await sb.from("profiles").upsert({ id: user.id, first_name: p.first, last_name: p.last }));
  }
  return user.id;
}

// ------------------------------------------
// Tacos El Güero
// ------------------------------------------

const GUERO = {
  slug: "tacos-el-guero",
  name: "Tacos El Güero",
  ingredients: [
    ["Carne al pastor", "g", 8000],
    ["Suadero", "g", 6000],
    ["Tortilla", "pz", 400],
    ["Piña", "g", 1500],
    ["Cebolla y cilantro", "g", 2500],
    ["Refresco", "pz", 48],
  ],
  dishes: [
    // name_es, name_en, price, recipe {ingredient: qty}
    ["Orden de pastor (5)", "Al pastor tacos (5)", 7500, { "Carne al pastor": 200, Tortilla: 5, Piña: 25, "Cebolla y cilantro": 20 }],
    ["Orden de suadero (5)", "Suadero tacos (5)", 8000, { Suadero: 200, Tortilla: 5, "Cebolla y cilantro": 20 }],
    ["Campechano (5)", "Mixed tacos (5)", 8500, { "Carne al pastor": 100, Suadero: 100, Tortilla: 5, "Cebolla y cilantro": 20 }],
    ["Refresco", "Soda", 2500, { Refresco: 1 }],
  ],
};

async function guero() {
  const found = must("buscar negocio", await sb.from("businesses").select("id").eq("slug", GUERO.slug).maybeSingle());
  if (found) return found.id;
  const b = must(
    "crear negocio",
    await sb.from("businesses").insert({ slug: GUERO.slug, name: GUERO.name, owner_id: null }).select("id").single(),
  );
  const ing = must(
    "ingredientes",
    await sb
      .from("ingredients")
      .insert(GUERO.ingredients.map(([name, unit, stock]) => ({ business_id: b.id, name, unit, stock })))
      .select("id, name"),
  );
  const ingId = Object.fromEntries(ing.map((i) => [i.name, i.id]));
  const dishes = must(
    "platillos",
    await sb
      .from("dishes")
      .insert(GUERO.dishes.map(([es, en, price], i) => ({ business_id: b.id, name_es: es, name_en: en, price_cents: price, sort: i + 1 })))
      .select("id, name_es"),
  );
  const dishId = Object.fromEntries(dishes.map((d) => [d.name_es, d.id]));
  must(
    "recetas",
    await sb.from("recipe_items").insert(
      GUERO.dishes.flatMap(([es, , , recipe]) =>
        Object.entries(recipe).map(([ingredient, qty]) => ({ dish_id: dishId[es], ingredient_id: ingId[ingredient], qty })),
      ),
    ),
  );
  console.log(`· Negocio creado: ${GUERO.name} (/es/${GUERO.slug})`);
  return b.id;
}

async function businessId(slug) {
  const b = must("negocio", await sb.from("businesses").select("id, owner_id").eq("slug", slug).maybeSingle());
  if (!b) throw new Error(`No existe el negocio ${slug}. Corre primero las migraciones.`);
  return b;
}

async function addOwner(slug, userId) {
  const b = await businessId(slug);
  must("miembro", await sb.from("business_members").upsert({ business_id: b.id, user_id: userId, role: "owner" }));
  console.log(`  administra ${slug}`);
}

// ------------------------------------------
// Past orders and stamps
// ------------------------------------------

const DAY = 86_400_000;

/** A few delivered orders (with their sale) days ago, and the stamps they earned. */
async function history(userId, name, slug, orders) {
  const b = await businessId(slug);
  const had = must(
    "historial",
    await sb.from("reservations").select("id").eq("business_id", b.id).eq("customer_id", userId).limit(1),
  );
  if (had.length) return console.log(`  ya tenía historial en ${slug}`);

  const dishes = must("platillos", await sb.from("dishes").select("id, price_cents").eq("business_id", b.id).order("sort"));
  let stamps = 0;
  for (const [daysAgo, picks] of orders) {
    const at = new Date(Date.now() - daysAgo * DAY);
    at.setUTCHours(20, 0, 0, 0); // 14:00 en Ciudad de México
    const lines = picks.map(([i, qty]) => ({ dish: dishes[i % dishes.length], qty }));
    const total = lines.reduce((n, l) => n + l.dish.price_cents * l.qty, 0);
    const r = must(
      "pedido",
      await sb
        .from("reservations")
        .insert({
          business_id: b.id,
          customer_name: name,
          customer_id: userId,
          payer_id: `user:${userId}`,
          status: "captured",
          total_cents: total,
          pickup_by: new Date(at.getTime() + 40 * 60_000).toISOString(),
          pickup_mode: "asap",
          pickup_at: new Date(at.getTime() + 20 * 60_000).toISOString(),
          ready_at: new Date(at.getTime() + 18 * 60_000).toISOString(),
          created_at: at.toISOString(),
        })
        .select("id")
        .single(),
    );
    must("platillos del pedido", await sb.from("reservation_items").insert(lines.map((l) => ({ reservation_id: r.id, dish_id: l.dish.id, qty: l.qty }))));
    const sale = must(
      "venta",
      await sb
        .from("sales")
        .insert({ business_id: b.id, method: "paypal", total_cents: total, reservation_id: r.id, created_at: new Date(at.getTime() + 25 * 60_000).toISOString() })
        .select("id")
        .single(),
    );
    must("platillos de la venta", await sb.from("sale_items").insert(lines.map((l) => ({ sale_id: sale.id, dish_id: l.dish.id, qty: l.qty, price_cents: l.dish.price_cents }))));
    stamps += 1;
  }
  const card = must("sellos", await sb.from("stamp_cards").select("stamps").eq("business_id", b.id).eq("payer_id", `user:${userId}`).maybeSingle());
  must(
    "guardar sellos",
    await sb
      .from("stamp_cards")
      .upsert({ business_id: b.id, payer_id: `user:${userId}`, stamps: (card?.stamps ?? 0) + stamps, updated_at: new Date().toISOString() }),
  );
  console.log(`  ${orders.length} pedidos y ${stamps} sellos en ${slug}`);
}

// ------------------------------------------

async function main() {
  const given = Object.keys(PEOPLE).filter((k) => args[k]);
  if (!given.length) {
    console.error("Pasa al menos un correo: --lupe, --guero, --ana, --luis");
    process.exit(1);
  }
  await guero();
  const ids = {};
  for (const k of given) ids[k] = await person(k, args[k]);

  if (ids.lupe) await addOwner("birria-dona-lupe", ids.lupe);
  if (ids.guero) await addOwner("tacos-el-guero", ids.guero);
  if (ids.ana) {
    await history(ids.ana, "Ana Ramírez", "birria-dona-lupe", [[9, [[0, 1], [3, 1]]], [6, [[2, 3]]], [3, [[0, 2]]], [1, [[1, 1]]]]);
    await history(ids.ana, "Ana Ramírez", "tacos-el-guero", [[5, [[0, 1], [3, 2]]]]);
  }
  if (ids.luis) {
    await history(ids.luis, "Luis Pérez", "birria-dona-lupe", [[4, [[1, 2]]]]);
    await history(ids.luis, "Luis Pérez", "tacos-el-guero", [[8, [[1, 1]]], [6, [[2, 1], [3, 1]]], [2, [[0, 2]]]]);
  }
  console.log("Listo.");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
