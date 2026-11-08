# ¿Todavía hay?

Punto de venta, menú en vivo y apartados para puestos de comida que preparan una tanda y venden hasta que se acaba. El dueño cobra con un toque y cada venta descuenta ingredientes por receta. La página pública muestra en vivo si el puesto está abierto y cuántas porciones quedan de cada platillo. Un agente con IA contesta el "¿todavía hay?" de los clientes y aparta su pedido.

Producción: https://todavia-hay.onrender.com · Código privado, todos los derechos reservados (ver `LICENSE`).

## Qué hace

**Clientes** (página pública, se instala como app en el celular):

- Ver en vivo si el puesto está abierto y cuántas porciones quedan.
- Preguntar al agente en español o inglés y apartar. Apartar pide cuenta (correo y contraseña o Google).
- **Recoger** "para ahorita" o "para una hora"; los programados piden confirmación antes de prepararse.
- **"Avísame cuando haya"**: aviso push cuando el puesto abre o un platillo vuelve.
- **Tarjeta de sellos** configurable por negocio; se canjea en el mostrador con PIN.
- **Mi cuenta**: sellos por negocio y últimos pedidos.

**Dueños** (panel, entran con su cuenta de dueño):

- Venta con un toque, inventario por receta, porciones restantes y hora estimada de agotado.
- Surtir, marcar agotado, apartados (Por preparar, Listo, Entregado con código), clientes y sellos.
- Menú y recetas, configuración de la página (logo, portada, galería, colores, horarios, secciones) y de Recoger.
- Corte de caja en AG Studio con historial de cortes y un asistente con IA.

## Tecnología

Next.js 16 (App Router, React 19) · Tailwind CSS 4 · Vercel AI SDK con Gemini · Supabase (Postgres con RLS, funciones PL/pgSQL para el inventario, Auth y Storage) · Web Push (VAPID) · AG Studio · Vitest · Render.

Los apartados con pago usan hoy PayPal (autorizar y cobrar al entregar, `src/lib/paypal.ts`); el cobro para el piloto está por definirse.

## Correr en local

```bash
npm install
npm run dev      # http://localhost:3000/es/birria-dona-lupe y /es/panel/birria-dona-lupe
npm test
```

Sin claves corre con datos en memoria y un puesto de ejemplo, y el panel queda abierto. En producción el panel siempre pide cuenta (o `OWNER_PIN` si las cuentas están apagadas); sin ninguna de las dos queda cerrado.

| Variable | Para qué |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Guardar en Supabase en vez de memoria |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Enciende las cuentas (dueños y clientes) |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL` | Dirección pública de la app |
| `REWARD_PIN_SECRET` | PIN de canje de sellos (32+ caracteres) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Agente del chat y asistente del corte (Gemini) |
| `GEMINI_MODEL`, `STUDIO_GEMINI_MODEL` | Opcional: otro modelo de Gemini |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV` | Apartados con PayPal (sandbox salvo `PAYPAL_ENV=live`) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Avisos push (`npx web-push generate-vapid-keys`) |
| `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` | Formulario de contacto de la landing |
| `NEXT_PUBLIC_AG_STUDIO_LICENSE` | Licencia de AG Studio (se lee al construir; sin ella sale marca de agua) |
| `OWNER_PIN` | Solo sin cuentas: PIN del panel |

## Base de datos

Migraciones en `supabase/migrations`, en orden (0001 a 0016). Para un proyecto nuevo de Supabase basta con correrlas en el SQL Editor; `0002` crea el puesto de ejemplo Birria Doña Lupe.

## Scripts

- `scripts/seed-accounts.mjs`: invita dueños y clientes de prueba (ver el encabezado del archivo).
- `scripts/copy-stall.mjs`: copia un negocio (menú, recetas, fotos, página) de otro proyecto de Supabase.
