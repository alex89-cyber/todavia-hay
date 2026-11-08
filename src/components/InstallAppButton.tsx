"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// "Instalar app": adds the stall page to the home screen.
// - Chrome / Edge / Android: uses the browser's own install prompt
//   (beforeinstallprompt), so one tap installs.
// - iPhone / iPad: Safari has no prompt, so the button opens the steps
//   (Compartir → Agregar a inicio).
// Hidden when the page already runs as an installed app.

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const noop = () => () => {};

export function isIos(ua: string) {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua));
}

function installed() {
  const standalone = (navigator as { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

const TEXT = {
  es: {
    install: "Instalar app",
    installed: "App instalada",
    title: "Instala ¿Todavía hay? en tu iPhone",
    step1: "Toca el botón Compartir",
    step1b: "(el cuadro con la flecha hacia arriba, abajo o arriba de la pantalla).",
    step2: "Baja y toca «Agregar a inicio».",
    step3: "Toca «Agregar». La app queda en tu pantalla de inicio y abre directo en este puesto.",
    why: "Así también te llegan los avisos de «Avísame cuando haya».",
    close: "Entendido",
  },
  en: {
    install: "Install app",
    installed: "App installed",
    title: "Install ¿Todavía hay? on your iPhone",
    step1: "Tap the Share button",
    step1b: "(the square with an arrow pointing up, at the bottom or top of the screen).",
    step2: "Scroll down and tap “Add to Home Screen”.",
    step3: "Tap “Add”. The app lands on your home screen and opens right on this stall.",
    why: "This is also how “Notify me” alerts reach you.",
    close: "Got it",
  },
};

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="inline size-5 align-text-bottom" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

export function InstallAppButton({ lang, className = "" }: { lang: "es" | "en"; className?: string }) {
  const tx = TEXT[lang];
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [done, setDone] = useState(false);
  const [help, setHelp] = useState(false);
  // Read on the client only, so the server render never shows the button.
  const ios = useSyncExternalStore(noop, () => isIos(navigator.userAgent), () => false);
  const already = useSyncExternalStore(noop, installed, () => true);

  useEffect(() => {
    const early = (window as { __installPrompt?: InstallPrompt }).__installPrompt;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the event may have fired before hydration
    if (early) setPrompt(early);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => {
      setDone(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (already) return null;
  if (done) {
    return (
      <span className={`inline-flex items-center gap-2 rounded-full bg-ok-soft px-4 py-2 text-sm font-bold text-ok ${className}`}>
        ✓ {tx.installed}
      </span>
    );
  }
  if (!prompt && !ios) return null;

  async function install() {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      setPrompt(null);
      if (outcome === "accepted") setDone(true);
      return;
    }
    setHelp(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white active:scale-95 ${className}`}
      >
        <span aria-hidden="true">⬇</span> {tx.install}
      </button>

      {help && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-surface p-6 text-left text-[#2e1b14] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="install-title" className="text-lg font-black">
              {tx.title}
            </h2>
            <ol className="mt-4 flex list-decimal flex-col gap-3 pl-5 text-sm leading-relaxed">
              <li>
                {tx.step1} <ShareIcon /> {tx.step1b}
              </li>
              <li>{tx.step2}</li>
              <li>{tx.step3}</li>
            </ol>
            <p className="mt-4 text-xs text-muted">{tx.why}</p>
            <button
              type="button"
              onClick={() => setHelp(false)}
              className="mt-5 w-full rounded-2xl bg-brand px-4 py-3 text-sm font-bold text-white"
            >
              {tx.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
