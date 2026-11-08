
from pathlib import Path

# ==========================================
# TODAVÍA HAY
# ACTUALIZAR PANEL DE NEGOCIO
# PAGOS CONTRA ENTREGA
# ==========================================

archivo = Path("src/components/OwnerPanel.tsx")

if not archivo.exists():
    raise FileNotFoundError(
        "No se encontró OwnerPanel.tsx"
    )

codigo = archivo.read_text(encoding="utf-8-sig")

# Crear respaldo antes de modificar.
respaldo = archivo.with_suffix(".tsx.bak")
if not respaldo.exists():
    respaldo.write_text(codigo, encoding="utf-8")


def reemplazar(anterior, nuevo):
    global codigo

    if codigo.count(anterior) != 1:
        raise ValueError(
            "No se encontró exactamente una coincidencia:\n"
            + anterior[:100]
        )

    codigo = codigo.replace(anterior, nuevo, 1)


# ==========================================
# 1. IMPORTAR MÉTODOS DE PAGO
# ==========================================

reemplazar(
    'import { subscribePush } from "@/lib/client-push";',
    'import { subscribePush } from "@/lib/client-push";\n'
    'import type { DeliveryPaymentMethod } from "@/lib/payment-methods";',
)


# ==========================================
# 2. CONECTAR API DE ENTREGA
# ==========================================

inicio = codigo.index(
    "        onDeliver={async (id, proof) => {"
)

fin = codigo.index(
    "        onCancel={async (id) => {",
    inicio,
)

codigo = (
    codigo[:inicio]
    + """
        onDeliver={async (id, proof, method) => {
          setBusy(true);

          try {
            const response = await fetch(
              `/api/stalls/${view.slug}/deliver`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  reservationId: id,
                  ...proof,
                  method,
                }),
              },
            );

            const result = await response.json();

            if (!response.ok) {
              const error =
                typeof result.error === "string"
                  ? result.error
                  : "delivery_failed";

              if (
                error !== "wrong_code" &&
                error !== "wrong_last_name"
              ) {
                setToast({
                  kind: "bad",
                  text: es
                    ? "No se pudo registrar la entrega."
                    : "Could not record delivery.",
                });
              }

              return error;
            }

            const updated = await fetch(
              `/api/stalls/${view.slug}?view=owner`,
              { cache: "no-store" },
            );

            if (updated.ok) {
              setView(await updated.json());
            }

            setToast({
              kind: "ok",
              text: o.delivered,
            });

            return null;
          } catch {
            setToast({
              kind: "bad",
              text: es
                ? "Error de conexión"
                : "Connection error",
            });

            return "delivery_failed";
          } finally {
            setBusy(false);
          }
        }}
"""
    + codigo[fin:]
)


# ==========================================
# 3. ACTUALIZAR TIPO DE ENTREGA
# ==========================================

reemplazar(
    """  onDeliver: (
    id: string,
    proof: { code?: string; lastName?: string },
  ) => Promise<string | null>;""",
    """  onDeliver: (
    id: string,
    proof: { code?: string; lastName?: string },
    method: DeliveryPaymentMethod,
  ) => Promise<string | null>;""",
)


# ==========================================
# 4. MOSTRAR SIEMPRE EL DIÁLOGO
# ==========================================

reemplazar(
    """  const deliver = (r: Reservation) => {
    if (r.pickupCode) setHanding(r);
    else void onDeliver(r.id, {});
  };""",
    """  const deliver = (r: Reservation) => {
    setHanding(r);
  };""",
)


# ==========================================
# 5. ENVIAR MÉTODO DESDE EL DIÁLOGO
# ==========================================

reemplazar(
    """          onDeliver={async (proof) => {
            const error = await onDeliver(handing.id, proof);
            if (!error) setHanding(null);
            return error;
          }}""",
    """          onDeliver={async (proof, method) => {
            const error = await onDeliver(
              handing.id,
              proof,
              method,
            );

            if (!error) setHanding(null);
            return error;
          }}""",
)


# ==========================================
# 6. NUEVO DIÁLOGO DE NIP Y PAGO
# ==========================================

inicio = codigo.index("function HandOverDialog({")

fin = codigo.index(
    "/* ========================================\n"
    "   REABASTECIMIENTO",
    inicio,
)

dialogo = """
function HandOverDialog({
  r,
  items,
  t,
  busy,
  onClose,
  onDeliver,
}: {
  r: Reservation;
  items: string;
  t: Dictionary;
  busy: boolean;
  onClose: () => void;
  onDeliver: (
    proof: { code?: string; lastName?: string },
    method: DeliveryPaymentMethod,
  ) => Promise<string | null>;
}) {
  const o = t.owner;

  const [code, setCode] = useState("");
  const [lastName, setLastName] = useState("");
  const [noCode, setNoCode] = useState(!r.pickupCode);

  const [method, setMethod] = useState<
    DeliveryPaymentMethod | ""
  >("");

  const [error, setError] = useState<string | null>(null);

  const [tries, setTries] = useState(0);

  const validProof = noCode
    ? lastName.trim().length >= 2
    : code.length === 4;

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!validProof || !method || busy) return;

    setError(null);

    const result = await onDeliver(
      noCode
        ? { lastName: lastName.trim() }
        : { code },
      method,
    );

    if (!result) return;

    setError(
      result === "wrong_code"
        ? o.handWrongCode
        : result === "wrong_last_name"
          ? o.handWrongLastName
          : "No se pudo registrar el pago y la entrega.",
    );

    setTries((n) => n + 1);

    if (result === "wrong_code") {
      setCode("");
    }
  }

  return (
    <Sheet>
      <form onSubmit={submit}>
        <p className="text-sm font-bold uppercase text-muted">
          {o.handTitle}
        </p>

        <p className="mt-2 text-2xl font-black">
          {r.orderNumber && (
            <span className="text-brand">
              #{r.orderNumber} ·{" "}
            </span>
          )}
          {r.customerName}
        </p>

        <p className="mt-1 text-sm">{items}</p>

        {!noCode ? (
          <>
            <p className="mt-6 font-semibold">
              {o.handAskCode}
            </p>

            <label
              key={tries}
              className="relative mt-3 flex justify-center gap-3"
            >
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="flex h-16 w-14 items-center justify-center rounded-2xl border-2 border-line font-mono text-3xl font-black"
                >
                  {code[i] ?? ""}
                </span>
              ))}

              <input
                autoFocus
                value={code}
                onChange={(e) => {
                  setCode(
                    e.target.value
                      .replace(/\\D/g, "")
                      .slice(0, 4),
                  );
                  setError(null);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label={o.handAskCode}
                disabled={busy}
                className="absolute inset-0 opacity-0"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                setNoCode(true);
                setError(null);
              }}
              className="mt-4 w-full text-sm text-muted underline"
            >
              {o.handNoCode}
            </button>
          </>
        ) : (
          <>
            <label className="mt-6 flex flex-col gap-2">
              <span className="font-semibold">
                {o.handAskLastName}
              </span>

              <input
                autoFocus
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setError(null);
                }}
                className="rounded-xl border-2 border-line bg-background px-4 py-3"
              />
            </label>

            {r.pickupCode && (
              <button
                type="button"
                onClick={() => setNoCode(false)}
                className="mt-3 text-sm text-muted underline"
              >
                {o.handBackToCode}
              </button>
            )}
          </>
        )}

        <fieldset className="mt-6">
          <legend className="mb-3 font-bold">
            ¿Cómo pagó el cliente?
          </legend>

          <div className="grid gap-2">
            {([
              ["cash", "Efectivo"],
              ["card", "Terminal bancaria"],
              ["transfer", "Transferencia"],
            ] as const).map(([value, title]) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3"
              >
                <input
                  type="radio"
                  name="payment-method"
                  value={value}
                  checked={method === value}
                  onChange={() => setMethod(value)}
                  disabled={busy}
                />

                <span className="font-semibold">
                  {title}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p
            role="alert"
            className="mt-3 font-semibold text-bad"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !validProof || !method}
          className="mt-5 w-full rounded-xl bg-ok px-5 py-3.5 font-bold text-white disabled:opacity-40"
        >
          {busy
            ? "Registrando..."
            : "Confirmar pago y entrega"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-xl border border-line px-5 py-3 font-semibold"
        >
          {o.handCancel}
        </button>
      </form>
    </Sheet>
  );
}

"""

codigo = codigo[:inicio] + dialogo + codigo[fin:]


# ==========================================
# 7. MOSTRAR TRANSFERENCIAS EN CORTE
# ==========================================

reemplazar(
    """          {cashUp.byMethod.paypal > 0 && (""",
    """          <span>
            Transferencia:{" "}
            <b>{fmt(cashUp.byMethod.transfer)}</b>
          </span>

          {cashUp.byMethod.paypal > 0 && (""",
)


# ==========================================
# 8. GUARDAR ARCHIVO ACTUALIZADO
# ==========================================

archivo.write_text(codigo, encoding="utf-8")

print("OwnerPanel.tsx actualizado correctamente.")
print("Respaldo:", respaldo)
