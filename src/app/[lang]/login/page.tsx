
import { notFound } from "next/navigation";
import {
  getDictionary,
  hasLocale,
} from "@/dictionaries";

import { OwnerLogin } from "@/components/OwnerLogin";

export default async function LoginPage({
  params,
}: PageProps<"/[lang]/login">) {
  const { lang } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  const t = await getDictionary(lang);

  return (
    <main className="relative flex min-h-[75vh] w-full flex-1 items-center justify-center overflow-hidden bg-[#FAF9F6]">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-[#E9F0E6] blur-3xl" />

      <div className="pointer-events-none absolute -right-28 bottom-0 h-80 w-80 rounded-full bg-[#F7E9DE] blur-3xl" />

      <div className="relative z-10 w-full">
        <OwnerLogin
          stallName="¿Todavía hay?"
          t={t}
          successHref={`/${lang}/panel/birria-dona-lupe`}
        />
      </div>
    </main>
  );
}
