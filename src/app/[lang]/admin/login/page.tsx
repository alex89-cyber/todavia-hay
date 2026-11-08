
import { notFound } from "next/navigation";

import { hasLocale } from "@/dictionaries";
import { AuthForm } from "@/components/AuthForm";

type Props = {
  params: Promise<{ lang: string }>;
};

export default async function AdminLoginPage({
  params,
}: Props) {
  const { lang } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-[75vh] w-full flex-1 items-center justify-center bg-[#FAF7F2] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-[#244D38]">
            Todavía Hay
          </p>

          <h1 className="mt-2 text-2xl font-black">
            Acceso de socios
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Administración privada de la plataforma
          </p>
        </div>

        <AuthForm
          mode="login"
          lang={lang}
          next={`/${lang}/admin`}
          allowSignup={false}
        />
      </div>
    </main>
  );
}
