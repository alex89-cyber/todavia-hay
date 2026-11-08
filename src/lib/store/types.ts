
import type { OrderLine } from "../inventory";

import type {
  CashUp,
  PaymentMethod,
  Reservation,
  StallSettings,
  StallState,
} from "../stall";

import type {
  LoyaltyExpiryAction,
  LoyaltyPeriodKind,
} from "../loyalty-period";

// ==========================================
// SALES
// ==========================================

export type SaleResult =
  | {
      ok: true;
      state: StallState;
    }
  | {
      ok: false;
      reason: "closed" | "short";
      short?: string[];
    };

// ==========================================
// REWARD REDEMPTION
// ==========================================

export type RedeemResult =
  | {
      ok: true;
      stampsLeft: number;
    }
  | {
      ok: false;
      reason:
        | "closed"
        | "short"
        | "not_enough"
        | "no_reward";
    };

// ==========================================
// PUSH NOTIFICATIONS
// ==========================================

/**
 * Pickup times and kitchen progress
 * updated after reserving.
 */
export type PickupPatch = Partial<
  Pick<
    Reservation,
    | "pickupMode"
    | "pickupAt"
    | "confirmedAt"
    | "readyAt"
    | "noShow"
    | "confirmAskedAt"
    | "prepAlertedAt"
    | "customerId"
  >
>;

export type PushTarget = {
  reservationId: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  lang: "es" | "en";
};

export type Watch = {
  dishId: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  lang: "es" | "en";
};

// ==========================================
// RESERVATIONS
// ==========================================

export type ReserveResult =
  | {
      ok: true;
      reservation: Reservation;
    }
  | {
      ok: false;
      reason: "closed" | "short";
      short?: string[];
    };

// ==========================================
// MENU EDITOR
// ==========================================

export type MenuInput = {
  ingredients: {
    key: string;
    name: string;
    unit: string;
  }[];

  dishes: {
    id: string | null;
    nameEs: string;
    nameEn: string;
    imageUrl: string | null;
    priceCents: number;

    recipe: {
      ingredient: string;
      qty: number;
    }[];
  }[];
};

// ==========================================
// BUSINESS SETTINGS
// ==========================================

export type SettingsInput = {
  name: string;
  settings: StallSettings;
};

// ==========================================
// LOYALTY CONFIGURATION
// ==========================================

export type LoyaltyConfigInput = {
  enabled: boolean;
  stampsPerReward: number;
  rewardDishId: string | null;

  periodKind: LoyaltyPeriodKind;
  periodDays: number;

  expiryAction: LoyaltyExpiryAction;
  rewardValidDays: number | null;
};

// ==========================================
// LOYALTY CARD INFORMATION
// ==========================================

export type LoyaltyCardStatus = {
  cardId: string;

  enabled: boolean;

  stamps: number;
  stampsRequired: number;
  stampsRemaining: number;

  periodStartedAt: string | null;
  periodEndsAt: string | null;

  availableRewards: number;

  nextRewardExpiresAt: string | null;

  expired: boolean;
};

// ==========================================
// LOYALTY CONFIGURATION RESULT
// ==========================================

export type LoyaltyConfigResult =
  | {
      ok: true;
      state: StallState;
    }
  | {
      ok: false;
      reason:
        | "invalid_config"
        | "reward_not_found";
    };

// ==========================================
// STALL STORE
// ==========================================

export interface StallStore {

  // ========================================
  // BUSINESS
  // ========================================

  get(
    slug: string,
  ): Promise<StallState | null>;

  open(
    slug: string,
    counts: Record<string, number>,
  ): Promise<StallState>;

  close(
    slug: string,
  ): Promise<{
    state: StallState;
    cashUp: CashUp;
  }>;

  // ========================================
  // SALES
  // ========================================

  recordSale(
    slug: string,
    lines: OrderLine[],
    method: PaymentMethod,
  ): Promise<SaleResult>;

  // ========================================
  // INVENTORY
  // ========================================

  setSoldOut(
    slug: string,
    dishId: string,
    soldOut: boolean,
  ): Promise<StallState>;

  restock(
    slug: string,
    adds: Record<string, number>,
  ): Promise<
    | {
        ok: true;
        state: StallState;
      }
    | {
        ok: false;
        reason: "closed";
      }
  >;

  // ========================================
  // MENU
  // ========================================

  saveMenu(
    slug: string,
    menu: MenuInput,
  ): Promise<StallState>;

  // ========================================
  // BUSINESS CUSTOMIZATION
  // ========================================

  saveSettings?(
    slug: string,
    input: SettingsInput,
  ): Promise<StallState>;

  // ========================================
  // LOYALTY CUSTOMIZATION
  // ========================================

  saveLoyaltyConfig?(
    slug: string,
    config: LoyaltyConfigInput,
  ): Promise<LoyaltyConfigResult>;

  getLoyaltyCard?(
    slug: string,
    cardId: string,
  ): Promise<LoyaltyCardStatus>;

  // ========================================
  // RESERVATIONS
  // ========================================

  reserve(
    slug: string,
    customerName: string,
    lines: OrderLine[],
    pickupBy: Date,
  ): Promise<ReserveResult>;

  getReservation(
    slug: string,
    id: string,
  ): Promise<Reservation | null>;

  /**
   * Confirma la reservación.
   *
   * En el flujo nuevo, authorized significa
   * pedido confirmado, no pedido pagado.
   */
  markAuthorized(
    slug: string,
    id: string,
    payerId: string | null,
  ): Promise<void>;

  /**
   * Registra la entrega del pedido
   * y el método de pago seleccionado.
   *
   * cash = efectivo
   * card = terminal bancaria
   * transfer = transferencia
   *
   * No se permite entregar pedidos nuevos
   * sin registrar un método de pago.
   */
  markDelivered(
    slug: string,
    id: string,
    method: "cash" | "card" | "transfer",
  ): Promise<boolean>;

  /**
   * Cancela un pedido y devuelve inventario.
   */
  release(
    slug: string,
    id: string,
    status: "voided" | "expired",
  ): Promise<boolean>;

  // ========================================
  // STAMP CARDS
  // ========================================

  /**
   * Devuelve los sellos actuales.
   */
  stamps(
    slug: string,
    cardId: string,
  ): Promise<number>;

  /**
   * Agrega un sello a una tarjeta.
   */
  addStamp(
    slug: string,
    cardId: string,
    label: string | null,
  ): Promise<number>;

  /**
   * Canjea recompensas.
   */
  redeem(
    slug: string,
    cardId: string,
  ): Promise<RedeemResult>;

  // ========================================
  // PUSH NOTIFICATIONS
  // ========================================

  addWatch(
    slug: string,
    watch: Watch,
  ): Promise<void>;

  claimWatches(
    slug: string,
    open: boolean,
    dishIds: string[],
  ): Promise<Watch[]>;

  // ========================================
  // PICKUP / RECOGER
  // ========================================

  updatePickup(
    slug: string,
    id: string,
    patch: PickupPatch,
  ): Promise<void>;

  savePush(
    slug: string,
    target: PushTarget,
  ): Promise<void>;

  pushTargets(
    slug: string,
    reservationId: string | null,
  ): Promise<PushTarget[]>;

  dropPush(
    slug: string,
    endpoint: string,
  ): Promise<void>;
}
