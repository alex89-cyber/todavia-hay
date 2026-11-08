
import Link from "next/link";

// ==========================================
// TODAVÍA HAY
// MENÚ DE INICIO DE SESIÓN
// ==========================================

type Props = {
  lang: string;
  variant?: "header" | "hero";
};

export function LoginDropdown({
  lang,
  variant = "header",
}: Props) {
  const es = lang === "es";

  const options = [
    {
      icon: "👤",
      title: es ? "Cliente" : "Customer",
      description: es
        ? "Mis pedidos y recompensas"
        : "Orders and rewards",
      href: `/${lang}/login`,
    },
    {
      icon: "🏪",
      title: es ? "Negocio" : "Business",
      description: es
        ? "Propietarios de negocios"
        : "Business owners",
      href: `/${lang}/negocios/login`,
    },
    {
      icon: "👥",
      title: es ? "Empleado" : "Employee",
      description: es
        ? "Meseros y personal"
        : "Staff members",
      href: `/${lang}/personal/login`,
    },
    {
      icon: "🛡️",
      title: es
        ? "Administración"
        : "Administration",
      description: es
        ? "Socios de Todavía Hay"
        : "Platform administrators",
      href: `/${lang}/admin/login`,
    },
  ];

  return (
    <details
      className={
        variant === "hero"
          ? "group relative w-full sm:w-auto"
          : "group relative"
      }
    >
      <summary
        className={
          variant === "hero"
            ? "flex min-h-14 cursor-pointer list-none items-center justify-center gap-2 rounded-2xl border border-[#DDE2D7] bg-white px-7 py-4 text-sm font-bold text-[#244D38] shadow-sm transition hover:border-[#244D38] [&::-webkit-details-marker]:hidden"
            : "flex cursor-pointer list-none items-center justify-center gap-2 rounded-full bg-[#244D38] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#32684C] sm:px-5 sm:text-sm [&::-webkit-details-marker]:hidden"
        }
      >
        {es ? "Iniciar sesión" : "Sign in"}

        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className="transition group-open:rotate-180"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>

      <div
        className={
          variant === "hero"
            ? "absolute left-0 top-full z-50 mt-3 w-[min(19rem,calc(100vw-3rem))] rounded-2xl border border-[#E7D9CC] bg-white p-2 shadow-2xl"
            : "absolute right-0 top-full z-50 mt-3 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-[#E7D9CC] bg-white p-2 shadow-2xl"
        }
      >
        <p className="px-3 pb-2 pt-2 text-xs font-bold uppercase tracking-wider text-[#8E968D]">
          {es
            ? "Selecciona tu acceso"
            : "Choose your access"}
        </p>

        {options.map((option, index) => (
          <div key={option.href}>
            {index === 3 && (
              <div className="my-2 border-t border-[#E8E8E3]" />
            )}

            <Link
              href={option.href}
              className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#F2F6EF] focus-visible:bg-[#F2F6EF]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3F7F0] text-xl">
                {option.icon}
              </span>

              <span className="min-w-0 flex flex-col">
                <span className="text-sm font-bold text-[#244D38]">
                  {option.title}
                </span>

                <span className="text-xs text-[#7C877D]">
                  {option.description}
                </span>
              </span>
            </Link>
          </div>
        ))}
      </div>
    </details>
  );
}
