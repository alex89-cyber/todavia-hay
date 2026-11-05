"use client";

import { useState } from "react";

const T = {
  es: {
    title: "Mis datos",
    first: "Nombre",
    last: "Apellido",
    phone: "Teléfono",
    phoneHint: "Si das este teléfono al pagar en el puesto, el sello llega a tu cuenta. Los sellos que ya tenías con él se suman.",
    save: "Guardar",
    saved: "Guardado",
    bad_name: "Escribe tu nombre y tu apellido.",
    bad_phone: "Escribe un teléfono de 10 dígitos.",
    phone_taken: "Ese teléfono ya está en otra cuenta.",
    error: "No se pudo guardar. Intenta otra vez.",
    missing: "Falta tu apellido: lo piden al entregarte tu pedido.",
  },
  en: {
    title: "My details",
    first: "First name",
    last: "Last name",
    phone: "Phone",
    phoneHint: "Give this phone when paying at the stall and the stamp goes to your account. Stamps you already had with it are added.",
    save: "Save",
    saved: "Saved",
    bad_name: "Type your first and last name.",
    bad_phone: "Type a 10-digit phone number.",
    phone_taken: "That phone is already on another account.",
    error: "Couldn't save. Try again.",
    missing: "Your last name is missing: it's asked when you pick up an order.",
  },
};

export function ProfileForm({
  lang,
  initial,
}: {
  lang: "es" | "en";
  initial: { firstName: string; lastName: string; phone: string | null };
}) {
  const t = T[lang];
  const [first, setFirst] = useState(initial.firstName);
  const [last, setLast] = useState(initial.lastName);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: first, lastName: last, phone: phone.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      const key = (json.result ?? json.error ?? "error") as keyof typeof t;
      setMsg(res.ok ? { ok: true, text: t.saved } : { ok: false, text: t[key] ?? t.error });
    } catch {
      setMsg({ ok: false, text: t.error });
    } finally {
      setBusy(false);
    }
  }

  const input = "mt-1 w-full rounded-xl border border-line bg-background px-4 py-3";
  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5">
      <h2 className="font-bold">{t.title}</h2>
      {!initial.lastName && <p className="rounded-xl bg-warn-soft p-3 text-sm text-warn">{t.missing}</p>}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold">
          {t.first}
          <input className={input} value={first} onChange={(e) => setFirst(e.target.value)} maxLength={60} required />
        </label>
        <label className="text-sm font-semibold">
          {t.last}
          <input className={input} value={last} onChange={(e) => setLast(e.target.value)} maxLength={60} required />
        </label>
      </div>
      <label className="text-sm font-semibold">
        {t.phone}
        <input className={input} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
        <span className="mt-1 block text-xs font-normal text-muted">{t.phoneHint}</span>
      </label>
      {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-ok" : "text-bad"}`}>{msg.text}</p>}
      <button disabled={busy} className="self-start rounded-full bg-brand px-6 py-3 font-bold text-white disabled:opacity-60">
        {t.save}
      </button>
    </form>
  );
}
