import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PanelNoAccess } from "@/components/PanelNoAccess";
import { hasLocale } from "@/dictionaries";
import { isOwner } from "@/lib/owner-auth";
import { store } from "@/lib/store";

// Everything under /panel/<slug> is for the people who manage that business:
// signed-in owners. The old PIN only shows without accounts (local demo).
export default function PanelLayout({ children, params }: LayoutProps<"/[lang]/panel/[slug]">) {
  return (
    <Suspense fallback={<p className="p-4 text-muted">…</p>}>
      <Gate params={params}>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ params, children }: { params: LayoutProps<"/[lang]/panel/[slug]">["params"]; children: React.ReactNode }) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  await connection();
  if (await isOwner(slug)) return children;

  const stall = await store.get(slug);
  if (!stall) notFound();
  return <PanelNoAccess lang={lang} stallName={stall.name} back={`/${lang}/panel/${slug}`} />;
}
