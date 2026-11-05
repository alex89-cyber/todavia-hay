
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { MenuEditor } from "@/components/MenuEditor";
import { OwnerLogin } from "@/components/OwnerLogin";
import { getDictionary, hasLocale } from "@/dictionaries";
import { isOwner } from "@/lib/owner-auth";
import { loadStall } from "@/lib/reservations";
import { ownerView } from "@/lib/stall";

// Responsive menu editor: wide on desktop, fluid on smaller screens.
export default function MenuPage({ params }: PageProps<"/[lang]/panel/[slug]/menu">) {
  return (
    <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8">
      <Suspense fallback={<p className="p-4 text-muted">…</p>}>
        <Menu params={params} />
      </Suspense>
    </main>
  );
}

async function Menu({ params }: { params: PageProps<"/[lang]/panel/[slug]/menu">["params"] }) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  await connection();
  const state = await loadStall(slug);
  if (!state) notFound();
  const t = await getDictionary(lang);
  if (!(await isOwner())) return <OwnerLogin stallName={state.name} t={t} />;
  return <MenuEditor initial={ownerView(state)} lang={lang} t={t} />;
}
