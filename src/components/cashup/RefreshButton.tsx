"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Reloads the day's numbers from the server without leaving the page. */
export function RefreshButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => router.refresh())}
      disabled={pending}
      className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white active:scale-95 disabled:opacity-60"
    >
      {pending ? "…" : `↻ ${label}`}
    </button>
  );
}
