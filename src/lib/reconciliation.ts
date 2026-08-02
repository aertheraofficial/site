import { shopDayKey } from "@/lib/datetime";
import type { StoredOrder } from "@/lib/orders";
import { ONLINE_LOCATION } from "@/lib/product-stock";

/**
 * Daily cash-up: does the money the system recorded match the bank statement,
 * and does the stock the system expects match what is physically on the shelf.
 *
 * The whole thing turns on one distinction — money that settles into the bank
 * account versus money that does not. Cash in the drawer will never appear on a
 * statement, so counting it as "expected bank-in" would manufacture a shortfall
 * every single day.
 */

export type PaymentMethodKey =
  | "cash"
  | "card"
  | "duitnow-qr"
  | "toyyibpay"
  | "stripe"
  | "other";

export const PAYMENT_METHODS: Record<
  PaymentMethodKey,
  {
    label: string;
    /** null = cannot be decided automatically; surfaced for a human to classify. */
    settlesToBank: boolean | null;
  }
> = {
  cash: { label: "Cash", settlesToBank: false },
  card: { label: "Card", settlesToBank: true },
  "duitnow-qr": { label: "DuitNow QR", settlesToBank: true },
  toyyibpay: { label: "ToyyibPay (online)", settlesToBank: true },
  stripe: { label: "Stripe (online)", settlesToBank: true },
  other: { label: "Other", settlesToBank: null },
};

export function isPaymentMethodKey(value: unknown): value is PaymentMethodKey {
  return typeof value === "string" && value in PAYMENT_METHODS;
}

/**
 * Maps whatever the counter form or checkout route produced onto a canonical
 * key. Counter sales historically only recorded the label ("DuitNow QR"), and
 * old rows only have it inside internalNotes, so both shapes have to land here.
 */
export function normalizePaymentMethod(value: string | null | undefined): PaymentMethodKey | null {
  const raw = value?.trim().toLowerCase();
  if (!raw) return null;
  if (isPaymentMethodKey(raw)) return raw;

  if (raw.includes("duitnow") || raw === "qr" || raw.includes("qr")) return "duitnow-qr";
  if (raw.includes("cash") || raw.includes("tunai")) return "cash";
  if (raw.includes("card") || raw.includes("kad")) return "card";
  if (raw.includes("toyyib")) return "toyyibpay";
  if (raw.includes("stripe")) return "stripe";
  if (raw.includes("other") || raw.includes("lain")) return "other";
  return null;
}

/** Counter sales wrote the method into a fixed sentence: "…paid via DuitNow QR." */
export function paymentMethodFromNotes(notes: string | null | undefined): PaymentMethodKey | null {
  const match = notes?.match(/paid via ([^.]+)\./i);
  return match ? normalizePaymentMethod(match[1]) : null;
}

/** Best available answer for an order, preferring the structured column. */
export function resolvePaymentMethod(order: StoredOrder): PaymentMethodKey | null {
  return (
    normalizePaymentMethod(order.paymentMethod) ?? paymentMethodFromNotes(order.internalNotes)
  );
}

export function settlesToBank(method: PaymentMethodKey | null): boolean | null {
  if (!method) return null;
  return PAYMENT_METHODS[method].settlesToBank;
}

// --- Money side --------------------------------------------------------------

export type MethodBreakdown = {
  method: PaymentMethodKey | "unknown";
  label: string;
  settlesToBank: boolean | null;
  amount: number;
  orders: number;
};

export type MoneySummary = {
  breakdown: MethodBreakdown[];
  /** Sum of methods that settle to the bank — what the statement should show. */
  expectedBankAmount: number;
  /** Stays in the till. */
  cashAmount: number;
  /** Methods we could not classify. Never silently folded into either total. */
  unclassifiedAmount: number;
  totalAmount: number;
};

export function summariseMoney(orders: StoredOrder[]): MoneySummary {
  const buckets = new Map<string, MethodBreakdown>();

  for (const order of orders) {
    const method = resolvePaymentMethod(order);
    const key = method ?? "unknown";
    const entry = buckets.get(key) ?? {
      method: method ?? ("unknown" as const),
      label: method ? PAYMENT_METHODS[method].label : "Unclassified",
      settlesToBank: settlesToBank(method),
      amount: 0,
      orders: 0,
    };
    entry.amount += order.totalAmount ?? order.subtotalAmount ?? 0;
    entry.orders += 1;
    buckets.set(key, entry);
  }

  const breakdown = [...buckets.values()].sort((a, b) => b.amount - a.amount);

  return {
    breakdown,
    expectedBankAmount: breakdown
      .filter((entry) => entry.settlesToBank === true)
      .reduce((sum, entry) => sum + entry.amount, 0),
    cashAmount: breakdown
      .filter((entry) => entry.settlesToBank === false)
      .reduce((sum, entry) => sum + entry.amount, 0),
    unclassifiedAmount: breakdown
      .filter((entry) => entry.settlesToBank === null)
      .reduce((sum, entry) => sum + entry.amount, 0),
    totalAmount: breakdown.reduce((sum, entry) => sum + entry.amount, 0),
  };
}

// --- Stock side --------------------------------------------------------------

export type StockCountRow = {
  slug: string;
  name: string;
  /** Units sold on the business date, from the order lines. */
  sold: number;
  /** What `product_stock` says right now. */
  expectedOnHand: number | null;
  /** What the person counting found. Null until they enter it. */
  counted: number | null;
  /** counted - expectedOnHand. Negative means stock is short. */
  variance: number | null;
};

/**
 * Units sold per product on a business date, in shop time.
 *
 * There is no historical stock snapshot, so "expected on hand" is the *current*
 * tracked quantity rather than a reconstruction of that day's closing balance.
 * That means the count has to be done against the shelf as it is now — which is
 * how a stock take works anyway. Sold-on-the-day is shown beside it so a
 * variance can be reasoned about.
 */
export function buildStockRows(
  ordersOnDate: StoredOrder[],
  quantities: Map<string, number | null>,
  names: Map<string, string>,
): StockCountRow[] {
  const sold = new Map<string, number>();

  for (const order of ordersOnDate) {
    for (const line of order.lines) {
      if (!line.slug) continue;
      sold.set(line.slug, (sold.get(line.slug) ?? 0) + line.quantity);
    }
  }

  return [...sold.entries()]
    .map(([slug, units]) => ({
      slug,
      name: names.get(slug) ?? slug,
      sold: units,
      expectedOnHand: quantities.get(slug) ?? null,
      counted: null,
      variance: null,
    }))
    .sort((a, b) => b.sold - a.sold || a.name.localeCompare(b.name));
}

// --- Records -----------------------------------------------------------------

export type StatementLine = {
  /** "14:32" as printed on the statement, or null when unreadable. */
  time: string | null;
  /** Sen. */
  amount: number;
  reference: string | null;
  /** Order this line was matched to, if any. */
  matchedSessionId: string | null;
};

export type ReconciliationStatus = "draft" | "balanced" | "variance";

export type DailyReconciliation = {
  id: string;
  businessDate: string;
  location: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  expectedBankAmount: number | null;
  statementAmount: number | null;
  moneyVariance: number | null;
  statementImagePaths: string[];
  statementLines: StatementLine[];
  stockCounts: StockCountRow[];
  stockVarianceUnits: number | null;
  status: ReconciliationStatus;
  notes: string | null;
};

/**
 * Matches statement lines to orders by exact amount, cheapest match first.
 *
 * Deliberately conservative: an amount that appears twice on the statement and
 * twice in the orders pairs up one-to-one, but anything ambiguous is left
 * unmatched for a human rather than guessed at. Money is not the place for a
 * fuzzy match.
 */
export function matchStatementLines(
  lines: StatementLine[],
  orders: StoredOrder[],
): StatementLine[] {
  const available = new Map<number, string[]>();
  for (const order of orders) {
    const amount = order.totalAmount ?? order.subtotalAmount ?? 0;
    const list = available.get(amount) ?? [];
    list.push(order.sessionId);
    available.set(amount, list);
  }

  return lines.map((line) => {
    if (line.matchedSessionId) return line;
    const candidates = available.get(line.amount);
    if (!candidates || candidates.length === 0) return { ...line, matchedSessionId: null };
    return { ...line, matchedSessionId: candidates.shift() ?? null };
  });
}

export function orderBusinessDate(order: StoredOrder) {
  return shopDayKey(order.createdAt);
}

export function orderLocationOrOnline(order: StoredOrder) {
  return order.location ?? ONLINE_LOCATION;
}
