import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { OwnerLogin } from "@/components/OwnerLogin";
import { getDictionary, hasLocale } from "@/dictionaries";
import { authEnabled } from "@/lib/auth/config";
import { currentAccount } from "@/lib/auth/server";
import { isOwner } from "@/lib/owner-auth";
import { store } from "@/lib/store";

// Everything under /panel/<slug> is for the people who manage that business:
// signed-in members with accounts, or the OWNER_PIN without them.
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
  if (!authEnabled()) return <OwnerLogin stallName={stall.name} t={await getDictionary(lang)} />;

  const me = await currentAccount();
  if (!me) redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/panel/${slug}`)}`);
  const es = lang === "es";
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-xl font-black">{es ? "No tienes acceso a este panel" : "You don't have access to this panel"}</h1>
      <p className="text-sm text-muted">
        {es
          ? `Entraste como ${me.email}, que no administra ${stall.name}. Pide una invitación al dueño.`
          : `You're signed in as ${me.email}, which doesn't manage ${stall.name}. Ask the owner for an invitation.`}
      </p>
      <Link className="font-semibold text-brand underline" href={`/${lang}/cuenta`}>
        {es ? "Ir a mi cuenta" : "Go to my account"}
      </Link>
    </main>
  );
}
