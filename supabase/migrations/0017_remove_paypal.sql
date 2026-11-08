-- 0017: quita lo que quedaba del cobro con PayPal.
--
-- Los apartados se pagan al recoger y la venta se registra con el
-- método que anota el negocio (efectivo, tarjeta o transferencia).
-- Las columnas del pedido en PayPal ya no las usa la app.
--
-- No borra ventas. Si alguna venta vieja quedó con el método antiguo,
-- la app la muestra como tarjeta.

alter table public.reservations
  drop column if exists paypal_order_id,
  drop column if exists paypal_authorization_id;
