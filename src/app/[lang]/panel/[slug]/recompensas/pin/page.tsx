
import { Suspense } from "react";
import RewardPinClient from "./RewardPinClient";

type PageProps = {
  params: Promise<{
    lang: string;
    slug: string;
  }>;
};

export default function RewardPinPage({
  params,
}: PageProps) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#fffaf4] px-4 py-8">
          <p className="text-center text-sm text-[#80695d]">
            Cargando PIN de recompensas...
          </p>
        </main>
      }
    >
      <RewardPinContent params={params} />
    </Suspense>
  );
}

async function RewardPinContent({
  params,
}: PageProps) {
  const { lang, slug } = await params;

  return (
    <RewardPinClient
      lang={lang === "en" ? "en" : "es"}
      slug={slug}
    />
  );
}
