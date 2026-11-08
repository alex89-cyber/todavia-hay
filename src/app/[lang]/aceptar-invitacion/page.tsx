
"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/auth/browser";

function InvitationContent() {
  const params = useParams();
  const lang = params.lang === "en" ? "en" : "es";

  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function acceptInvitation() {
      try {
        const supabase = supabaseBrowser();

        const hash = new URLSearchParams(
          window.location.hash.slice(1)
        );

        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (hash.get("error")) {
          throw new Error(
            "El enlace de invitación no es válido o ha vencido."
          );
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;

          window.history.replaceState(
            null,
            "",
            window.location.pathname
          );
        }

        const { data, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError || !data.session) {
          throw new Error(
            "No se pudo activar la invitación. Solicita un nuevo enlace."
          );
        }

        if (!cancelled) {
          window.location.replace(
            `/${lang}/nueva-contrasena?next=` +
              encodeURIComponent(`/${lang}/cuenta`)
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo aceptar la invitación."
          );
        }
      }
    }

    void acceptInvitation();

    return () => {
      cancelled = true;
    };
  }, [lang]);

  return (
    <main className="mx-auto flex min-h-[65vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-black">
        Activar cuenta de empleado
      </h1>

      {error ? (
        <p role="alert" className="mt-4 text-red-700">
          {error}
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Verificando tu invitación...
        </p>
      )}
    </main>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<p>Verificando invitación...</p>}>
      <InvitationContent />
    </Suspense>
  );
}
