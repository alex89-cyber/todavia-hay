
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import type { Dictionary } from "@/dictionaries";

/**
 * Asks for the owner PIN.
 *
 * Existing panel:
 * - Refreshes the page after successful login.
 *
 * Standalone login:
 * - Navigates to successHref after successful login.
 */
export function OwnerLogin({
  stallName,
  t,
  successHref,
}: {
  stallName: string;
  t: Dictionary;
  successHref?: string;
}) {
  const o = t.owner;
  const router = useRouter();

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const isStandalone = Boolean(successHref);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (busy || !pin.trim()) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/owner/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ pin }),
      });

      if (response.ok) {
        setPin("");

        if (successHref) {
          // Full navigation ensures the server receives
          // the newly established login cookie.
          window.location.assign(successHref);
          return;
        }

        startTransition(() => {
          router.refresh();
        });

        return;
      }

      setPin("");

      setError(
        response.status === 429
          ? o.pinTooMany
          : response.status === 401
            ? o.pinWrong
            : o.pinError,
      );
    } catch {
      setError(o.pinError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-5 py-12 sm:py-16">
      <div className="rounded-[2rem] border border-[#E4EAE1] bg-white p-6 shadow-[0_20px_60px_rgba(36,77,56,0.07)] sm:p-9">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[#244D38] text-3xl text-white shadow-sm">
            ✳
          </div>

          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#B9805B]">
            {isStandalone ? "BUSINESS LOGIN" : o.title}
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-[#244D38]">
            {stallName}
          </h1>

          <p className="mt-4 text-sm leading-7 text-[#78877C]">
            {o.pinHint}
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-5">
          <div>
            <label
              htmlFor="owner-pin"
              className="mb-2 block text-sm font-bold text-[#526C59]"
            >
              {o.pinLabel}
            </label>

            <input
              id="owner-pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              autoFocus
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(null);
              }}
              aria-label={o.pinLabel}
              placeholder="••••"
              className="w-full rounded-2xl border border-[#DDE5DA] bg-[#FAFBF8] px-4 py-4 text-center text-2xl font-semibold tracking-[0.4em] text-[#244D38] outline-none transition focus:border-[#6DA27D] focus:ring-4 focus:ring-[#6DA27D]/10"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-[#FFF1ED] px-4 py-3 text-center text-sm font-semibold text-[#A64C40]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !pin.trim()}
            className="flex min-h-14 items-center justify-center rounded-2xl bg-[#244D38] px-6 py-4 text-sm font-black text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#32684C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "…" : o.pinEnter}
          </button>
        </form>

        {isStandalone && (
          <Link
            href="/"
            className="mt-6 block text-center text-sm font-semibold text-[#78877C] underline decoration-[#E68B5C] underline-offset-4 transition hover:text-[#244D38]"
          >
            ← ¿Todavía hay?
          </Link>
        )}
      </div>
    </div>
  );
}
