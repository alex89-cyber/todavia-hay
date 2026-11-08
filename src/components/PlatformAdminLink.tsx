
import Link from "next/link";
import { platformAdmin } from "@/lib/platform-admin";

type Props = {
  lang: string;
};

export async function PlatformAdminLink({
  lang,
}: Props) {
  const account = await platformAdmin();

  // Si no es superadministrador,
  // no mostramos el botón.
  if (!account) {
    return null;
  }

  return (
    <Link
      href={`/${lang}/admin`}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#244D38] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#32684C]"
    >
      <span aria-hidden="true">🛡️</span>
      Administrar plataforma
    </Link>
  );
}
