import { NO_DATE, shopDayKey } from "@/lib/datetime";
import type { StoredOrder } from "@/lib/orders";
import { ONLINE_LOCATION } from "@/lib/product-stock";

/**
 * Aggregations behind the Sales Dashboard. Pure functions over orders already in
 * memory — the shop has hundreds of orders, not millions, so grouping in JS beats
 * a round of SQL rollups and keeps every number traceable to one place.
 *
 * Everything is bucketed by *shop* day (Asia/Kuala_Lumpur). Grouping on the raw
 * UTC timestamp would push a 9pm sale into tomorrow's takings.
 */

export const RANGE_OPTIONS = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "12m", label: "12 months", days: 365 },
  { key: "all", label: "All time", days: null },
] as const;

export type RangeKey = (typeof RANGE_OPTIONS)[number]["key"];

export const DEFAULT_RANGE: RangeKey = "30d";

export function isRangeKey(value: unknown): value is RangeKey {
  return RANGE_OPTIONS.some((option) => option.key === value);
}

export type ResolvedRange = {
  key: RangeKey;
  label: string;
  days: number | null;
  /** Inclusive shop-day keys ("2026-08-01"). Null start means all time. */
  fromDay: string | null;
  toDay: string;
  /** The equally long window immediately before. Null when not comparable. */
  previousFromDay: string | null;
  previousToDay: string | null;
};

function shiftDays(date: Date, delta: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + delta);
  return next;
}

export function resolveRange(key: RangeKey, now: Date = new Date()): ResolvedRange {
  const option = RANGE_OPTIONS.find((entry) => entry.key === key) ?? RANGE_OPTIONS[1];
  const toDay = shopDayKey(now);

  if (option.days === null) {
    return {
      key: option.key,
      label: option.label,
      days: null,
      fromDay: null,
      toDay,
      // "All time" has nothing before it to compare against.
      previousFromDay: null,
      previousToDay: null,
    };
  }

  const fromDay = shopDayKey(shiftDays(now, -(option.days - 1)));

  return {
    key: option.key,
    label: option.label,
    days: option.days,
    fromDay,
    toDay,
    previousFromDay: shopDayKey(shiftDays(now, -(option.days * 2 - 1))),
    previousToDay: shopDayKey(shiftDays(now, -option.days)),
  };
}

/** Only a confirmed payment counts as a sale. Pending carts must never inflate revenue. */
export function isPaidOrder(order: StoredOrder) {
  return order.paymentStatus === "paid";
}

export function orderDay(order: StoredOrder) {
  return shopDayKey(order.createdAt);
}

export function isWithin(order: StoredOrder, fromDay: string | null, toDay: string) {
  const day = orderDay(order);
  if (day === NO_DATE) return false;
  if (fromDay && day < fromDay) return false;
  return day <= toDay;
}

/** Orders placed before the counter release have no location; they were all online. */
export function orderLocation(order: StoredOrder) {
  return order.location ?? ONLINE_LOCATION;
}

function orderUnits(order: StoredOrder) {
  return order.lines.reduce((sum, line) => sum + line.quantity, 0);
}

function orderRevenue(order: StoredOrder) {
  return order.totalAmount ?? order.subtotalAmount ?? 0;
}

export type SalesSummary = {
  /** Minor units (sen). */
  revenue: number;
  paidOrders: number;
  unitsSold: number;
  averageOrderValue: number;
  /** Every checkout started in the window, paid or not. */
  checkoutsStarted: number;
  /** paidOrders / checkoutsStarted, 0..1. */
  completionRate: number;
};

export function summarize(orders: StoredOrder[]): SalesSummary {
  const paid = orders.filter(isPaidOrder);
  const revenue = paid.reduce((sum, order) => sum + orderRevenue(order), 0);
  const unitsSold = paid.reduce((sum, order) => sum + orderUnits(order), 0);

  return {
    revenue,
    paidOrders: paid.length,
    unitsSold,
    averageOrderValue: paid.length ? Math.round(revenue / paid.length) : 0,
    checkoutsStarted: orders.length,
    completionRate: orders.length ? paid.length / orders.length : 0,
  };
}

/**
 * Percent change against the previous window. Null when there is no baseline —
 * rendering "+100%" against zero would read as growth where there is no signal.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export type DailyPoint = { day: string; revenue: number; orders: number };

/**
 * One point per calendar day including the empty ones — a series that skips
 * zero-sale days draws a smooth line over a dead week and overstates the trend.
 */
export function revenueByDay(
  orders: StoredOrder[],
  fromDay: string | null,
  toDay: string,
): DailyPoint[] {
  const paid = orders.filter(isPaidOrder);
  const totals = new Map<string, { revenue: number; orders: number }>();

  for (const order of paid) {
    const day = orderDay(order);
    if (day === NO_DATE) continue;
    const entry = totals.get(day) ?? { revenue: 0, orders: 0 };
    entry.revenue += orderRevenue(order);
    entry.orders += 1;
    totals.set(day, entry);
  }

  const days = [...totals.keys()].sort();
  const start = fromDay ?? days[0] ?? toDay;
  if (start > toDay) return [];

  const points: DailyPoint[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const end = new Date(`${toDay}T00:00:00Z`);

  // Guard against a pathological range producing an unbounded loop.
  for (let guard = 0; cursor <= end && guard < 800; guard++) {
    const day = cursor.toISOString().slice(0, 10);
    const entry = totals.get(day);
    points.push({ day, revenue: entry?.revenue ?? 0, orders: entry?.orders ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return points;
}

export type ProductStat = {
  slug: string;
  name: string;
  units: number;
  revenue: number;
};

export type ProductMetric = "units" | "revenue";

/**
 * Best sellers. `names` maps slug to the *current* catalog name so a renamed
 * product stays one row instead of splitting by whatever it was called at sale
 * time; the stored line description is the fallback for anything delisted.
 */
export function topProducts(
  orders: StoredOrder[],
  names: Map<string, string>,
  metric: ProductMetric,
  limit = 10,
): ProductStat[] {
  const stats = new Map<string, ProductStat>();

  for (const order of orders.filter(isPaidOrder)) {
    for (const line of order.lines) {
      const key = line.slug ?? `name:${line.description}`;
      const entry = stats.get(key) ?? {
        slug: line.slug ?? "",
        name: (line.slug && names.get(line.slug)) || line.description,
        units: 0,
        revenue: 0,
      };
      entry.units += line.quantity;
      entry.revenue += line.totalAmount ?? line.subtotalAmount ?? 0;
      stats.set(key, entry);
    }
  }

  return [...stats.values()]
    .sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export type GroupStat = { key: string; label: string; revenue: number; orders: number };

function groupBy(
  orders: StoredOrder[],
  pick: (order: StoredOrder) => { key: string; label: string } | null,
): GroupStat[] {
  const stats = new Map<string, GroupStat>();

  for (const order of orders.filter(isPaidOrder)) {
    const bucket = pick(order);
    if (!bucket) continue;
    const entry = stats.get(bucket.key) ?? {
      key: bucket.key,
      label: bucket.label,
      revenue: 0,
      orders: 0,
    };
    entry.revenue += orderRevenue(order);
    entry.orders += 1;
    stats.set(bucket.key, entry);
  }

  return [...stats.values()].sort((a, b) => b.revenue - a.revenue);
}

export function revenueByLocation(
  orders: StoredOrder[],
  locationName: (id: string) => string,
): GroupStat[] {
  return groupBy(orders, (order) => {
    const id = orderLocation(order);
    return { key: id, label: locationName(id) };
  });
}

export function revenueByFulfillment(orders: StoredOrder[]): GroupStat[] {
  const labels: Record<string, string> = {
    delivery: "Delivery",
    pickup: "Pickup",
    "in-store": "In-store",
  };
  return groupBy(orders, (order) => ({
    key: order.fulfillmentType,
    label: labels[order.fulfillmentType] ?? order.fulfillmentType,
  }));
}

/** Counter performance. Online orders have no seller and are grouped as such. */
export function revenueBySeller(orders: StoredOrder[]): GroupStat[] {
  return groupBy(orders, (order) => {
    const name = order.soldByName?.trim();
    return name
      ? { key: name, label: name }
      : { key: "__online", label: "Online (self-serve)" };
  });
}

export function revenueByCategory(
  orders: StoredOrder[],
  categories: Map<string, string>,
): GroupStat[] {
  const stats = new Map<string, GroupStat>();

  for (const order of orders.filter(isPaidOrder)) {
    for (const line of order.lines) {
      const label = (line.slug && categories.get(line.slug)) || "Uncategorised";
      const entry = stats.get(label) ?? { key: label, label, revenue: 0, orders: 0 };
      entry.revenue += line.totalAmount ?? line.subtotalAmount ?? 0;
      entry.orders += line.quantity;
      stats.set(label, entry);
    }
  }

  return [...stats.values()].sort((a, b) => b.revenue - a.revenue);
}

export type BiggestOrder = {
  sessionId: string;
  customer: string;
  day: string;
  total: number;
  items: number;
};

export function biggestOrders(orders: StoredOrder[], limit = 5): BiggestOrder[] {
  return orders
    .filter(isPaidOrder)
    .map((order) => ({
      sessionId: order.sessionId,
      customer: order.customerName?.trim() || order.customerEmail?.trim() || "Walk-in",
      day: orderDay(order),
      total: orderRevenue(order),
      items: orderUnits(order),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export type CustomerStat = {
  key: string;
  name: string;
  contact: string | null;
  spent: number;
  orders: number;
};

/**
 * Ranked by lifetime spend inside the window. Keyed on email, then phone, then
 * name — a walk-in with none of those is its own anonymous row rather than being
 * merged with every other walk-in into a fake "top customer".
 */
export function topCustomers(orders: StoredOrder[], limit = 5): CustomerStat[] {
  const stats = new Map<string, CustomerStat>();

  for (const order of orders.filter(isPaidOrder)) {
    const email = order.customerEmail?.trim().toLowerCase() || null;
    const phone = order.customerPhone?.trim() || null;
    const name = order.customerName?.trim() || null;
    const key = email ?? phone ?? (name ? `name:${name}` : `anon:${order.sessionId}`);

    const entry = stats.get(key) ?? {
      key,
      name: name || email || phone || "Walk-in",
      contact: email ?? phone,
      spent: 0,
      orders: 0,
    };
    entry.spent += orderRevenue(order);
    entry.orders += 1;
    stats.set(key, entry);
  }

  return [...stats.values()]
    .sort((a, b) => b.spent - a.spent)
    .slice(0, limit);
}
