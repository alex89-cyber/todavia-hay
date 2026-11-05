import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { OwnerLogin } from "@/components/OwnerLogin";
import { OwnerPanel } from "@/components/OwnerPanel";
import { getDictionary, hasLocale } from "@/dictionaries";
import { ownerView } from "@/lib/stall";
import { demoMode, isOwner, ownerPinRequired } from "@/lib/owner-auth";
import { loadStall } from "@/lib/reservations";

type PanelRouteProps = {
  params: Promise<{
    lang: string;
    slug: string;
  }>;
};

export default function PanelPage({ params }: PanelRouteProps) {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col">
      <Suspense fallback={<p className="p-4 text-muted">…</p>}>
        <Panel params={params} />
      </Suspense>
    </main>
  );
}

async function Panel({ params }: { params: PanelRouteProps["params"] }) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  await connection();
  const state = await loadStall(slug);
  if (!state) notFound();
  const t = await getDictionary(lang);
  if (!(await isOwner())) return <OwnerLogin stallName={state.name} t={t} />;
  return (
    <OwnerPanel
      initial={ownerView(state)}
      lang={lang}
      timezone={state.timezone}
      t={t}
      demo={demoMode()}
      canSignOut={ownerPinRequired()}
    />
  );
}
