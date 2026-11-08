
/**
 * TODAVÍA HAY
 *
 * Antigua ruta de retorno de PayPal.
 *
 * Los pedidos ahora se realizan sin pagar
 * por Internet.
 *
 * El negocio registra el método de pago
 * cuando el cliente recoge su pedido
 * y valida el NIP.
 *
 * Esta ruta se conserva desactivada para
 * impedir que enlaces antiguos de PayPal
 * modifiquen pedidos.
 */

export async function GET() {
  return Response.json(
    {
      error: "paypal_disabled",
      message:
        "Los pagos con PayPal ya no están disponibles.",
    },
    {
      status: 410,
    },
  );
}
