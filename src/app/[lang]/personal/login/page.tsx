
import { notFound } from "next/navigation";

import { hasLocale } from "@/dictionaries";

import { BusinessAccessLogin } from
  "@/components/BusinessAccessLogin";

type Props = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function StaffLoginPage({
  params,
}: Props) {
  const { lang } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  return (
    <BusinessAccessLogin
      lang={lang}
      type="employee"
    />
  );
}
