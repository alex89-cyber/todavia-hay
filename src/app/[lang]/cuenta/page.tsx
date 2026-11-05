import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { hasLocale } from "@/dictionaries";
import { authEnabled } from "@/lib/auth/config";
import { currentAccount } from "@/lib/auth/server";
import { accountCards, accountOrders, memberships } from "@/lib/accounts";
import { money } from "@/lib/format";
import { ProfileForm } from "@/components/ProfileForm";

export default function AccountPage(props: PageProps<"/[lang]/cuenta">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-muted">…</p>}>
        <Account params={props.params} />
      </Suspense>
    </main>
  );
}

const STATUS = {
  es: { held: "esperando pago", authorized: "apartado", captured: "entregado", voided: "cancelado", expired: "vencido" },
  en: { held: "awaiting payment", authorized: "reserved", captured: "picked up", voided: "cancelled", expired: "expired" },
} as const;

async function Account({ params }: { params: PageProps<"/[lang]/cuenta">["params"] }) {
  const { lang } = await params;
  if (!hasLocale(lang) || !authEnabled()) notFound();
  await connection();
  const me = await currentAccount();
  if (!me) redirect(`/${lang}/login?next=/${lang}/cuenta`);
  const es = lang === "es";
  const [cards, orders, owned] = await Promise.all([accountCards(me.id), accountOrders(me.id), memberships(me.id)]);
  const when = (iso: string) =>
    new Intl.DateTimeFormat(es ? "es-MX" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(
      new Date(iso),
    );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">{es ? "Mi cuenta" : "My account"}</h1>
          <p className="text-sm text-muted">{me.email}</p>
        </div>
        <form action={`/api/auth/signout?next=/${lang}`} method="post">
          <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold">
            {es ? "Cerrar sesión" : "Sign out"}
          </button>
        </form>
      </header>

      {owned.length > 0 && (
        <section className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="font-bold">{es ? "Tus negocios" : "Your businesses"}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {owned.map((b) => (
              <li key={b.slug}>
                <Link className="font-semibold text-brand underline" href={`/${lang}/panel/${b.slug}`}>
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ProfileForm
        lang={lang}
        initial={{ firstName: me.firstName, lastName: me.lastName, phone: me.phone }}
      />

      <section className="rounded-3xl border border-line bg-surface p-5">
        <h2 className="font-bold">{es ? "Mis sellos" : "My stamps"}</h2>
        {cards.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {es ? "Todavía no tienes sellos. Cada pedido que recojas te suma uno." : "No stamps yet. Every order you pick up adds one."}
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {cards.map((c) => (
              <li key={c.slug} className="flex justify-between gap-3">
                <Link className="underline" href={`/${lang}/${c.slug}`}>
                  {c.name}
                </Link>
                <span className="font-bold">⭐ {c.stamps}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-surface p-5">
        <h2 className="font-bold">{es ? "Mis pedidos" : "My orders"}</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{es ? "Aún no has apartado nada." : "You haven't reserved anything yet."}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  <Link className="font-semibold underline" href={`/${lang}/${o.slug}`}>
                    {o.business}
                  </Link>
                  {o.orderNumber ? ` · #${o.orderNumber}` : ""} · {when(o.createdAt)}
                </span>
                <span>
                  {money(o.totalCents, "MXN", lang)} · {STATUS[lang][o.status as keyof (typeof STATUS)["es"]] ?? o.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
