
import { createClient } from "@supabase/supabase-js";

const {
  TEST_DB_ISOLATED,
  TEST_SUPABASE_URL,
  TEST_SUPABASE_SERVICE_ROLE_KEY,
  TEST_BUSINESS_ID,
  TEST_DISH_ID,
} = process.env;

// Protección contra una ejecución accidental.
if (TEST_DB_ISOLATED !== "YES") {
  throw new Error(
    "Debes confirmar que utilizas una BD de pruebas aislada."
  );
}

if (
  !TEST_SUPABASE_URL ||
  !TEST_SUPABASE_SERVICE_ROLE_KEY ||
  !TEST_BUSINESS_ID ||
  !TEST_DISH_ID
) {
  throw new Error(
    "Faltan variables de entorno de prueba."
  );
}

const supabase = createClient(
  TEST_SUPABASE_URL,
  TEST_SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const pickupBy = new Date(
  Date.now() + 60 * 60 * 1000
).toISOString();

async function reservar(cliente) {
  const start = performance.now();

  const { data, error } = await supabase.rpc(
    "reserve",
    {
      p_business: TEST_BUSINESS_ID,
      p_customer: cliente,
      p_lines: [
        {
          dish_id: TEST_DISH_ID,
          qty: 1,
        },
      ],
      p_pickup_by: pickupBy,
    }
  );

  return {
    cliente,
    aceptado: !error && Boolean(data),
    reservationId: data ?? null,
    error: error?.message ?? null,
    tiempoMs: Math.round(performance.now() - start),
  };
}

console.log("Iniciando dos reservas simultáneas...");

// Las dos operaciones se envían sin esperar
// a que termine la primera.
const resultados = await Promise.all([
  reservar("Prueba Cliente A"),
  reservar("Prueba Cliente B"),
]);

console.table(resultados);

const aceptados = resultados.filter(
  (r) => r.aceptado
);

const rechazados = resultados.filter(
  (r) => !r.aceptado
);

// Comprobamos también que el pedido
// aceptado realmente exista en PostgreSQL.
let existe = false;

if (aceptados.length === 1) {
  const { data, error } = await supabase
    .from("reservations")
    .select("id")
    .eq("business_id", TEST_BUSINESS_ID)
    .eq("id", aceptados[0].reservationId)
    .maybeSingle();

  if (error) throw error;

  existe = Boolean(data);
}

console.log("\nRESULTADO");

if (
  aceptados.length === 1 &&
  rechazados.length === 1 &&
  existe &&
  rechazados[0].error?.includes(
    "insufficient_stock"
  )
) {
  console.log(
    "✅ APROBADA: solo una reserva fue aceptada."
  );
} else {
  console.error(
    "❌ NO APROBADA: revisar reservas e inventario."
  );
  process.exitCode = 1;
}

console.log(
  "\nRevisa el inventario y las reservas en Supabase."
);
console.log(
  "La prueba no elimina automáticamente sus datos."
);
