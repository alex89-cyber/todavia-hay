
/**
 * TODAVÍA HAY
 *
 * Métodos de pago contra entrega.
 *
 * El cliente realiza el pedido sin pagar
 * en línea.
 *
 * Al validar el NIP, el negocio selecciona
 * cómo recibió el pago.
 */

export const PAYMENT_METHODS = [
  "cash",
  "card",
  "transfer",
] as const;

export type DeliveryPaymentMethod =
  (typeof PAYMENT_METHODS)[number];

// Nombres que aparecen en el panel del negocio.
export const PAYMENT_METHOD_LABELS: Record<
  DeliveryPaymentMethod,
  string
> = {
  cash: "Efectivo",
  card: "Terminal bancaria",
  transfer: "Transferencia",
};

// Comprobar que el método es válido.
export function isDeliveryPaymentMethod(
  value: unknown,
): value is DeliveryPaymentMethod {
  return (
    typeof value === "string" &&
    PAYMENT_METHODS.some(
      (method) => method === value,
    )
  );
}

// Obtener el nombre del método de pago.
export function getPaymentMethodLabel(
  method: DeliveryPaymentMethod,
): string {
  return PAYMENT_METHOD_LABELS[method];
}
