import { notFound } from "next/navigation";
import { hasLocale } from "@/dictionaries";
import { authEnabled, safeNext } from "@/lib/auth/config";
import { AuthForm, type AuthMode } from "./AuthForm";

/** Shared shell for /login, /registro, /recuperar and /nueva-contrasena. */
export async function AuthPage({
  params,
  searchParams,
  mode,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  mode: AuthMode;
}) {
  const { lang } = await params;
  if (!hasLocale(lang) || !authEnabled()) notFound();
  const raw = (await searchParams).next;
  const next = safeNext(typeof raw === "string" ? raw : null, `/${lang}/cuenta`);
  return (
    <main className="flex w-full flex-1 items-center justify-center px-4 py-10">
      <AuthForm mode={mode} lang={lang} next={next} />
    </main>
  );
}
