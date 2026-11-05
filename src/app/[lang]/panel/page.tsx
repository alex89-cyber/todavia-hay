import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { hasLocale } from "@/dictionaries";
import { authEnabled } from "@/lib/auth/config";
import { currentAccount } from "@/lib/auth/server";
import { memberships } from "@/lib/accounts";

// /panel: straight to the business you manage, or a list if there are several.
export default function PanelIndex(props: PageProps<"/[lang]/panel">) {
  return (
    <Suspense fallback={<p className="p-4 text-muted">…</p>}>
      <Index params={props.params} />
    </Suspense>
  );
}

async function Index({ params }: { params: PageProps<"/[lang]/panel">["params"] }) {
  const { lang } = await params;
  if (!hasLocale(lang) || !authEnabled()) notFound();
  await connection();
  const me = await currentAccount();
  if (!me) redirect(`/${lang}/login?next=/${lang}/panel`);
  const list = await memberships(me.id);
  if (list.length === 1) redirect(`/${lang}/panel/${list[0].slug}`);
  const es = lang === "es";
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <h1 className="text-2xl font-black">{es ? "Tus negocios" : "Your businesses"}</h1>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {es ? "Tu cuenta todavía no administra ningún negocio." : "Your account doesn't manage any business yet."}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {list.map((b) => (
            <li key={b.slug}>
              <Link className="block rounded-2xl border border-line bg-surface p-4 font-bold" href={`/${lang}/panel/${b.slug}`}>
                {b.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
