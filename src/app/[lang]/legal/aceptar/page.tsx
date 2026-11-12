
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function LegalAcceptancePage() {
  const params = useParams();
  const lang = params.lang === "en" ? "en" : "es";
  const es = lang === "es";

  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function continueRegistration() {
    if (!accepted || busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/legal/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "No se pudo continuar.",
        );
      }

      const next = new URLSearchParams(
        window.location.search,
      ).get("next");

      const destination =
        next?.startsWith("/") &&
        !next.startsWith("//") &&
        !next.includes("\\") &&
        !next.startsWith(`/${lang}/legal/aceptar`)
          ? next
          : result.role === "owner"
            ? `/${lang}/panel`
            : result.role === "employee"
              ? `/${lang}/empleado`
              : `/${lang}/cuenta`;

      window.location.assign(destination);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : es
            ? "Ocurrió un error."
            : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-black">
          {es
            ? "Antes de comenzar"
            : "Before you continue"}
        </h1>

        <p className="mt-3 text-sm text-muted">
          {es
            ? "Para utilizar Todavía Hay, debes revisar y aceptar las condiciones de uso correspondientes a tu cuenta."
            : "To use Todavía Hay, you must review and accept the terms that apply to your account."}
        </p>

        <div className="mt-5 space-y-3">
          <p className="text-sm">
            <Link
              href={`/${lang}/legal/terminos/customer`}
              target="_blank"
              className="font-semibold text-brand underline"
            >
              {es
                ? "Términos para clientes"
                : "Customer terms"}
            </Link>
          </p>

          <p className="text-sm">
            <Link
              href={`/${lang}/legal/terminos/employee`}
              target="_blank"
              className="font-semibold text-brand underline"
            >
              {es
                ? "Condiciones para empleados"
                : "Employee terms"}
            </Link>
          </p>

          <p className="text-sm">
            <Link
              href={`/${lang}/legal/terminos/owner`}
              target="_blank"
              className="font-semibold text-brand underline"
            >
              {es
                ? "Términos para propietarios"
                : "Owner terms"}
            </Link>
          </p>

          <p className="text-sm">
            <Link
              href={`/${lang}/legal/privacidad`}
              target="_blank"
              className="font-semibold text-brand underline"
            >
              {es
                ? "Aviso de privacidad"
                : "Privacy notice"}
            </Link>
          </p>
        </div>

        <label className="mt-6 flex items-start gap-3 rounded-xl border border-line p-4 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) =>
              setAccepted(event.target.checked)
            }
            className="mt-1 size-4 accent-[#a3341f]"
          />

          <span>
            {es
              ? "He leído y acepto los términos aplicables a mi cuenta y confirmo haber consultado el aviso de privacidad."
              : "I have read and accept the terms applicable to my account and acknowledge the privacy notice."}
          </span>
        </label>

        {error && (
          <p
            role="alert"
            className="mt-4 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={continueRegistration}
          disabled={!accepted || busy}
          className="mt-5 w-full rounded-full bg-brand px-5 py-3.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy
            ? "..."
            : es
              ? "Aceptar y continuar"
              : "Accept and continue"}
        </button>
      </div>
    </main>
  );
}
