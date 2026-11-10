"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { supabaseBrowser } from "@/lib/auth/browser";

// Entrar, crear cuenta, olvidé mi contraseña y nueva contraseña, con correo y
// contraseña (verificación por correo) o con Google.

export type AuthMode = "login" | "signup" | "forgot" | "reset";

const TEXT = {
  es: {
    login: "Entrar",
    signup: "Crear cuenta",
    forgot: "Recuperar contraseña",
    reset: "Nueva contraseña",
    loginLead: "Entra con tu correo para apartar y ver tus sellos.",
    signupLead: "Tu nombre y apellido se usan para entregarte tus pedidos.",
    forgotLead: "Te mandamos un enlace para poner una contraseña nueva.",
    resetLead: "Escribe la contraseña que vas a usar de ahora en adelante.",
    google: "Entrar con Google",
    or: "o con tu correo",
    email: "Correo",
    password: "Contraseña",
    newPassword: "Contraseña nueva (mínimo 8)",
    firstName: "Nombre",
    lastName: "Apellido",
    phone: "Teléfono (opcional, para tus sellos del mostrador)",
    noAccount: "¿No tienes cuenta?",
    haveAccount: "¿Ya tienes cuenta?",
    forgotLink: "Olvidé mi contraseña",
    back: "Volver a entrar",
    sent: "Te mandamos un correo a {email}. Abre el enlace para confirmar tu cuenta y luego entra.",
    resetSent: "Si {email} tiene cuenta, te llegará un enlace para poner una contraseña nueva.",
    saved: "Contraseña guardada.",
    wrong: "Correo o contraseña incorrectos.",
    notConfirmed: "Todavía no confirmas tu correo. Revisa tu bandeja (y spam).",
    exists: "Ya hay una cuenta o una invitación con ese correo. Si te invitaron, abre el correo de invitación o usa «Olvidé mi contraseña» para crear tu contraseña.",
    linkUsed: "Ese enlace ya se usó o venció. Si te invitaron y nunca pusiste contraseña, usa «Olvidé mi contraseña» con tu correo para crearla.",
    weak: "La contraseña debe tener al menos 8 caracteres.",
    names: "Escribe tu nombre y tu apellido.",
    error: "Algo falló. Intenta otra vez.",
    tooMany: "Demasiados intentos. Espera unos minutos.",
  },
  en: {
    login: "Sign in",
    signup: "Create account",
    forgot: "Reset password",
    reset: "New password",
    loginLead: "Sign in with your email to reserve and see your stamps.",
    signupLead: "Your first and last name are used to hand you your orders.",
    forgotLead: "We'll email you a link to set a new password.",
    resetLead: "Type the password you'll use from now on.",
    google: "Continue with Google",
    or: "or with your email",
    email: "Email",
    password: "Password",
    newPassword: "New password (8+ characters)",
    firstName: "First name",
    lastName: "Last name",
    phone: "Phone (optional, for stamps at the counter)",
    noAccount: "No account yet?",
    haveAccount: "Already have an account?",
    forgotLink: "Forgot my password",
    back: "Back to sign in",
    sent: "We emailed {email}. Open the link to confirm your account, then sign in.",
    resetSent: "If {email} has an account, you'll get a link to set a new password.",
    saved: "Password saved.",
    wrong: "Wrong email or password.",
    notConfirmed: "You haven't confirmed your email yet. Check your inbox (and spam).",
    exists: "There's already an account or an invitation for that email. If you were invited, open the invitation email or use “Forgot my password” to set your password.",
    linkUsed: "That link was already used or expired. If you were invited and never set a password, use “Forgot my password” with your email to set it.",
    weak: "The password needs at least 8 characters.",
    names: "Type your first and last name.",
    error: "Something failed. Try again.",
    tooMany: "Too many tries. Wait a few minutes.",
  },
};

export function AuthForm({
  mode,
  lang,
  next,
  allowSignup = true,
  linkError = false,
}: {
  mode: AuthMode;
  lang: "es" | "en";
  next: string;
  /** false: no "Crear cuenta" link (partner portal, accounts are invitation only). */
  allowSignup?: boolean;
  /** Viene de un enlace del correo que ya se usó o venció. */
  linkError?: boolean;
}) {
  const t = TEXT[lang];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(linkError && mode === "login" ? t.linkUsed : null);
  const [done, setDone] = useState<string | null>(null);

  const q = `?next=${encodeURIComponent(next)}`;
  const callback = (to: string) => `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(to)}`;

  function explain(e: { message?: string; code?: string; status?: number }) {
    const m = `${e.code ?? ""} ${e.message ?? ""}`.toLowerCase();
    if (m.includes("invalid") && m.includes("credential")) return t.wrong;
    if (m.includes("not confirmed") || m.includes("email_not_confirmed")) return t.notConfirmed;
    if (m.includes("already") || m.includes("user_already_exists")) return t.exists;
    if (m.includes("password") && (m.includes("weak") || m.includes("short") || m.includes("least"))) return t.weak;
    if (e.status === 429 || m.includes("rate")) return t.tooMany;
    return t.error;
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const sb = supabaseBrowser();
    if ((mode === "signup" || mode === "reset") && password.length < 8) return setError(t.weak);
    if (mode === "signup" && (!firstName.trim() || !lastName.trim())) return setError(t.names);
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) return setError(explain(error));
        window.location.assign(next);
      } else if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: callback(next),
            data: { first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() || null, next, lang },
          },
        });
        if (error) return setError(explain(error));
        // Supabase answers an existing address with a user that has no identities.
        if (data.user && data.user.identities?.length === 0) return setError(t.exists);
        if (data.session) return window.location.assign(next);
        setDone(t.sent.replace("{email}", email.trim()));
      } else if (mode === "forgot") {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: callback(`/${lang}/nueva-contrasena${q}`),
        });
        if (error) return setError(explain(error));
        setDone(t.resetSent.replace("{email}", email.trim()));
      } else {
        const { error } = await sb.auth.updateUser({ password });
        if (error) return setError(explain(error));
        setDone(t.saved);
        window.location.assign(next);
      }
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback(next) },
    });
    if (error) {
      setBusy(false);
      setError(explain(error));
    }
  }

  const input =
    "mt-1 w-full rounded-xl border border-line bg-background px-4 py-3 text-base outline-none focus:border-brand";

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-black">{t[mode]}</h1>
      <p className="mt-1 text-sm text-muted">{t[`${mode}Lead` as const]}</p>

      {done ? (
        <p role="status" className="mt-6 rounded-2xl bg-ok-soft p-4 text-sm font-semibold text-ok">
          {done}
        </p>
      ) : (
        <>
          {(mode === "login" || mode === "signup") && (
            <>
              <button
                type="button"
                onClick={google}
                disabled={busy}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-line bg-white py-3 font-semibold text-[#1f1f1f] active:scale-[0.98] disabled:opacity-60"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
                </svg>
                {t.google}
              </button>
              <p className="my-4 text-center text-xs uppercase tracking-wide text-muted">{t.or}</p>
            </>
          )}

          <form onSubmit={submit} className={`flex flex-col gap-3 ${mode === "forgot" || mode === "reset" ? "mt-6" : ""}`}>
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-semibold">
                  {t.firstName}
                  <input className={input} value={firstName} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" maxLength={60} required />
                </label>
                <label className="text-sm font-semibold">
                  {t.lastName}
                  <input className={input} value={lastName} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" maxLength={60} required />
                </label>
              </div>
            )}
            {mode !== "reset" && (
              <label className="text-sm font-semibold">
                {t.email}
                <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </label>
            )}
            {mode !== "forgot" && (
              <label className="text-sm font-semibold">
                {mode === "login" ? t.password : t.newPassword}
                <input
                  className={input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "login" ? undefined : 8}
                  required
                />
              </label>
            )}
            {mode === "signup" && (
              <label className="text-sm font-semibold">
                {t.phone}
                <input className={input} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" maxLength={20} />
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm font-semibold text-bad">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className="mt-2 rounded-full bg-brand py-3.5 font-bold text-white active:scale-[0.98] disabled:opacity-60">
              {t[mode]}
            </button>
          </form>
        </>
      )}

      <div className="mt-6 flex flex-col gap-2 text-center text-sm">
        {mode === "login" && (
          <>
            {allowSignup && (
              <p>
                {t.noAccount}{" "}
                <Link className="font-semibold text-brand underline" href={`/${lang}/registro${q}`}>
                  {t.signup}
                </Link>
              </p>
            )}
            <Link className="text-muted underline" href={`/${lang}/recuperar${q}`}>
              {t.forgotLink}
            </Link>
          </>
        )}
        {mode === "signup" && (
          <p>
            {t.haveAccount}{" "}
            <Link className="font-semibold text-brand underline" href={`/${lang}/login${q}`}>
              {t.login}
            </Link>
          </p>
        )}
        {mode === "forgot" && (
          <Link className="text-muted underline" href={`/${lang}/login${q}`}>
            {t.back}
          </Link>
        )}
      </div>
    </div>
  );
}
