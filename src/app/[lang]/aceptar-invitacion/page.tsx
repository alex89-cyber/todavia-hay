"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/auth/browser";

// ==========================================
// ACEPTAR INVITACIÓN (Y PONER CONTRASEÑA)
// ==========================================
//
// El enlace del correo llega aquí de dos formas:
//
// 1. ?token_hash=...&type=invite|recovery
//    (plantilla de Supabase con token_hash).
//    El enlace NO se usa al abrir la página:
//    se usa hasta que la persona pone su
//    contraseña y toca el botón. Así, si el
//    antivirus del correo (Outlook, correos
//    de escuela o empresa) abre el enlace
//    antes que ella, el enlace sigue sirviendo.
//
// 2. #access_token=...  (plantilla por default
//    de Supabase). La sesión ya viene lista.
// ==========================================

const TEXT = {
  es: {
    inviteTitle: "Crea tu cuenta",
    inviteLead: "Te invitaron a ¿Todavía hay? Pon la contraseña con la que vas a entrar.",
    resetTitle: "Nueva contraseña",
    resetLead: "Escribe la contraseña que vas a usar de ahora en adelante.",
    password: "Contraseña (mínimo 8)",
    confirm: "Repite la contraseña",
    inviteButton: "Crear mi cuenta",
    resetButton: "Guardar contraseña",
    checking: "Revisando tu enlace…",
    weak: "La contraseña debe tener al menos 8 caracteres.",
    mismatch: "Las contraseñas no coinciden.",
    used:
      "Este enlace ya se usó o venció. A veces el correo de la escuela o el trabajo lo abre solo para revisarlo. Pide que te reenvíen la invitación, o pon tu correo en «Olvidé mi contraseña» para crear tu contraseña.",
    forgot: "Olvidé mi contraseña",
    login: "Ir a entrar",
    error: "Algo falló. Intenta otra vez.",
  },
  en: {
    inviteTitle: "Create your account",
    inviteLead: "You were invited to ¿Todavía hay? Choose the password you'll sign in with.",
    resetTitle: "New password",
    resetLead: "Type the password you'll use from now on.",
    password: "Password (8+ characters)",
    confirm: "Repeat the password",
    inviteButton: "Create my account",
    resetButton: "Save password",
    checking: "Checking your link…",
    weak: "The password needs at least 8 characters.",
    mismatch: "The passwords don't match.",
    used:
      "This link was already used or expired. School or work email sometimes opens links to scan them. Ask for a new invitation, or enter your email in “Forgot my password” to set your password.",
    forgot: "Forgot my password",
    login: "Go to sign in",
    error: "Something failed. Try again.",
  },
};

/** Solo rutas internas (evita redirigir a otro sitio). */
function safeNext(raw: string | null, fallback: string) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  return raw;
}

type Stage = "checking" | "ready" | "used";

function InvitationContent() {
  const params = useParams();
  const lang = params.lang === "en" ? "en" : "es";
  const t = TEXT[lang];

  const [stage, setStage] = useState<Stage>("checking");
  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const [type, setType] = useState<EmailOtpType>("invite");
  const [next, setNext] = useState(`/${lang}/cuenta`);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const linkType = query.get("type") === "recovery" ? "recovery" : "invite";

      setType(linkType);
      // Si "next" es otra vez la página de nueva contraseña,
      // ir directo a donde esa página iba a mandar.
      let to = safeNext(query.get("next"), `/${lang}/cuenta`);
      if (/^\/(es|en)\/nueva-contrasena/.test(to)) {
        to = safeNext(new URL(to, window.location.origin).searchParams.get("next"), `/${lang}/cuenta`);
      }
      setNext(to);

      // Enlace vencido o ya usado (Supabase lo manda en el #).
      if (hash.get("error") || query.get("error")) {
        if (!cancelled) setStage("used");
        return;
      }

      // 1. token_hash: se usa hasta tocar el botón.
      const hashToken = query.get("token_hash");
      if (hashToken) {
        if (!cancelled) {
          setTokenHash(hashToken);
          setStage("ready");
        }
        return;
      }

      // 2. La sesión viene en el # (plantilla por default).
      const supabase = supabaseBrowser();
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        if (error) {
          if (!cancelled) setStage("used");
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!cancelled) setStage(data.session ? "ready" : "used");
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, [lang]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");

    if (password.length < 8) return setError(t.weak);
    if (password !== confirm) return setError(t.mismatch);

    setBusy(true);
    try {
      const supabase = supabaseBrowser();

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) {
          setStage("used");
          return;
        }
        // Ya se usó: si algo falla después, no volver a intentarlo.
        setTokenHash(null);
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(/least|short|weak/i.test(error.message) ? t.weak : t.error);
        return;
      }

      window.location.assign(next);
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  const invite = type === "invite";
  const input =
    "mt-1 w-full rounded-xl border border-line bg-[#fbf7f2] px-4 py-3 text-base outline-none focus:border-brand";

  return (
    <main className="flex w-full flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-black">{invite ? t.inviteTitle : t.resetTitle}</h1>

        {stage === "checking" && <p className="mt-4 text-sm text-muted">{t.checking}</p>}

        {stage === "used" && (
          <>
            <p role="alert" className="mt-4 text-sm font-semibold text-bad">
              {t.used}
            </p>
            <div className="mt-6 flex flex-col gap-2 text-center text-sm">
              <Link className="font-semibold text-brand underline" href={`/${lang}/recuperar`}>
                {t.forgot}
              </Link>
              <Link className="text-muted underline" href={`/${lang}/login`}>
                {t.login}
              </Link>
            </div>
          </>
        )}

        {stage === "ready" && (
          <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
            <p className="text-sm text-muted">{invite ? t.inviteLead : t.resetLead}</p>
            <label className="text-sm font-semibold">
              {t.password}
              <input
                className={input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <label className="text-sm font-semibold">
              {t.confirm}
              <input
                className={input}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            {error && (
              <p role="alert" className="text-sm font-semibold text-bad">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-2 rounded-full bg-brand py-3.5 font-bold text-white active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? "…" : invite ? t.inviteButton : t.resetButton}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense>
      <InvitationContent />
    </Suspense>
  );
}
