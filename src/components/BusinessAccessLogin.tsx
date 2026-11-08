
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/auth/browser";

type Props = {
  lang: "es" | "en";
  type: "owner" | "employee";
};

export function BusinessAccessLogin({
  lang,
  type,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const owner = type === "owner";
  const es = lang === "es";

  const destination = owner
    ? `/${lang}/mis-negocios`
    : `/${lang}/empleado`;

  async function handleLogin(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = supabaseBrowser();

      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        setError(
          es
            ? "Correo o contraseña incorrectos, o cuenta sin confirmar."
            : "Incorrect credentials or unconfirmed account.",
        );
        return;
      }

      // La página de destino verifica el
      // rol real del usuario en el servidor.
      window.location.assign(destination);
    } catch {
      setError(
        es
          ? "No pudimos iniciar sesión. Intenta nuevamente."
          : "Could not sign in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[75vh] w-full flex-1 items-center justify-center bg-[#FAF7F2] px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-[#E9DED2] bg-white p-7 shadow-sm sm:p-9">

        <div className="text-center">
          <div className="text-4xl">
            {owner ? "🏪" : "👥"}
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-[#A8321E]">
            Todavía Hay
          </p>

          <h1 className="mt-3 text-2xl font-black text-[#244D38]">
            {owner
              ? es
                ? "Acceso para dueños"
                : "Owner access"
              : es
                ? "Acceso para empleados"
                : "Staff access"}
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#786B62]">
            {owner
              ? "Administra tus negocios, empleados, pedidos y ventas."
              : "Ingresa para consultar los pedidos y herramientas de tu establecimiento."}
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="mt-8 flex flex-col gap-5"
        >
          <label className="flex flex-col gap-2 text-sm font-bold">
            Correo electrónico

            <input
              type="email"
              required
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="correo@ejemplo.com"
              className="rounded-xl border border-[#E7D9CC] bg-[#FBF7F2] px-4 py-3 outline-none focus:border-[#A8321E]"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-bold">
            Contraseña

            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Tu contraseña"
              className="rounded-xl border border-[#E7D9CC] bg-[#FBF7F2] px-4 py-3 outline-none focus:border-[#A8321E]"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-[#244D38] px-6 py-3.5 font-bold text-white transition hover:bg-[#32684C] disabled:opacity-50"
          >
            {loading
              ? "Entrando..."
              : owner
                ? "Entrar a mis negocios"
                : "Entrar a mi turno"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href={`/${lang}/recuperar?next=${encodeURIComponent(destination)}`}
            className="text-sm text-[#A8321E] underline"
          >
            Olvidé mi contraseña
          </Link>
        </div>

        <div className="mt-6 border-t border-[#EEE5DA] pt-5 text-center">
          <p className="text-xs text-[#786B62]">
            {owner
              ? "¿Eres empleado? Usa el acceso para personal."
              : "¿Eres propietario? Usa el acceso para dueños."}
          </p>

          <Link
            href={
              owner
                ? `/${lang}/personal/login`
                : `/${lang}/negocios/login`
            }
            className="mt-2 inline-block text-sm font-bold text-[#244D38] underline"
          >
            {owner
              ? "Acceso para empleados"
              : "Acceso para dueños"}
          </Link>
        </div>
      </div>
    </main>
  );
}
