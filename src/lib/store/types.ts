
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
 * A browser push subscription waiting for the
 * stall to open (dishId null) or a dish to
 * become available again.
 */
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

/**
 * The whole menu as the owner edits it.
 *
 * Ingredients are keyed by their id, or by
 * "new:N" when just added, and recipes
 * point at those keys.
 *
 * Anything left out is removed (archived,
 * since past sales still point at it).
 *
 * New ingredients start with no stock.
 */
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

/**
 * Business customization.
 *
 * Name is stored independently because it
 * already exists as a main StallState property.
 *
 * All other settings belong to StallSettings.
 */
export type SettingsInput = {
  name: string;
  settings: StallSettings;
};

// ==========================================
// LOYALTY CONFIGURATION
// ==========================================

/**
 * Each business can independently configure
 * how its rewards program works.
 *
 * These properties correspond to the loyalty
 * columns introduced in migration 0010.
 */
export type LoyaltyConfigInput = {
  /**
   * Whether customers can currently earn
   * new stamps.
   *
   * Disabling does not delete their history.
   */
  enabled: boolean;

  /**
   * Number of stamps needed for one reward.
   *
   * Existing stamp balances are preserved
   * when this number changes.
   */
  stampsPerReward: number;

  /**
   * The dish awarded to the customer.
   *
   * null means no reward dish selected.
   */
  rewardDishId: string | null;

  /**
   * none:
   *   Stamps do not expire.
   *
   * calendar_week:
   *   Monday through Sunday, using
   *   the business timezone.
   *
   * calendar_month:
   *   First through last day of the month.
   *
   * rolling_days:
   *   A fixed number of days starting
   *   when the first stamp is earned.
   */
  periodKind: LoyaltyPeriodKind;

  /**
   * Used only for rolling_days.
   * Supported range: 1 to 365.
   */
  periodDays: number;

  /**
   * reset:
   *   Incomplete stamps are reset when
   *   the configured period ends.
   *
   * keep:
   *   Accumulated stamps are preserved.
   */
  expiryAction: LoyaltyExpiryAction;

  /**
   * Number of days for which an earned
   * reward remains redeemable.
   *
   * null means the reward does not expire.
   */
  rewardValidDays: number | null;
};

// ==========================================
// LOYALTY CARD INFORMATION
// ==========================================

/**
 * Detailed customer-facing stamp card data.
 *
 * Timestamps use ISO 8601 UTC values.
 * The interface translates dates to the
 * business timezone for display.
 */
export type LoyaltyCardStatus = {
  cardId: string;

  enabled: boolean;

  stamps: number;

  stampsRequired: number;

  stampsRemaining: number;

  /**
   * Current earning period.
   *
   * null when there is no expiration.
   */
  periodStartedAt: string | null;

  periodEndsAt: string | null;

  /**
   * Number of rewards already earned
   * but not yet redeemed or expired.
   */
  availableRewards: number;

  /**
   * Date when the nearest available
   * reward expires, if applicable.
   */
  nextRewardExpiresAt: string | null;

  /**
   * Whether the current earning period
   * has ended before reconciliation.
   */
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

/**
 * Everything the application screens need.
 *
 * The demo uses in-memory storage.
 * Supabase implements the same interface.
 */
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

  /**
   * Adds stock mid-day.
   * { ingredientId: amount }
   *
   * Clears "sold out" on dishes
   * made from restocked ingredients.
   */
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

  /**
   * Replaces dishes, prices,
   * ingredients and recipes.
   */
  saveMenu(
    slug: string,
    menu: MenuInput,
  ): Promise<StallState>;

  // ========================================
  // BUSINESS CUSTOMIZATION
  // ========================================

  /**
   * Saves the business name, branding,
   * gallery, address, opening hours,
   * social links and page preferences.
   *
   * Optional until all stores support it.
   */
  saveSettings?(
    slug: string,
    input: SettingsInput,
  ): Promise<StallState>;

  // ========================================
  // LOYALTY CUSTOMIZATION
  // ========================================

  /**
   * Saves the rewards program rules
   * for one particular business.
   *
   * The implementation must preserve:
   * - Existing customer stamps
   * - Earned rewards
   * - Purchase history
   * - Previous redemptions
   *
   * This is optional while the memory
   * and Supabase implementations are
   * being updated.
   */
  saveLoyaltyConfig?(
    slug: string,
    config: LoyaltyConfigInput,
  ): Promise<LoyaltyConfigResult>;

  /**
   * Returns current customer progress
   * after checking applicable periods
   * and expiration rules.
   *
   * This is optional during migration
   * to the new rewards system.
   */
  getLoyaltyCard?(
    slug: string,
    cardId: string,
  ): Promise<LoyaltyCardStatus>;

  // ========================================
  // DEMO
  // ========================================

  /**
   * Demo only: restore seeded operations.
   */
  reset(
    slug: string,
  ): Promise<StallState>;

  // ========================================
  // RESERVATIONS
  // ========================================

  /**
   * Stock is taken when a reservation
   * is made and returned if it is
   * voided or expired.
   *
   * Delivering turns the reservation
   * into a PayPal sale.
   */
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

  setPayPalOrder(
    slug: string,
    id: string,
    orderId: string,
  ): Promise<void>;

  markAuthorized(
    slug: string,
    id: string,
    authorizationId: string,
    payerId: string | null,
  ): Promise<void>;

  /**
   * authorized -> captured,
   * recording the completed sale.
   *
   * False if it was not authorized.
   */
  markDelivered(
    slug: string,
    id: string,
  ): Promise<boolean>;

  /**
   * held/authorized -> voided/expired,
   * giving stock back.
   *
   * False if already finished.
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
   * Returns the customer's current
   * stamp balance.
   *
   * Kept for compatibility with
   * existing screens and PayPal flows.
   */
  stamps(
    slug: string,
    cardId: string,
  ): Promise<number>;

  /**
   * Adds one stamp to a card,
   * creating the card if needed.
   *
   * Returns the updated balance.
   */
  addStamp(
    slug: string,
    cardId: string,
    label: string | null,
  ): Promise<number>;

  /**
   * Redeems the configured reward
   * and updates the dish inventory.
   */
  redeem(
    slug: string,
    cardId: string,
  ): Promise<RedeemResult>;

  // ========================================
  // PUSH NOTIFICATIONS
  // ========================================

  /**
   * "Avísame cuando haya".
   */
  addWatch(
    slug: string,
    watch: Watch,
  ): Promise<void>;

  /**
   * Removes and returns watches
   * that should be notified.
   */
  claimWatches(
    slug: string,
    open: boolean,
    dishIds: string[],
  ): Promise<Watch[]>;
}
