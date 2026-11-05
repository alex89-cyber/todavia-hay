
"use client";

// ==========================================
// ¿TODAVÍA HAY?
// BARRA PARA GUARDAR CONFIGURACIÓN
// ==========================================

type Props = {
  lang: "es" | "en";

  saving: boolean;
  uploading: boolean;

  error?: string;
  notice?: string;

  hasChanges?: boolean;
  disabled?: boolean;

  onSave?: () => void;
};

export default function ConfigurationSaveBar({
  lang,
  saving,
  uploading,
  error = "",
  notice = "",
  hasChanges,
  disabled = false,
  onSave,
}: Props) {
  const es = lang === "es";

  const isBusy = saving || uploading;

  const cannotSave =
    disabled ||
    isBusy ||
    hasChanges === false;

  return (
    <div className="rounded-2xl border border-[#eaded3] bg-white p-4 shadow-sm sm:p-5">

      {/* MENSAJES */}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
        >
          {error}
        </div>
      )}

      {notice && !error && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800"
        >
          {notice}
        </div>
      )}

      {/* ESTADO DE CAMBIOS */}

      {typeof hasChanges === "boolean" && (
        <p className="mb-4 flex items-center gap-2 text-xs font-semibold text-[#80695d]">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              hasChanges
                ? "bg-amber-500"
                : "bg-green-500"
            }`}
          />

          {hasChanges
            ? es
              ? "Tienes cambios sin guardar"
              : "You have unsaved changes"
            : es
              ? "Todos los cambios están guardados"
              : "All changes are saved"}
        </p>
      )}

      {/* BOTÓN DE GUARDAR */}

      <button
        type={onSave ? "button" : "submit"}
        disabled={cannotSave}
        onClick={onSave}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#a3341f] px-6 py-4 text-sm font-black text-white shadow-sm transition hover:bg-[#862816] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? (
          <>
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />

            {es
              ? "Guardando configuración..."
              : "Saving settings..."}
          </>
        ) : uploading ? (
          <>
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />

            {es
              ? "Subiendo fotografías..."
              : "Uploading photos..."}
          </>
        ) : (
          <>
            <span aria-hidden="true">
              ✓
            </span>

            {es
              ? "Guardar configuración"
              : "Save settings"}
          </>
        )}
      </button>

      {/* INFORMACIÓN */}

      <p className="mt-3 text-center text-xs leading-5 text-[#80695d]">
        {es
          ? "Los cambios se publicarán cuando guardes la configuración."
          : "Your changes will be published when you save the settings."}
      </p>
    </div>
  );
}
