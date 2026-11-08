
import "server-only";

import {
  createGoogleGenerativeAI,
} from "@ai-sdk/google";

import {
  generateText,
  isStepCount,
  tool,
} from "ai";

import { z } from "zod";

import {
  menuAvailability,
} from "./inventory";

import {
  startReservation,
} from "./reservations";

import {
  replyLanguage,
} from "./language";

import {
  offlineReply,
} from "./offline-reply";

import {
  phoneCardId,
  type StallState,
} from "./stall";

import {
  hhmm,
  pickupOptions,
  pickupSettings,
  resolvePickup,
  type PickupOptions,
} from "./pickup";

// ==========================================
// TODAVÍA HAY
// ASISTENTE DE PEDIDOS SIN PAYPAL
// ==========================================
//
// - Pedidos mediante Gemini
// - Nombre y apellido obligatorios
// - Teléfono opcional para recompensas
// - Preguntas separadas
// - Recogida inmediata o programada
// - Horarios limitados antes del cierre
// - Confirmaciones naturales: sí, sip, sii
// - Confirmación real en Supabase
// - NIP de recogida
// - Pago al recoger
//
// ==========================================

// ==========================================
// TIPOS
// ==========================================

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentReservation = {
  id: string;
  pickupCode: string | null;
  orderNumber: number | null;
  totalCents: number;
  pickupBy: string;
  pickupMode: "asap" | "scheduled";
  pickupAt: string | null;
  lines: {
    name: string;
    qty: number;
  }[];
};

export type PickupChoices = {
  asap: {
    available: boolean;
    minutes: number;
  };
  times: string[];
  opensAt: string | null;
};

export type AgentReply = {
  reply: string;
  reservation?: AgentReservation;
  pickupChoices?: PickupChoices;
  needsLogin?: boolean;
  offline?: boolean;
};

export type ChatCustomer = {
  id: string;
  firstName: string;
  lastName: string;
};

export type ChatAccounts = {
  required: boolean;
  customer: ChatCustomer | null;
};

// ==========================================
// NORMALIZAR TEXTO
// ==========================================

function normalizeText(
  value: string,
): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

// ==========================================
// CUENTAS OPCIONALES
// ==========================================

function accountRule(
  accounts: ChatAccounts,
): string {
  const customer = accounts.customer;

  if (!customer) {
    return `
- Customers can order without an account.
- Ask for their first name and one last name.
- In Spanish say "nombre y apellido".
- Never say "nombre completo".
- Do not require email or password.
- Phone number is optional for loyalty rewards.
`;
  }

  if (customer.lastName) {
    return `
- Customer is signed in as ${customer.firstName} ${customer.lastName}.
- Use the name associated with their account.
- Do not ask for their name again.
- Phone number is optional.
- Existing accounts remain compatible with loyalty rewards.
`;
  }

  return `
- Customer is signed in as ${customer.firstName}.
- Ask for one last name if missing.
- Phone number is optional.
`;
}

// ==========================================
// NORMALIZAR TELÉFONO
// ==========================================

function normalizePhone(
  value: string,
): string | null {
  const digits = value.replace(
    /\D/g,
    "",
  );

  let local = digits;

  if (
    local.length === 12 &&
    local.startsWith("52")
  ) {
    local = local.slice(2);
  }

  if (
    !/^\d{10}$/.test(local)
  ) {
    return null;
  }

  return phoneCardId(local)
    ? local
    : null;
}

// ==========================================
// VERIFICAR TELÉFONO
// ==========================================

function phoneGiven(
  phone: string,
  messages: ChatMessage[],
): boolean {
  const target = normalizePhone(phone);

  if (!target) {
    return false;
  }

  const userText = messages
    .filter(
      (message) =>
        message.role === "user",
    )
    .map(
      (message) =>
        message.content,
    )
    .join(" ");

  const candidates =
    userText.match(
      /(?:\+?\d[\d\s().-]{8,24}\d)/g,
    ) ?? [];

  return candidates.some(
    (candidate) =>
      normalizePhone(candidate) ===
      target,
  );
}

// ==========================================
// DETECTAR RECHAZO DE TELÉFONO
// ==========================================

function declinesPhone(
  messages: ChatMessage[],
): boolean {
  const recent = messages.slice(-12);

  for (
    let i = recent.length - 1;
    i >= 0;
    i--
  ) {
    const message = recent[i];

    if (message.role !== "user") {
      continue;
    }

    const text = normalizeText(
      message.content,
    );

    // Comprobar si el cliente
    // proporcionó un teléfono después.
    const matches =
      message.content.match(
        /(?:\+?\d[\d\s().-]{8,24}\d)/g,
      ) ?? [];

    if (
      matches.some(
        (value) =>
          normalizePhone(value) !== null,
      )
    ) {
      return false;
    }

    // Rechazo explícito.
    if (
      /\b(sin telefono|no quiero dar mi telefono|no dare mi telefono|no quiero recompensas|sin recompensas|no quiero sellos|sin numero|prefiero sin telefono)\b/.test(
        text,
      )
    ) {
      return true;
    }

    // Respuesta breve de rechazo
    // a una pregunta de teléfono.
    if (
      /^(no|no gracias|prefiero que no|paso)[.!]?$/.test(
        text,
      )
    ) {
      const previous = recent
        .slice(0, i)
        .reverse()
        .find(
          (m) =>
            m.role === "assistant",
        );

      if (
        previous &&
        /\b(telefono|numero|recompensas|sellos|lealtad)\b/.test(
          normalizeText(
            previous.content,
          ),
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

// ==========================================
// VALIDAR NOMBRE Y APELLIDO
// ==========================================

function nameGiven(
  name: string,
  messages: ChatMessage[],
): boolean {
  const words = (value: string) =>
    normalizeText(value)
      .split(/[^\p{L}\p{N}]+/u)
      .filter(
        (word) =>
          word.length > 1,
      );

  const said = new Set(
    messages
      .filter(
        (message) =>
          message.role === "user",
      )
      .flatMap(
        (message) =>
          words(message.content),
      ),
  );

  const given = words(name);

  return (
    given.length >= 2 &&
    given.every(
      (word) =>
        said.has(word),
    )
  );
}

// ==========================================
// MODALIDAD DE RECOGIDA
// ==========================================

type PickupPreference =
  | "asap"
  | "scheduled"
  | null;

function asksForScheduled(
  text: string,
): boolean {
  return (
    /\bpara una hora\b/.test(text) ||
    /\bhorarios?\b/.test(text) ||
    /\bhoras disponibles\b/.test(text) ||
    /\bprogramad[oa]\b/.test(text) ||
    /\bscheduled\b/.test(text) ||
    /\bmas tarde\b/.test(text) ||
    /\b(?:a las|para las) \d{1,2}(?::\d{2})?\b/.test(
      text,
    ) ||
    /\b\d{1,2}:\d{2}\b/.test(text)
  );
}

function asksForAsap(
  text: string,
): boolean {
  return (
    /\bpara ahorita\b/.test(text) ||
    /\bahorita\b/.test(text) ||
    /\blo antes posible\b/.test(text) ||
    /\bpara ya\b/.test(text) ||
    /\basap\b/.test(text) ||
    /\bright now\b/.test(text)
  );
}

// ==========================================
// DETECTAR "NO" A RECOGER AHORA
// ==========================================

function saidNoToAsap(
  messages: ChatMessage[],
): boolean {
  const last = messages.at(-1);

  if (
    !last ||
    last.role !== "user"
  ) {
    return false;
  }

  const answer = normalizeText(
    last.content,
  );

  if (
    !/^(no|nop|no gracias|mejor no)[.!]?$/.test(
      answer,
    )
  ) {
    return false;
  }

  const previous = messages
    .slice(0, -1)
    .reverse()
    .find(
      (message) =>
        message.role === "assistant",
    );

  if (!previous) {
    return false;
  }

  const question = normalizeText(
    previous.content,
  );

  return (
    /\b(ahorita|ahora mismo|inmediatamente|right now)\b/.test(
      question,
    ) &&
    /\b(recoger|pasar|pickup|serian|para)\b/.test(
      question,
    )
  );
}

// ==========================================
// RECORDAR PREFERENCIA DE RECOGIDA
// ==========================================

function pickupPreference(
  messages: ChatMessage[],
): PickupPreference {
  if (saidNoToAsap(messages)) {
    return "scheduled";
  }

  const recent = messages
    .filter(
      (message) =>
        message.role === "user",
    )
    .slice(-12);

  for (
    let i = recent.length - 1;
    i >= 0;
    i--
  ) {
    const text = normalizeText(
      recent[i].content,
    );

    if (asksForScheduled(text)) {
      return "scheduled";
    }

    if (asksForAsap(text)) {
      return "asap";
    }
  }

  return null;
}

// ==========================================
// MOSTRAR HORARIOS PROGRAMADOS
// ==========================================

function wantsScheduledTimes(
  messages: ChatMessage[],
): boolean {
  if (saidNoToAsap(messages)) {
    return true;
  }

  const last = messages.at(-1);

  if (
    !last ||
    last.role !== "user"
  ) {
    return false;
  }

  const text = normalizeText(
    last.content,
  );

  return (
    /\bpara una hora\b/.test(text) ||
    /\bhorarios disponibles\b/.test(text) ||
    /\bque horarios\b/.test(text) ||
    /\bcuales horarios\b/.test(text) ||
    /\b(?:dame|muestra|mostrar|ver) (?:los )?horarios\b/.test(
      text,
    )
  );
}

// ==========================================
// RECONOCER CONFIRMACIONES NATURALES
// ==========================================

// CORRECCIÓN PRINCIPAL.
//
// Reconoce:
// sí, sii, siii, sip, síp, sep,
// simón, claro, va, vale,
// confirmo, correcto, ok, etc.
//
// También exige que el mensaje anterior
// del asistente haya pedido confirmar
// explícitamente el pedido.

function isOrderConfirmation(
  messages: ChatMessage[],
): boolean {
  const last = messages.at(-1);

  if (
    !last ||
    last.role !== "user"
  ) {
    return false;
  }

  const answer = normalizeText(
    last.content,
  )
    .replace(/[.!¡¿?]+$/g, "")
    .trim();

  const confirmed =
    /^(si+|sip|sipi|sep|simon|confirmo|si confirmo|confirmar|adelante|de acuerdo|correcto|esta bien|claro|claro que si|por supuesto|ok|okay|oki|va|vale|yes|yeah|yep|i confirm|confirm)$/.test(
      answer,
    );

  if (!confirmed) {
    return false;
  }

  // Buscar la última respuesta
  // que envió el asistente.
  const previous = messages
    .slice(0, -1)
    .reverse()
    .find(
      (message) =>
        message.role === "assistant",
    );

  if (!previous) {
    return false;
  }

  const question = normalizeText(
    previous.content,
  );

  // Debe mencionar un pedido.
  const mentionsOrder =
    /\b(pedido|apartado|orden|order|reservation)\b/.test(
      question,
    );

  // Debe estar solicitando confirmación.
  const asksConfirmation =
    /\b(confirmas|confirmamos|confirmar|confirm|realizamos|realizar|procedemos)\b/.test(
      question,
    );

  return (
    mentionsOrder &&
    asksConfirmation
  );
}

// ==========================================
// DETECTAR CONFIRMACIONES FALSAS
// ==========================================

function claimsOrderConfirmed(
  reply: string,
): boolean {
  const text = normalizeText(reply);

  return (
    /\b(pedido|apartado|orden|order|reservation)\b[\s\S]{0,120}\b(confirmado|confirmada|reservado|reservada|registrado|registrada|confirmed|booked)\b/.test(
      text,
    ) ||
    /\b(confirmado|confirmada|confirmed|registrado|registrada)\b[\s\S]{0,120}\b(pedido|apartado|orden|order|reservation)\b/.test(
      text,
    ) ||
    /\b(tu pedido esta listo|your order is confirmed)\b/.test(
      text,
    )
  );
}

// ==========================================
// HORARIOS DISPONIBLES
// ==========================================

function choicesFrom(
  state: StallState,
  options: PickupOptions,
): PickupChoices {
  return {
    asap: {
      available:
        options.asap.available,

      minutes:
        pickupSettings(state)
          .asapMinutes,
    },

    times:
      options.slots.map(
        (date) =>
          hhmm(
            date,
            state.timezone,
          ),
      ),

    opensAt:
      options.opensAt
        ?.toISOString() ?? null,
  };
}

// ==========================================
// FORMATO DE HORA
// ==========================================

function clock(
  iso: string | Date,
  state: StallState,
  lang: "es" | "en",
): string {
  return new Intl.DateTimeFormat(
    lang === "es"
      ? "es-MX"
      : "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
      timeZone:
        state.timezone,
    },
  ).format(
    new Date(iso),
  );
}

// ==========================================
// REGLAS DE RECOGIDA
// ==========================================

function pickupRules(
  state: StallState,
  lang: "es" | "en",
  preference: PickupPreference,
): string {
  const settings =
    pickupSettings(state);

  const options =
    pickupOptions(state);

  const asap =
    options.asap.available
      ? `available, ready in about ${settings.asapMinutes} minutes`
      : options.asap.reason === "closing"
        ? "NOT available: preparation finishes after closing"
        : "NOT available: business is closed";

  const times =
    options.slots.length
      ? options.slots
          .map(
            (date) =>
              clock(
                date,
                state,
                lang,
              ),
          )
          .join(", ")
      : "none left today";

  return `Pickup rules:

Customer preference:
${preference ?? "not selected"}

- Ask once whether pickup is ASAP or scheduled.
- "Para ahorita" means pickupMode="asap".
- Once ASAP is selected, do not ask for a time again.
- Never show scheduled time buttons after ASAP was chosen unless ASAP becomes unavailable.
- ASAP availability: ${asap}.
- If ASAP is available, continue with missing customer details.
- If the customer chooses scheduled pickup, offer available hours.
- If the customer says "no" when asked whether they want to pick up now, show scheduled hours.
- Scheduled options today: ${times}.
- Scheduled pickup is unavailable during the last 20 minutes before closing.
- Never invent available hours.
- Never accept a time outside the available options.
- If there are no available slots, explain that clearly.
- Do not repeat answered questions.
- Orders scheduled more than one hour ahead may need later confirmation.
- Customers are not automatically charged for missed pickups.
- Payment happens when collecting the order.
- Accepted methods: cash, card terminal and bank transfer.
- The business validates the NIP before delivering the order.`;
}

// ==========================================
// GOOGLE GEMINI
// ==========================================

const google =
  createGoogleGenerativeAI({
    baseURL:
      process.env
        .GOOGLE_GENERATIVE_AI_BASE_URL ||
      undefined,
  });

const MODELS = [
  process.env.GEMINI_MODEL ||
    "gemini-flash-lite-latest",

  "gemini-3.5-flash-lite",

  "gemini-flash-latest",
];

export const agentAvailable = () =>
  Boolean(
    process.env
      .GOOGLE_GENERATIVE_AI_API_KEY,
  );

// ==========================================
// REGLAS DE RECOMPENSAS
// ==========================================

function stampRule(
  state: StallState,
): string {
  const reward =
    state.dishes.find(
      (dish) =>
        dish.id ===
        state.loyalty.rewardDishId,
    );

  if (!reward) {
    return "";
  }

  return `
- Phone number is OPTIONAL.
- Never require a phone number to reserve.
- A customer can reserve without rewards.
- A valid phone can identify a loyalty card.
- Existing customer accounts can also identify loyalty cards.
- ${state.loyalty.stampsPerReward} stamps may earn a free ${reward.nameEs} / ${reward.nameEn}.
- Stamps are only awarded after successful delivery and payment.
- Cancelled and expired orders do not earn stamps.
- Never promise that a stamp has already been credited before delivery.
`;
}

// ==========================================
// INSTRUCCIONES PARA GEMINI
// ==========================================

function instructions(
  state: StallState,
  lang: "es" | "en",
  accounts: ChatAccounts,
  preference: PickupPreference,
  declinedPhone: boolean,
): string {
  const left = new Map(
    menuAvailability(
      state.dishes,
      state.ingredients,
    ).map(
      (item) => [
        item.dishId,
        item.portions,
      ],
    ),
  );

  const menu =
    state.dishes
      .map((dish) => {
        const remaining =
          state.isOpen
            ? (
                left.get(dish.id) ??
                0
              )
            : 0;

        const price = (
          dish.priceCents / 100
        ).toFixed(2);

        return `- id=${dish.id} | ${dish.nameEs} / ${dish.nameEn} | $${price} ${state.currency} | ${
          remaining > 0
            ? `about ${remaining} left`
            : "SOLD OUT"
        }`;
      })
      .join("\n");

  return `You are the order assistant of "${state.name}", a food business using Todavía Hay.

CURRENT LOCAL TIME:
${clock(new Date(), state, lang)}

BUSINESS STATUS:
${state.isOpen ? "OPEN" : "CLOSED"}

LIVE MENU:
${menu}

CUSTOMER DECLINED PHONE:
${declinedPhone ? "YES" : "NO"}

CUSTOMER INFORMATION:

- Ask for first name and one last name.
- In Spanish always say "nombre y apellido".
- Never say "nombre completo".
- Never require a second last name.
- First ask for name and last name.
- Wait for the customer's answer.
- In a separate message, offer the optional phone number for loyalty rewards.
- Explain that the phone associates the order with a loyalty card and helps accumulate stamps.
- Clearly state that providing a phone number is completely optional.
- If the customer declines, continue immediately.
- Never insist after a decline.
- If the customer already provided a valid phone, do not ask again.
- Never invent customer information.
- Never require email, password or a customer account.

ORDER RULES:

- Only use products and prices from the live menu.
- Never invent prices or availability.
- Maximum quantity is 10 per dish.
- Ask for pickup preference only once.
- If the customer selects ASAP, do not show scheduled hours.
- If the customer wants scheduled pickup, show available hours.
- No scheduled pickup during the last 20 minutes before closing.
- Ask only for missing customer information.
- Summarize products, quantities, total and pickup time before reservation.
- Ask for explicit confirmation.
- Only call reserve_order after confirmation.
- Phone is optional and cannot block a reservation.
- The customer pays when collecting the order.
- Accepted methods: cash, card terminal and bank transfer.
- Never ask for banking details or card numbers.
- Never generate online payment links.

CRITICAL CONFIRMATION RULES:

- Understand natural confirmations: "sí", "sip", "sii", "siii", "síp", "claro", "confirmo", "va", "vale", "ok", "correcto", "adelante", "simón" and similar affirmative answers.
- When the customer confirms the order, CALL reserve_order.
- Do not repeat the confirmation question after an affirmative response.
- Never pretend reserve_order was executed.
- Never tell the customer their order is confirmed unless reserve_order returns ok: true.
- Never invent an order number or pickup PIN.
- Only the server generates the real PIN.
- If reserve_order fails, explain the order was NOT confirmed.
- If information is missing, ask only for that information.
- After successful reservation, tell the customer their pickup PIN is shown in the confirmation card.
- Do not claim the customer already paid.

${pickupRules(
  state,
  lang,
  preference,
)}

Respond in ${
    lang === "es"
      ? "Mexican Spanish"
      : "English"
  }.

Be friendly and brief.
Use one to three short sentences.
No markdown.
At most one emoji.

${accountRule(accounts)}
${stampRule(state)}

If asked about unrelated topics, politely return to the menu.`;
}

// ==========================================
// CONTROL DE ERRORES GEMINI
// ==========================================

const REST_MS = 60_000;

let restUntil = 0;

// ==========================================
// CHAT PRINCIPAL
// ==========================================

export async function chat(
  state: StallState,

  messages: ChatMessage[],

  page: {
    lang: "es" | "en";
    origin: string;
  },

  accounts: ChatAccounts = {
    required: false,
    customer: null,
  },
): Promise<AgentReply> {
  const ctx = {
    ...page,

    lang: replyLanguage(
      messages,
      page.lang,
    ),
  };

  const preference =
    pickupPreference(messages);

  const declinedPhone =
    declinesPhone(messages);

  const confirmingOrder =
    isOrderConfirmation(messages);

  // ========================================
  // MOSTRAR HORARIOS PROGRAMADOS
  // ========================================

  if (
    state.isOpen &&
    !confirmingOrder &&
    wantsScheduledTimes(messages)
  ) {
    const options =
      pickupOptions(state);

    const choices =
      choicesFrom(
        state,
        options,
      );

    choices.asap.available = false;

    const hasTimes =
      choices.times.length > 0;

    return {
      reply:
        ctx.lang === "es"
          ? hasTimes
            ? "¡Claro! Estos son los horarios disponibles para recoger tu pedido. 😊"
            : "Ya no quedan horarios programados disponibles para hoy."
          : hasTimes
            ? "These are the available pickup times for today."
            : "There are no scheduled pickup times left today.",

      pickupChoices:
        hasTimes
          ? choices
          : undefined,
    };
  }

  // ========================================
  // PRODUCTOS DEL NEGOCIO
  // ========================================

  const ids =
    state.dishes.map(
      (dish) => dish.id,
    ) as [
      string,
      ...string[],
    ];

  let reservation:
    | AgentReservation
    | undefined;

  let pickupChoices:
    | PickupChoices
    | undefined;

  let needsLogin = false;

  let reservationAttempted = false;

  const signedIn =
    accounts.customer;

  // ========================================
  // INICIO DE SESIÓN OPCIONAL
  // ========================================

  const askToSignIn = tool({
    description:
      "Offers optional account sign-in.",

    inputSchema:
      z.object({}),

    execute: async () => {
      needsLogin = true;

      return {
        shown: true,
      };
    },
  });

  // ========================================
  // MOSTRAR HORARIOS
  // ========================================

  const offerPickupTimes = tool({
    description:
      "Show available pickup times. Do not use if the customer already selected ASAP and ASAP remains available.",

    inputSchema:
      z.object({}),

    execute: async () => {
      const options =
        pickupOptions(state);

      if (
        preference === "asap" &&
        options.asap.available
      ) {
        pickupChoices = undefined;

        return {
          asapSelected: true,

          readyInMinutes:
            pickupSettings(
              state,
            ).asapMinutes,

          next:
            "Continue with customer details. Do not show scheduled times.",
        };
      }

      pickupChoices =
        choicesFrom(
          state,
          options,
        );

      if (
        preference === "scheduled"
      ) {
        pickupChoices.asap.available =
          false;
      }

      return {
        asap:
          pickupChoices.asap.available
            ? `available in about ${pickupChoices.asap.minutes} minutes`
            : "not available",

        times:
          pickupChoices.times.length
            ? pickupChoices.times
            : "none left today",
      };
    },
  });

  // ========================================
  // CREAR RESERVACIÓN SIN PAYPAL
  // ========================================

  const reserveOrder = tool({
    description:
      "Create the real reservation in the database. Requires name, surname, dishes, quantities and pickup choice. Phone is optional. Call only after explicit customer confirmation.",

    inputSchema: z.object({
      customerName:
        z.string()
          .max(60)
          .optional()
          .describe(
            "Customer first name and one last name only.",
          ),

      customerPhone:
        z.string()
          .max(25)
          .optional()
          .describe(
            "OPTIONAL Mexican phone number. Omit if customer declined or did not provide it.",
          ),

      items:
        z.array(
          z.object({
            dishId:
              z.enum(ids),

            qty:
              z.number()
                .int()
                .min(1)
                .max(10),
          }),
        )
          .min(1)
          .max(8),

      pickupMode:
        z.enum([
          "asap",
          "scheduled",
        ])
          .describe(
            "ASAP for now, scheduled for an available time.",
          ),

      pickupTime:
        z.string()
          .regex(
            /^([01]?\d|2[0-3]):[0-5]\d$/,
          )
          .optional()
          .describe(
            "24-hour local time for scheduled pickup.",
          ),
    }),

    execute: async ({
      customerName,
      customerPhone,
      items,
      pickupMode,
      pickupTime,
    }) => {
      reservationAttempted = true;

      // ====================================
      // EVITAR DOBLE RESERVACIÓN
      // ====================================

      if (reservation) {
        return {
          ok: false,
          error:
            "A reservation was already created in this turn.",
        };
      }

      // ====================================
      // CONFIRMACIÓN OBLIGATORIA
      // ====================================

      if (!confirmingOrder) {
        return {
          ok: false,
          error:
            "The customer has not explicitly confirmed the order. Summarize and ask for confirmation.",
        };
      }

      // ====================================
      // MODALIDAD ELEGIDA
      // ====================================

      if (
        preference === "asap" &&
        pickupMode !== "asap"
      ) {
        return {
          ok: false,
          error:
            "Customer chose ASAP. Use pickupMode='asap'.",
        };
      }

      // ====================================
      // TELÉFONO OPCIONAL
      // ====================================

      const rawPhone =
        customerPhone?.trim() ??
        "";

      const phone = rawPhone
        ? normalizePhone(
            rawPhone,
          )
        : null;

      if (
        rawPhone &&
        (
          !phone ||
          !phoneGiven(
            rawPhone,
            messages,
          )
        )
      ) {
        return {
          ok: false,
          error:
            "The phone is optional. The supplied number is invalid or was not provided by the customer. Continue without a phone if the customer declines rewards.",
        };
      }

      // ====================================
      // VALIDAR NOMBRE Y APELLIDO
      // ====================================

      let name =
        customerName?.trim() ??
        "";

      if (
        signedIn?.lastName
      ) {
        name =
          `${signedIn.firstName} ${signedIn.lastName}`;

      } else if (
        signedIn &&
        name &&
        !name
          .toLowerCase()
          .startsWith(
            signedIn.firstName.toLowerCase(),
          )
      ) {
        name =
          `${signedIn.firstName} ${name}`;
      }

      if (
        !signedIn?.lastName &&
        !nameGiven(
          name,
          messages,
        )
      ) {
        return {
          ok: false,
          error:
            "The customer must provide a first name and one last name. In Spanish say 'nombre y apellido'.",
        };
      }

      // ====================================
      // VALIDAR HORARIO
      // ====================================

      if (
        pickupMode ===
          "scheduled" &&
        !pickupTime
      ) {
        return {
          ok: false,
          error:
            "Ask for an available scheduled pickup time.",
        };
      }

      const picked =
        resolvePickup(
          state,

          pickupMode ===
            "asap"
            ? {
                mode: "asap",
              }
            : {
                mode:
                  "scheduled",

                time:
                  pickupTime!,
              },
        );

      if (!picked.ok) {
        pickupChoices =
          choicesFrom(
            state,
            picked.options,
          );

        const why = {
          closed:
            "The business is closed.",

          closing:
            "This pickup is too close to closing time.",

          bad_time:
            "Invalid pickup time.",

          too_soon:
            "Not enough preparation time.",

          outside_hours:
            "Outside opening hours.",

          full:
            "The selected time is unavailable.",
        }[picked.reason];

        return {
          ok: false,

          error:
            `${why} Available times: ${
              pickupChoices.times.join(", ") ||
              "none today"
            }.`,
        };
      }

      pickupChoices =
        undefined;

      // ====================================
      // CREAR RESERVACIÓN REAL
      // ====================================

      const res =
        await startReservation(
          state,
          {
            customerName:
              name,

            customerPhone:
              phone,

            customerId:
              signedIn?.id ??
              null,

            lines:
              items.map(
                (item) => ({
                  dishId:
                    item.dishId,

                  qty:
                    item.qty,
                }),
              ),

            origin:
              ctx.origin,

            lang:
              ctx.lang,

            pickup:
              picked.pickup,
          },
        );

      if (!res.ok) {
        const why = {
          closed:
            "The business is closed.",

          short:
            "Not enough inventory.",

          error:
            "The reservation could not be created.",
        }[res.reason];

        return {
          ok: false,
          error: why,
        };
      }

      // ====================================
      // COMPROBAR ESTADO REAL
      // ====================================

      if (
        !res.reservation.id ||
        res.reservation.status !==
          "authorized"
      ) {
        console.error(
          "La reserva no quedó confirmada correctamente.",
        );

        return {
          ok: false,
          error:
            "The reservation has not been confirmed.",
        };
      }

      // ====================================
      // NOMBRES DE PLATILLOS
      // ====================================

      const dishName =
        new Map(
          state.dishes.map(
            (dish) => [
              dish.id,

              ctx.lang ===
                "es"
                ? dish.nameEs
                : dish.nameEn,
            ],
          ),
        );

      // ====================================
      // GUARDAR CONFIRMACIÓN CON NIP
      // ====================================

      reservation = {
        id:
          res.reservation.id,

        pickupCode:
          res.reservation
            .pickupCode,

        orderNumber:
          res.reservation
            .orderNumber,

        totalCents:
          res.reservation
            .totalCents,

        pickupBy:
          res.reservation
            .pickupBy,

        pickupMode:
          res.reservation
            .pickupMode,

        pickupAt:
          res.reservation
            .pickupAt,

        lines:
          res.reservation
            .lines.map(
              (line) => ({
                name:
                  dishName.get(
                    line.dishId,
                  ) ??
                  line.dishId,

                qty:
                  line.qty,
              }),
            ),
      };

      return {
        ok: true,

        reservationCreated:
          true,

        orderNumber:
          reservation.orderNumber,

        total:
          `$${(
            reservation.totalCents /
            100
          ).toFixed(2)} ${
            state.currency
          }`,

        pickup:
          reservation.pickupMode ===
            "asap"
            ? `right now, ready about ${clock(
                reservation.pickupAt!,
                state,
                ctx.lang,
              )}`
            : `at ${clock(
                reservation.pickupAt!,
                state,
                ctx.lang,
              )}`,

        pickupDeadline:
          clock(
            reservation.pickupBy,
            state,
            ctx.lang,
          ),

        next:
          "The real order was saved and confirmed. The pickup PIN is displayed in the confirmation card. The customer pays when collecting the order.",
      };
    },
  });

  // ========================================
  // EJECUTAR GEMINI
  // ========================================

  const started =
    Date.now();

  // Cuando el usuario confirma de forma
  // explícita, solicitar reserve_order.
  //
  // Esto incluye "sip", "sii", "claro",
  // "va", "confirmo" y otras respuestas.

  const run = (
    modelId: string,
  ) =>
    generateText({
      model:
        google(modelId),

      instructions:
        instructions(
          state,
          ctx.lang,
          accounts,
          preference,
          declinedPhone,
        ),

      messages,

      tools:
        !state.isOpen
          ? {}
          : confirmingOrder
            ? {
                reserve_order:
                  reserveOrder,
              }
            : {
                reserve_order:
                  reserveOrder,

                offer_pickup_times:
                  offerPickupTimes,

                ask_to_sign_in:
                  askToSignIn,
              },

      toolChoice:
        state.isOpen &&
        confirmingOrder
          ? {
              type: "tool",
              toolName:
                "reserve_order",
            }
          : "auto",

      stopWhen:
        isStepCount(3),

      temperature:
        0.3,

      maxOutputTokens:
        1200,

      maxRetries:
        0,

      abortSignal:
        AbortSignal.timeout(
          15_000,
        ),
    });

  let result:
    | Awaited<
        ReturnType<
          typeof run
        >
      >
    | undefined;

  let lastError:
    unknown =
    "resting after running out of quota";

  for (
    const modelId of
      Date.now() < restUntil
        ? []
        : [
            ...new Set(
              MODELS,
            ),
          ]
  ) {
    try {
      result =
        await run(modelId);

      console.log(
        `agent: ${modelId}`,
      );

      break;
    } catch (error) {
      lastError =
        error;

      console.error(
        `agent: ${modelId} failed: ${
          describe(error)
        }`,
      );
    }
  }

  // ========================================
  // RESPUESTA SI FALLA GEMINI
  // ========================================

  if (!result) {
    if (
      Date.now() >=
      restUntil
    ) {
      restUntil =
        Date.now() +
        REST_MS;
    }

    console.error(
      `agent: every model failed: ${
        describe(
          lastError,
        )
      }`,
    );

    return {
      reply:
        offlineReply(
          state,
          messages.at(-1)
            ?.content ??
            "",
          ctx.lang,
        ),

      offline: true,
    };
  }

  console.log(
    `agent: ${
      result.steps.length
    } step(s) in ${
      Date.now() -
      started
    } ms`,
  );

  // ========================================
  // VALIDAR RESPUESTA DE GEMINI
  // ========================================

  let reply =
    result.text.trim();

  // ========================================
  // PEDIDO REALMENTE CONFIRMADO
  // ========================================

  if (reservation) {
    reply =
      ctx.lang === "es"
        ? "¡Tu pedido está confirmado! Puedes consultar tu número de pedido y NIP de recogida en la tarjeta de confirmación. Pagarás directamente al negocio cuando lo recojas."
        : "Your order is confirmed! Your order number and pickup PIN are shown in the confirmation card. Payment is collected at pickup.";

    console.log(
      `Pedido confirmado correctamente: ${reservation.id}`,
    );
  }

  // ========================================
  // EVITAR CONFIRMACIONES FALSAS
  // ========================================

  if (
    !reservation &&
    (
      confirmingOrder ||
      claimsOrderConfirmed(
        reply,
      )
    )
  ) {
    console.warn(
      "Gemini intentó confirmar sin una reservación válida.",
      {
        reservationAttempted,
      },
    );

    reply =
      ctx.lang === "es"
        ? reservationAttempted
          ? "No pude confirmar tu pedido. Todavía no se ha generado un NIP. Revisemos los datos antes de intentarlo nuevamente."
          : "Tu pedido todavía no está confirmado. Necesito completar la reservación antes de darte un NIP."
        : reservationAttempted
          ? "I couldn't confirm your order. No pickup PIN has been generated."
          : "Your order is not confirmed yet. I need to complete the reservation before issuing a pickup PIN.";
  }

  // ========================================
  // RESPUESTA FINAL DEL CHAT
  // ========================================

  return {
    reply:
      reply ||
      (
        ctx.lang === "es"
          ? "¿Me lo repites, por favor?"
          : "Could you say that again?"
      ),

    reservation,

    pickupChoices:
      reservation ||
      (
        preference === "asap" &&
        pickupOptions(
          state,
        ).asap.available
      )
        ? undefined
        : pickupChoices,

    needsLogin:
      needsLogin ||
      undefined,
  };
}

// ==========================================
// DESCRIBIR ERRORES
// ==========================================

function describe(
  error: unknown,
): string {
  if (
    error &&
    typeof error ===
      "object"
  ) {
    const object =
      error as {
        statusCode?: number;
        responseBody?: string;
        message?: string;
      };

    return `${
      object.statusCode ??
      ""
    } ${
      object.message ??
      ""
    } ${
      object.responseBody?.slice(
        0,
        300,
      ) ??
      ""
    }`.trim();
  }

  return String(error);
}
