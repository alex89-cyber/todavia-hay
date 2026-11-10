
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { RewardsChatInvite } from "./RewardsChatInvite";
import type { Dictionary } from "@/dictionaries";

import type {
  AgentReservation,
  ChatMessage,
  PickupChoices,
} from "@/lib/agent";

import type { HeldOrder } from "@/lib/holds";

import {
  clock,
  fill,
  money,
} from "@/lib/format";

// ==========================================
// TODAVÍA HAY
// AGENT CHAT
// ==========================================
//
// - Chat con Gemini
// - Apartados
// - Pago contra entrega
// - NIP de recogida
// - Horarios disponibles
// - Historial del chat
// - Actualización de pedidos
// - Inicio de sesión opcional
// - Compatible con recompensas
//
// ==========================================

// ==========================================
// TIPOS
// ==========================================

type Turn = ChatMessage & {
  reservation?: AgentReservation;
  pickupChoices?: PickupChoices;
  needsLogin?: boolean;
  error?: boolean;
  local?: boolean;
};

type OrderStatus = HeldOrder["status"];

/** ¿El asistente preguntó si es para llevar o para comer aquí? */
function asksOrderType(text: string) {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    (/para llevar/.test(t) && /comer (aqui|en el)/.test(t)) ||
    (/to go/.test(t) && /(eat here|dine in)/.test(t))
  );
}

/** ¿El asistente preguntó si los platillos van con todo? */
function asksWithEverything(text: string) {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /con todo/.test(t) || /with everything/.test(t);
}

type ChatResponse = {
  reply?: string;
  reservation?: AgentReservation;
  pickupChoices?: PickupChoices;
  needsLogin?: boolean;
  error?: string;
};

type HoldsResponse = {
  holds?: HeldOrder[];
};

// ==========================================
// CONFIGURACIÓN
// ==========================================

const POLL_MS = 15_000;
const FIRST_TIMES = 8;

function saved(slug: string): string {
  return `th_chat:${slug}`;
}

// ==========================================
// FORMATO DE HORARIOS
// ==========================================

function label(
  hhmm: string,
  lang: "es" | "en",
): string {
  const [hour, minute] = hhmm
    .split(":")
    .map(Number);

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return hhmm;
  }

  return new Intl.DateTimeFormat(
    lang === "es" ? "es-MX" : "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    },
  ).format(
    new Date(
      Date.UTC(
        2000,
        0,
        1,
        hour,
        minute,
      ),
    ),
  );
}

// ==========================================
// ESTADOS DE PEDIDO
// ==========================================

function statusText(
  status: OrderStatus,
  lang: "es" | "en",
): string {
  const es = lang === "es";

  switch (status) {
    case "seated":
      return es
        ? "¡Bienvenido!"
        : "Welcome!";

    case "captured":
      return es
        ? "Entregado y pagado"
        : "Delivered and paid";

    case "expired":
      return es
        ? "Pedido vencido"
        : "Expired order";

    case "voided":
      return es
        ? "Pedido cancelado"
        : "Cancelled order";

    case "authorized":
      return es
        ? "Pendiente de pago"
        : "Payment pending";

    case "held":
      return es
        ? "Procesando pedido"
        : "Processing order";

    default:
      return es
        ? "Estado no disponible"
        : "Status unavailable";
  }
}

// ==========================================
// VALIDAR MENSAJES
// ==========================================

function validTurn(
  value: unknown,
): value is Turn {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const turn = value as Partial<Turn>;

  return (
    (
      turn.role === "user" ||
      turn.role === "assistant"
    ) &&
    typeof turn.content === "string"
  );
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export function AgentChat({
  slug,
  lang,
  currency,
  timezone,
  isOpen,
  signedIn = false,
  t,
}: {
  slug: string;
  lang: "es" | "en";
  currency: string;
  timezone: string;
  isOpen: boolean;
  signedIn?: boolean;
  t: Dictionary;
}) {
  const p = t.public;
  const es = lang === "es";

  const router = useRouter();

  // ========================================
  // ESTADOS
  // ==========================================

  const [turns, setTurns] =
    useState<Turn[]>([]);

  const [text, setText] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [allTimes, setAllTimes] =
    useState(false);

  const [
    orderStatuses,
    setOrderStatuses,
  ] = useState<
    Record<string, OrderStatus>
  >({});

  // Pedidos que el cliente todavía puede cancelar él mismo.
  const [cancellable, setCancellable] =
    useState<Record<string, boolean>>({});

  const [cancelling, setCancelling] =
    useState<string | null>(null);

  async function cancelOrder(id: string) {
    if (cancelling) return;
    if (
      !window.confirm(
        lang === "es"
          ? "¿Cancelar tu pedido? La comida se libera para otros clientes."
          : "Cancel your order? The food is released for other customers.",
      )
    ) {
      return;
    }

    setCancelling(id);
    try {
      const response = await fetch(
        `/api/stalls/${encodeURIComponent(slug)}/holds`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel", id }),
        },
      );
      if (!response.ok) throw new Error(String(response.status));
      setOrderStatuses((previous) => ({ ...previous, [id]: "voided" }));
      setCancellable((previous) => ({ ...previous, [id]: false }));
    } catch {
      setCancellable((previous) => ({ ...previous, [id]: false }));
      window.alert(
        lang === "es"
          ? "Ya no se puede cancelar desde aquí: tu pedido ya se está preparando. Llama al negocio."
          : "It can't be cancelled here anymore: your order is being prepared. Call the business.",
      );
    } finally {
      setCancelling(null);
    }
  }

  // ========================================
  // REFERENCIAS
  // ==========================================

  const end = useRef<HTMLDivElement>(null);

  const sending = useRef(false);

  const turnsRef = useRef<Turn[]>([]);

  // IMPORTANTE:
  //
  // No escribimos:
  //
  // turnsRef.current = turns;
  //
  // durante el render.
  //
  // Solo actualizamos esta referencia
  // en callbacks y efectos programados.

  // ========================================
  // RECUPERAR CONVERSACIÓN
  // ==========================================

  useEffect(() => {
    let restored: Turn[] = [];

    try {
      const raw = sessionStorage.getItem(
        saved(slug),
      );

      if (raw) {
        const parsed: unknown =
          JSON.parse(raw);

        if (Array.isArray(parsed)) {
          restored = parsed.filter(
            validTurn,
          );
        }

        sessionStorage.removeItem(
          saved(slug),
        );
      }
    } catch (error) {
      console.error(
        "Error al recuperar conversación:",
        error,
      );
    }

    if (!restored.length) {
      return;
    }

    const cleaned: Turn[] = restored.map(
      (message): Turn => ({
        ...message,
        needsLogin: false,
      }),
    );

    if (signedIn) {
      cleaned.push({
        role: "assistant",
        content: p.chatSignedIn,
        local: true,
      });
    }

    // Programar restauración fuera
    // de la ejecución inmediata
    // del efecto.
    const frame = window.requestAnimationFrame(
      () => {
        turnsRef.current = cleaned;
        setTurns(cleaned);
      },
    );

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    slug,
    signedIn,
    p.chatSignedIn,
  ]);

  // ========================================
  // SCROLL AUTOMÁTICO
  // ==========================================

  useEffect(() => {
    if (!turns.length) {
      return;
    }

    end.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [
    turns,
    busy,
  ]);

  // ========================================
  // CONSULTAR ESTADOS DE LOS PEDIDOS
  // ==========================================

  const refreshOrders = useCallback(
    async (
      signal?: AbortSignal,
    ): Promise<void> => {
      try {
        const response = await fetch(
          `/api/stalls/${encodeURIComponent(
            slug,
          )}/holds?lang=${lang}`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            signal,
          },
        );

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as HoldsResponse;

        if (
          signal?.aborted ||
          !Array.isArray(data.holds)
        ) {
          return;
        }

        const statuses: Record<
          string,
          OrderStatus
        > = {};

        const canCancel: Record<string, boolean> = {};

        for (const order of data.holds) {
          statuses[order.id] =
            order.status;
          canCancel[order.id] = order.canCancel;
        }

        setCancellable((previous) => ({
          ...previous,
          ...canCancel,
        }));

        setOrderStatuses(
          (previous) => ({
            ...previous,
            ...statuses,
          }),
        );
      } catch (error) {
        // Una consulta cancelada no
        // debe mostrarse como error.
        if (signal?.aborted) {
          return;
        }

        console.error(
          "Error al consultar pedidos:",
          error,
        );
      }
    },
    [
      slug,
      lang,
    ],
  );

  // ========================================
  // ACTUALIZACIÓN AUTOMÁTICA
  // ==========================================

  useEffect(() => {
    const controller =
      new AbortController();

    // Evitar invocar directamente
    // una actualización de estado
    // desde el cuerpo del efecto.
    //
    // La consulta se inicia mediante
    // un callback programado.

    const initialTimer = window.setTimeout(
      () => {
        void refreshOrders(
          controller.signal,
        );
      },
      0,
    );

    // Consultar cada 15 segundos.
    const interval = window.setInterval(
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void refreshOrders(
            controller.signal,
          );
        }
      },
      POLL_MS,
    );

    // Consultar cuando regrese
    // a la pestaña.
    const handleFocus = () => {
      void refreshOrders(
        controller.signal,
      );
    };

    const handleVisibility = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void refreshOrders(
          controller.signal,
        );
      }
    };

    // Actualización después de
    // registrar un nuevo pedido.
    const handleOrderChanged = () => {
      void refreshOrders(
        controller.signal,
      );
    };

    window.addEventListener(
      "focus",
      handleFocus,
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );

    window.addEventListener(
      "todavia-hay:orders-changed",
      handleOrderChanged,
    );

    // ======================================
    // LIMPIEZA
    // ======================================

    return () => {
      controller.abort();

      window.clearTimeout(
        initialTimer,
      );

      window.clearInterval(
        interval,
      );

      window.removeEventListener(
        "focus",
        handleFocus,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );

      window.removeEventListener(
        "todavia-hay:orders-changed",
        handleOrderChanged,
      );
    };
  }, [
    refreshOrders,
  ]);

  // ========================================
  // INICIO DE SESIÓN OPCIONAL
  // ==========================================

  function goSignIn() {
    try {
      sessionStorage.setItem(
        saved(slug),
        JSON.stringify(
          turnsRef.current.filter(
            (message) => !message.error,
          ),
        ),
      );
    } catch (error) {
      console.error(
        "Error al guardar conversación:",
        error,
      );
    }

    const here =
      `${window.location.pathname}#chat`;

    // Navegación con Next.js.
    router.push(
      `/${lang}/login?next=${encodeURIComponent(
        here,
      )}`,
    );
  }

  // ========================================
  // ENVIAR MENSAJE
  // ==========================================

  async function send(
    content: string,
  ): Promise<void> {
    const messageText =
      content.trim();

    if (
      !messageText ||
      sending.current
    ) {
      return;
    }

    // Evitar dos envíos simultáneos.
    sending.current = true;

    const next: Turn[] = [
      ...turnsRef.current,
      {
        role: "user",
        content: messageText,
      },
    ];

    turnsRef.current = next;

    setTurns(next);
    setText("");
    setBusy(true);
    setAllTimes(false);

    try {
      // ====================================
      // ENVIAR A GEMINI
      // ====================================

      const response = await fetch(
        `/api/stalls/${encodeURIComponent(
          slug,
        )}/chat`,
        {
          method: "POST",

          credentials: "same-origin",

          headers: {
            "Content-Type":
              "application/json",
          },

          signal:
            AbortSignal.timeout(
              60_000,
            ),

          body: JSON.stringify({
            lang,

            messages: next
              .filter(
                (message) =>
                  !message.error &&
                  !message.local,
              )
              .map(
                ({
                  role,
                  content,
                }) => ({
                  role,
                  content,
                }),
              ),
          }),
        },
      );

      const json =
        (await response
          .json()
          .catch(() => ({}))) as ChatResponse;

      // ====================================
      // ERROR DEL SERVIDOR
      // ====================================

      if (
        !response.ok ||
        !json.reply
      ) {
        const errorTurn: Turn = {
          role: "assistant",

          content:
            json.error ===
            "agent_unavailable"
              ? p.agentOff
              : p.agentError,

          error: true,
        };

        const failed: Turn[] = [
          ...next,
          errorTurn,
        ];

        turnsRef.current = failed;
        setTurns(failed);

        return;
      }

      // ====================================
      // RESPUESTA DEL ASISTENTE
      // ====================================

      const assistantTurn: Turn = {
        role: "assistant",

        content: json.reply,

        reservation:
          json.reservation,

        pickupChoices:
          json.pickupChoices,

        needsLogin:
          json.needsLogin,
      };

      const updated: Turn[] = [
        ...next,
        assistantTurn,
      ];

      turnsRef.current = updated;
      setTurns(updated);

      // ====================================
      // RESERVACIÓN NUEVA
      // ====================================

      if (json.reservation?.id) {
        const id = json.reservation.id;

        setOrderStatuses(
          (previous) => ({
            ...previous,
            [id]: "authorized",
          }),
        );

        setCancellable((previous) => ({
          ...previous,
          [id]: true,
        }));

        // Avisar a otros componentes.
        window.dispatchEvent(
          new Event(
            "todavia-hay:orders-changed",
          ),
        );

        // Consultar estado del servidor.
        void refreshOrders();
      }
    } catch (error) {
      console.error(
        "Error al enviar mensaje:",
        error,
      );

      const errorTurn: Turn = {
        role: "assistant",
        content: p.agentError,
        error: true,
      };

      const failed: Turn[] = [
        ...next,
        errorTurn,
      ];

      turnsRef.current = failed;
      setTurns(failed);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  // ========================================
  // INTERFAZ PRINCIPAL
  // ==========================================

  return (
    <section
      id="chat"
      className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm"
    >
      <RewardsChatInvite
        slug={slug}
        lang={lang}
        signedIn={signedIn}
      />
      {/* ====================================
          ENCABEZADO
      ==================================== */}

      <div>
        <h2 className="text-lg font-bold">
          {p.askTitle}
        </h2>

        <p className="text-sm text-muted">
          {es
            ? "Aparta tus platillos y paga directamente al negocio cuando los recojas."
            : "Reserve your food and pay directly at the business when you pick it up."}
        </p>
      </div>

      {/* ====================================
          CONVERSACIÓN
      ==================================== */}

      {turns.length > 0 && (
        <ol
          className="flex max-h-96 flex-col gap-2 overflow-y-auto"
          aria-live="polite"
        >
          {turns.map(
            (message, index) => {
              const reservation =
                message.reservation;

              const status =
                reservation
                  ? orderStatuses[
                      reservation.id
                    ] ?? "authorized"
                  : null;

              const delivered =
                status === "captured";

              // Comer aquí: el mesero ya lo sentó en su mesa.
              const seated =
                status === "seated";

              const active =
                status === "authorized";

              const expired =
                status === "expired";

              const cancelled =
                status === "voided";

              return (
                <li
                  key={index}
                  className={`flex flex-col gap-2 ${
                    message.role === "user"
                      ? "items-end"
                      : "items-start"
                  }`}
                >
                  {/* ======================
                      MENSAJE
                  ====================== */}

                  <p
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
                      message.role === "user"
                        ? "rounded-br-sm bg-brand text-white"
                        : message.error
                          ? "rounded-bl-sm bg-bad-soft text-bad"
                          : "rounded-bl-sm bg-background"
                    }`}
                  >
                    {message.content}
                  </p>

                  {/* ======================
                      TARJETA DEL PEDIDO
                  ====================== */}

                  {reservation && (
                    <div className="w-full max-w-[95%] space-y-3 rounded-2xl border border-line bg-surface p-4">
                      {/* ENCABEZADO */}

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-extrabold text-brand">
                          {es
                            ? "¡Pedido confirmado!"
                            : "Order confirmed!"}
                        </h3>

                        {/* ESTADO */}

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            delivered || seated
                              ? "bg-green-100 text-green-800"
                              : expired || cancelled
                                ? "bg-red-100 text-red-800"
                                : "bg-background text-muted"
                          }`}
                        >
                          {statusText(
                            status ?? "authorized",
                            lang,
                          )}
                        </span>
                      </div>

                      {/* ====================
                          NÚMERO DE PEDIDO
                      ==================== */}

                      <p className="text-sm font-bold">
                        {es
                          ? "Pedido"
                          : "Order"}{" "}
                        #
                        {reservation.orderNumber ??
                          "—"}
                      </p>

                      {reservation.dineInPartySize ? (
                        <p className="text-sm font-bold text-brand">
                          {es
                            ? `🍽️ Comer aquí · ${reservation.dineInPartySize} ${reservation.dineInPartySize === 1 ? "persona" : "personas"}`
                            : `🍽️ Dine in · ${reservation.dineInPartySize} ${reservation.dineInPartySize === 1 ? "person" : "people"}`}
                        </p>
                      ) : null}

                      {/* ====================
                          PRODUCTOS
                      ==================== */}

                      <p className="text-sm leading-relaxed">
                        {fill(
                          p.reservedSummaryAt,
                          {
                            items:
                              reservation.lines
                                .map(
                                  (line) =>
                                    `${line.qty} × ${line.name}${line.note ? ` (${line.note})` : ""}`,
                                )
                                .join(", "),

                            total: money(
                              reservation.totalCents,
                              currency,
                              lang,
                            ),

                            when: fill(
                              reservation.pickupMode ===
                                "asap"
                                ? p.whenAsap
                                : p.whenAt,
                              {
                                time:
                                  reservation.pickupAt
                                    ? clock(
                                        reservation.pickupAt,
                                        timezone,
                                        lang,
                                      )
                                    : "",
                              },
                            ),
                          },
                        )}
                      </p>

                      {/* ====================
                          NIP DE RECOGIDA
                      ==================== */}

                      {active &&
                        reservation.pickupCode && (
                          <div className="rounded-2xl bg-background p-4 text-center">
                            <p className="text-xs font-semibold text-muted">
                              {es
                                ? "Tu NIP de recogida"
                                : "Your pickup PIN"}
                            </p>

                            <p className="mt-2 font-mono text-3xl font-black tracking-[0.25em] text-brand">
                              {reservation.pickupCode}
                            </p>

                            <p className="mt-2 text-xs text-muted">
                              {es
                                ? "Muestra este NIP al negocio cuando recojas tu pedido."
                                : "Show this PIN when collecting your order."}
                            </p>
                          </div>
                        )}

                      {/* ====================
                          INFORMACIÓN DE PAGO
                      ==================== */}

                      <div className="rounded-xl border border-line p-3">
                        <p className="text-sm font-bold">
                          {seated
                            ? es
                              ? "✓ Ya estás en tu mesa. Pagas al final con tu mesero."
                              : "✓ You're at your table. Pay your waiter at the end."
                            : delivered
                            ? es
                              ? "✓ Pedido entregado y pagado"
                              : "✓ Order delivered and paid"
                            : active
                              ? es
                                ? "Pagarás al recoger tu pedido."
                                : "Pay when collecting your order."
                              : expired
                                ? es
                                  ? "Este pedido venció."
                                  : "This order expired."
                                : cancelled
                                  ? es
                                    ? "Este pedido fue cancelado."
                                    : "This order was cancelled."
                                  : es
                                    ? "Estamos procesando tu pedido."
                                    : "Your order is being processed."}
                        </p>

                        {active && (
                          <p className="mt-1 text-xs text-muted">
                            {es
                              ? "Puedes pagar en efectivo, con terminal o por transferencia."
                              : "You can pay with cash, card terminal or bank transfer."}
                          </p>
                        )}
                      </div>

                      {active && cancellable[reservation.id] && (
                        <button
                          type="button"
                          onClick={() => void cancelOrder(reservation.id)}
                          disabled={cancelling !== null}
                          className="text-sm font-bold text-bad underline disabled:opacity-50"
                        >
                          {cancelling === reservation.id
                            ? "…"
                            : es
                              ? "Cancelar pedido"
                              : "Cancel order"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* ======================
                      INICIO DE SESIÓN
                  ====================== */}

                  {message.needsLogin &&
                    !signedIn && (
                      <div className="w-full max-w-[85%] rounded-2xl border border-line p-3">
                        <p className="text-sm">
                          {p.chatLoginWhy}
                        </p>

                        <button
                          type="button"
                          onClick={goSignIn}
                          className="mt-2 block w-full rounded-full bg-brand py-3 text-center font-bold text-white"
                        >
                          {p.chatLogin}
                        </button>
                      </div>
                    )}

                  {/* ======================
                      PARA LLEVAR O COMER AQUÍ
                  ====================== */}

                  {message.role === "assistant" &&
                    index === turns.length - 1 &&
                    !busy &&
                    asksOrderType(message.content) && (
                      <div className="flex w-full max-w-[85%] flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void send(es ? "Para llevar" : "To go")
                          }
                          className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white"
                        >
                          🛍️ {es ? "Para llevar" : "To go"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void send(es ? "Para comer aquí" : "To eat here")
                          }
                          className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white"
                        >
                          🍽️ {es ? "Comer aquí" : "Eat here"}
                        </button>
                      </div>
                    )}

                  {/* ======================
                      ¿CON TODO?
                  ====================== */}

                  {message.role === "assistant" &&
                    index === turns.length - 1 &&
                    !busy &&
                    !asksOrderType(message.content) &&
                    asksWithEverything(message.content) && (
                      <div className="flex w-full max-w-[85%] flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void send(es ? "Con todo" : "With everything")
                          }
                          className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white"
                        >
                          ✅ {es ? "Con todo" : "With everything"}
                        </button>
                      </div>
                    )}

                  {/* ======================
                      HORARIOS DISPONIBLES
                  ====================== */}

                  {message.pickupChoices &&
                    index ===
                      turns.length - 1 &&
                    !busy && (
                      <div className="flex w-full max-w-[85%] flex-wrap gap-2">
                        {/* PARA AHORITA */}

                        {message.pickupChoices
                          .asap.available && (
                          <button
                            type="button"
                            onClick={() =>
                              void send(
                                p.pickupAsapMsg,
                              )
                            }
                            className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white"
                          >
                            {fill(
                              p.pickupAsapButton,
                              {
                                n:
                                  message.pickupChoices!
                                    .asap.minutes,
                              },
                            )}
                          </button>
                        )}

                        {/* HORARIOS */}

                        {(allTimes
                          ? message.pickupChoices.times
                          : message.pickupChoices.times.slice(
                              0,
                              FIRST_TIMES,
                            )
                        ).map((time) => (
                          <button
                            type="button"
                            key={time}
                            onClick={() =>
                              void send(
                                fill(
                                  p.pickupTimeMsg,
                                  {
                                    time: label(
                                      time,
                                      lang,
                                    ),
                                  },
                                ) +
                                  ` (${time})`,
                              )
                            }
                            className="rounded-full border border-line px-3 py-1.5 text-sm"
                          >
                            {label(time, lang)}
                          </button>
                        ))}

                        {/* VER MÁS HORARIOS */}

                        {!allTimes &&
                          message.pickupChoices
                            .times.length >
                            FIRST_TIMES && (
                            <button
                              type="button"
                              onClick={() =>
                                setAllTimes(true)
                              }
                              className="px-2 py-1.5 text-sm text-muted underline"
                            >
                              {p.pickupMore}
                            </button>
                          )}

                        {/* SIN HORARIOS */}

                        {!message.pickupChoices
                          .asap.available &&
                          !message.pickupChoices
                            .times.length && (
                            <p className="text-sm text-muted">
                              {p.pickupNone}
                            </p>
                          )}
                      </div>
                    )}
                </li>
              );
            },
          )}

          {/* ============================
              CARGANDO RESPUESTA
          ============================ */}

          {busy && (
            <li className="text-sm text-muted">
              {p.thinking}
            </li>
          )}

          <div ref={end} />
        </ol>
      )}

      {/* ====================================
          SUGERENCIAS INICIALES
      ==================================== */}

      {turns.length === 0 &&
        isOpen && (
          <div className="flex flex-wrap gap-2">
            {p.suggestions.map(
              (suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() =>
                    void send(suggestion)
                  }
                  className="rounded-full border border-line px-3 py-1.5 text-sm"
                >
                  {suggestion}
                </button>
              ),
            )}
          </div>
        )}

      {/* ====================================
          ENVIAR MENSAJE
      ==================================== */}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(text);
        }}
      >
        <input
          value={text}
          onChange={(event) =>
            setText(event.target.value)
          }
          placeholder={p.askPlaceholder}
          maxLength={500}
          className="min-w-0 flex-1 rounded-full border border-line bg-background px-4 py-3"
          aria-label={p.askTitle}
        />

        <button
          type="submit"
          disabled={
            busy ||
            !text.trim()
          }
          className="rounded-full bg-brand px-5 font-semibold text-white disabled:opacity-50"
        >
          {p.send}
        </button>
      </form>
    </section>
  );
}
