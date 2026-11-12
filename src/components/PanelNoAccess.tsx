import Link from "next/link";
import { redirect } from "next/navigation";
import { OwnerLogin } from "@/components/OwnerLogin";
import { getDictionary } from "@/dictionaries";
import { authEnabled } from "@/lib/auth/config";
import { currentAccount } from "@/lib/auth/server";

/**
 * Lo que ve quien no puede entrar al panel de un negocio.
 *
 * Con cuentas (producción): nunca se pide el PIN viejo.
 * - Sin sesión → a "Entrar", y de regreso a esta página.
 * - Con sesión de alguien que no administra el negocio → aviso.
 *
 * Sin cuentas (solo demo local): el PIN del dueño.
 */
export async function PanelNoAccess({
  lang,
  stallName,
  back,
}: {
  lang: "es" | "en";
  stallName: string;
  /** Ruta a la que se vuelve después de entrar. */
  back: string;
}) {
  if (!authEnabled()) {
    return <OwnerLogin stallName={stallName} t={await getDictionary(lang)} />;
  }

  const me = await currentAccount();
  if (!me) redirect(`/${lang}/login?next=${encodeURIComponent(back)}`);

  const es = lang === "es";
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-xl font-black">
        {es ? "No tienes acceso a este panel" : "You don't have access to this panel"}
      </h1>
      <p className="text-sm text-muted">
        {es
          ? `Entraste como ${me.email}, que no administra ${stallName}. Pide una invitación al dueño.`
          : `You're signed in as ${me.email}, which doesn't manage ${stallName}. Ask the owner for an invitation.`}
      </p>
      <Link className="font-semibold text-brand underline" href={`/${lang}/cuenta`}>
        {es ? "Ir a mi cuenta" : "Go to my account"}
      </Link>
    </main>
  );
}
