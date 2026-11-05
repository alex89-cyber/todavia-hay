
import type { ReactNode } from "react";

// ==========================================
// SECCIÓN DEL FORMULARIO
// ==========================================

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[#eaded3] bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-xl font-black text-[#302018]">
        {title}
      </h2>

      {description && (
        <p className="mt-2 text-sm leading-relaxed text-[#80695d]">
          {description}
        </p>
      )}

      <div className="mt-6">
        {children}
      </div>
    </section>
  );
}

// ==========================================
// CAMPO DE TEXTO
// ==========================================

export function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  type = "text",
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
  maxLength?: number;
}) {
  const classes =
    "mt-2 w-full rounded-xl border border-[#e7d8ca] bg-white px-4 py-3 text-sm text-[#302018] outline-none transition focus:border-[#a3341f] focus:ring-2 focus:ring-[#a3341f]/10";

  return (
    <label className="block min-w-0">
      <span className="text-sm font-semibold text-[#4b3024]">
        {label}
      </span>

      {multiline ? (
        <textarea
          rows={4}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={classes}
        />
      ) : (
        <input
          type={type}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={classes}
        />
      )}
    </label>
  );
}

// ==========================================
// SELECTOR DE COLOR
// ==========================================

function validHex(
  value: string | undefined,
  fallback: string,
): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : fallback;
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-[#eaded3] p-3">
      <input
        type="color"
        value={validHex(value, "#ffffff")}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-12 cursor-pointer rounded-lg border-0 bg-transparent"
      />

      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#302018]">
          {label}
        </span>

        <span className="text-xs text-[#80695d]">
          {value}
        </span>
      </span>
    </label>
  );
}

// ==========================================
// INTERRUPTOR DE VISIBILIDAD
// ==========================================

export function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#eaded3] bg-[#fffaf4] px-4 py-3">
      <span className="text-sm font-semibold text-[#302018]">
        {label}
      </span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 accent-[#a3341f]"
      />
    </label>
  );
}
