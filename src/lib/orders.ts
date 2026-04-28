import { promises as fs } from "fs";
import path from "path";
import type Stripe from "stripe";
import { getOrderStoragePath } from "@/lib/store-config";
import {
  getSupabaseAdmin,
  isSupabaseOrderStoreConfigured,
} from "@/lib/supabase-admin";

export type StoredOrderLine = {
  description: string;
  quantity: number;
  currency: string;
  unitAmount: number | null;
  subtotalAmount: number | null;
  totalAmount: number | null;
};

export type FulfillmentStatus =
  | "unfulfilled"
  | "packed"
  | "fulfilled"
  | "cancelled";

export type StoredOrder = {
  id: string;
  sessionId: string;
  paymentIntentId: string | null;
  createdAt: string;
  updatedAt: string;
  recordedFrom: "webhook" | "success-page";
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  paymentStatus: string | null;
  checkoutStatus: string | null;
  currency: string;
  subtotalAmount: number | null;
  shippingAmount: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  shippingName: string | null;
  shippingAddress: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
  fulfillmentStatus: FulfillmentStatus;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  trackingUrl: string | null;
  internalNotes: string | null;
  fulfilledAt: string | null;
  packageWeightGrams: number | null;
  packageLengthCm: number | null;
  packageWidthCm: number | null;
  packageHeightCm: number | null;
  packageDescription: string | null;
  shippingBatchId: string | null;
  courierShipmentId: string | null;
  shippingLabelGeneratedAt: string | null;
  lines: StoredOrderLine[];
};

type AdminMeta = Pick<
  StoredOrder,
  | "fulfillmentStatus"
  | "trackingNumber"
  | "trackingCarrier"
  | "trackingUrl"
  | "internalNotes"
  | "fulfilledAt"
  | "packageWeightGrams"
  | "packageLengthCm"
  | "packageWidthCm"
  | "packageHeightCm"
  | "packageDescription"
  | "shippingBatchId"
  | "courierShipmentId"
  | "shippingLabelGeneratedAt"
>;

type ShippingAddressRecord = NonNullable<StoredOrder["shippingAddress"]> & {
  __adminMeta?: Partial<AdminMeta>;
};

type SupabaseOrderLineRow = {
  order_session_id: string;
  line_position: number;
  description: string;
  quantity: number;
  currency: string;
  unit_amount: number | null;
  subtotal_amount: number | null;
  total_amount: number | null;
};

type SupabaseOrderRow = {
  order_id: string;
  session_id: string;
  payment_intent_id: string | null;
  ordered_at: string;
  updated_at: string;
  recorded_from: "webhook" | "success-page";
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  payment_status: string | null;
  checkout_status: string | null;
  currency: string;
  subtotal_amount: number | null;
  shipping_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  shipping_name: string | null;
  shipping_address: Record<string, unknown> | null;
  order_lines?: SupabaseOrderLineRow[] | null;
};

const DEFAULT_FULFILLMENT_STATUS: FulfillmentStatus = "unfulfilled";

function resolveOrdersFilePath() {
  return path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    getOrderStoragePath(),
  );
}

function createDefaultAdminMeta(): AdminMeta {
  return {
    fulfillmentStatus: DEFAULT_FULFILLMENT_STATUS,
    trackingNumber: null,
    trackingCarrier: null,
    trackingUrl: null,
    internalNotes: null,
    fulfilledAt: null,
    packageWeightGrams: null,
    packageLengthCm: null,
    packageWidthCm: null,
    packageHeightCm: null,
    packageDescription: null,
    shippingBatchId: null,
    courierShipmentId: null,
    shippingLabelGeneratedAt: null,
  };
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFulfillmentStatus(value: unknown): value is FulfillmentStatus {
  return (
    value === "unfulfilled" ||
    value === "packed" ||
    value === "fulfilled" ||
    value === "cancelled"
  );
}

function parseAdminMeta(value: unknown): AdminMeta {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    fulfillmentStatus: isFulfillmentStatus(source.fulfillmentStatus)
      ? source.fulfillmentStatus
      : DEFAULT_FULFILLMENT_STATUS,
    trackingNumber:
      typeof source.trackingNumber === "string" ? normalizeText(source.trackingNumber) : null,
    trackingCarrier:
      typeof source.trackingCarrier === "string" ? normalizeText(source.trackingCarrier) : null,
    trackingUrl:
      typeof source.trackingUrl === "string" ? normalizeText(source.trackingUrl) : null,
    internalNotes:
      typeof source.internalNotes === "string" ? normalizeText(source.internalNotes) : null,
    fulfilledAt:
      typeof source.fulfilledAt === "string" ? normalizeText(source.fulfilledAt) : null,
    packageWeightGrams: normalizeNumber(source.packageWeightGrams),
    packageLengthCm: normalizeNumber(source.packageLengthCm),
    packageWidthCm: normalizeNumber(source.packageWidthCm),
    packageHeightCm: normalizeNumber(source.packageHeightCm),
    packageDescription:
      typeof source.packageDescription === "string"
        ? normalizeText(source.packageDescription)
        : null,
    shippingBatchId:
      typeof source.shippingBatchId === "string" ? normalizeText(source.shippingBatchId) : null,
    courierShipmentId:
      typeof source.courierShipmentId === "string"
        ? normalizeText(source.courierShipmentId)
        : null,
    shippingLabelGeneratedAt:
      typeof source.shippingLabelGeneratedAt === "string"
        ? normalizeText(source.shippingLabelGeneratedAt)
        : null,
  };
}

function extractAddressAndAdminMeta(raw: Record<string, unknown> | null) {
  if (!raw) {
    return {
      shippingAddress: null,
      adminMeta: createDefaultAdminMeta(),
    };
  }

  const {
    line1,
    line2,
    city,
    state,
    postal_code,
    country,
    __adminMeta,
  } = raw as ShippingAddressRecord;

  const shippingAddress = {
    line1: typeof line1 === "string" ? line1 : null,
    line2: typeof line2 === "string" ? line2 : null,
    city: typeof city === "string" ? city : null,
    state: typeof state === "string" ? state : null,
    postal_code: typeof postal_code === "string" ? postal_code : null,
    country: typeof country === "string" ? country : null,
  };

  const hasAddressValues = Object.values(shippingAddress).some(Boolean);

  return {
    shippingAddress: hasAddressValues ? shippingAddress : null,
    adminMeta: parseAdminMeta(__adminMeta),
  };
}

function embedAdminMeta(
  shippingAddress: StoredOrder["shippingAddress"],
  adminMeta: AdminMeta,
): Record<string, unknown> | null {
  const base = shippingAddress ? { ...shippingAddress } : {};
  const hasAdminValues =
    adminMeta.fulfillmentStatus !== DEFAULT_FULFILLMENT_STATUS ||
    adminMeta.trackingNumber ||
    adminMeta.trackingCarrier ||
    adminMeta.trackingUrl ||
    adminMeta.internalNotes ||
    adminMeta.fulfilledAt ||
    adminMeta.packageWeightGrams !== null ||
    adminMeta.packageLengthCm !== null ||
    adminMeta.packageWidthCm !== null ||
    adminMeta.packageHeightCm !== null ||
    adminMeta.packageDescription ||
    adminMeta.shippingBatchId ||
    adminMeta.courierShipmentId ||
    adminMeta.shippingLabelGeneratedAt;

  if (hasAdminValues) {
    return {
      ...base,
      __adminMeta: adminMeta,
    };
  }

  return Object.keys(base).length > 0 ? base : null;
}

async function ensureOrdersFile() {
  const filePath = resolveOrdersFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "[]\n", "utf8");
  }

  return filePath;
}

async function readOrdersFromFile() {
  const filePath = await ensureOrdersFile();
  const raw = await fs.readFile(filePath, "utf8");

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((order) => {
      const candidate = order as Partial<StoredOrder>;
      const admin = createDefaultAdminMeta();

      return {
        ...candidate,
        fulfillmentStatus: isFulfillmentStatus(candidate.fulfillmentStatus)
          ? candidate.fulfillmentStatus
          : admin.fulfillmentStatus,
        trackingNumber: normalizeText(candidate.trackingNumber),
        trackingCarrier: normalizeText(candidate.trackingCarrier),
        trackingUrl: normalizeText(candidate.trackingUrl),
        internalNotes: normalizeText(candidate.internalNotes),
        fulfilledAt: normalizeText(candidate.fulfilledAt),
        packageWeightGrams: normalizeNumber(candidate.packageWeightGrams),
        packageLengthCm: normalizeNumber(candidate.packageLengthCm),
        packageWidthCm: normalizeNumber(candidate.packageWidthCm),
        packageHeightCm: normalizeNumber(candidate.packageHeightCm),
        packageDescription: normalizeText(candidate.packageDescription),
        shippingBatchId: normalizeText(candidate.shippingBatchId),
        courierShipmentId: normalizeText(candidate.courierShipmentId),
        shippingLabelGeneratedAt: normalizeText(candidate.shippingLabelGeneratedAt),
      } as StoredOrder;
    });
  } catch {
    return [];
  }
}

async function writeOrdersToFile(orders: StoredOrder[]) {
  const filePath = await ensureOrdersFile();
  await fs.writeFile(filePath, `${JSON.stringify(orders, null, 2)}\n`, "utf8");
}

function toSupabaseOrderRow(order: StoredOrder): SupabaseOrderRow {
  const adminMeta: AdminMeta = {
    fulfillmentStatus: order.fulfillmentStatus,
    trackingNumber: order.trackingNumber,
    trackingCarrier: order.trackingCarrier,
    trackingUrl: order.trackingUrl,
    internalNotes: order.internalNotes,
    fulfilledAt: order.fulfilledAt,
    packageWeightGrams: order.packageWeightGrams,
    packageLengthCm: order.packageLengthCm,
    packageWidthCm: order.packageWidthCm,
    packageHeightCm: order.packageHeightCm,
    packageDescription: order.packageDescription,
    shippingBatchId: order.shippingBatchId,
    courierShipmentId: order.courierShipmentId,
    shippingLabelGeneratedAt: order.shippingLabelGeneratedAt,
  };

  return {
    order_id: order.id,
    session_id: order.sessionId,
    payment_intent_id: order.paymentIntentId,
    ordered_at: order.createdAt,
    updated_at: order.updatedAt,
    recorded_from: order.recordedFrom,
    customer_name: order.customerName,
    customer_email: order.customerEmail,
    customer_phone: order.customerPhone,
    payment_status: order.paymentStatus,
    checkout_status: order.checkoutStatus,
    currency: order.currency,
    subtotal_amount: order.subtotalAmount,
    shipping_amount: order.shippingAmount,
    tax_amount: order.taxAmount,
    total_amount: order.totalAmount,
    shipping_name: order.shippingName,
    shipping_address: embedAdminMeta(order.shippingAddress, adminMeta),
  };
}

function toSupabaseOrderLineRows(order: StoredOrder): SupabaseOrderLineRow[] {
  return order.lines.map((line, index) => ({
    order_session_id: order.sessionId,
    line_position: index,
    description: line.description,
    quantity: line.quantity,
    currency: line.currency,
    unit_amount: line.unitAmount,
    subtotal_amount: line.subtotalAmount,
    total_amount: line.totalAmount,
  }));
}

function fromSupabaseOrderRow(row: SupabaseOrderRow): StoredOrder {
  const { shippingAddress, adminMeta } = extractAddressAndAdminMeta(row.shipping_address);

  return {
    id: row.order_id,
    sessionId: row.session_id,
    paymentIntentId: row.payment_intent_id,
    createdAt: row.ordered_at,
    updatedAt: row.updated_at,
    recordedFrom: row.recorded_from,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    paymentStatus: row.payment_status,
    checkoutStatus: row.checkout_status,
    currency: row.currency,
    subtotalAmount: row.subtotal_amount,
    shippingAmount: row.shipping_amount,
    taxAmount: row.tax_amount,
    totalAmount: row.total_amount,
    shippingName: row.shipping_name,
    shippingAddress,
    ...adminMeta,
    lines: [...(row.order_lines ?? [])]
      .sort((left, right) => left.line_position - right.line_position)
      .map((line) => ({
        description: line.description,
        quantity: line.quantity,
        currency: line.currency,
        unitAmount: line.unit_amount,
        subtotalAmount: line.subtotal_amount,
        totalAmount: line.total_amount,
      })),
  };
}

function mergeOrders(
  incoming: StoredOrder,
  existing: StoredOrder | null,
  preserveAdminFields: boolean,
) {
  if (!existing) {
    return incoming;
  }

  return {
    ...existing,
    ...incoming,
    shippingAddress: incoming.shippingAddress ?? existing.shippingAddress,
    lines: incoming.lines.length > 0 ? incoming.lines : existing.lines,
    fulfillmentStatus: preserveAdminFields
      ? existing.fulfillmentStatus
      : incoming.fulfillmentStatus,
    trackingNumber: preserveAdminFields ? existing.trackingNumber : incoming.trackingNumber,
    trackingCarrier: preserveAdminFields ? existing.trackingCarrier : incoming.trackingCarrier,
    trackingUrl: preserveAdminFields ? existing.trackingUrl : incoming.trackingUrl,
    internalNotes: preserveAdminFields ? existing.internalNotes : incoming.internalNotes,
    fulfilledAt: preserveAdminFields ? existing.fulfilledAt : incoming.fulfilledAt,
    packageWeightGrams: preserveAdminFields
      ? existing.packageWeightGrams
      : incoming.packageWeightGrams,
    packageLengthCm: preserveAdminFields
      ? existing.packageLengthCm
      : incoming.packageLengthCm,
    packageWidthCm: preserveAdminFields
      ? existing.packageWidthCm
      : incoming.packageWidthCm,
    packageHeightCm: preserveAdminFields
      ? existing.packageHeightCm
      : incoming.packageHeightCm,
    packageDescription: preserveAdminFields
      ? existing.packageDescription
      : incoming.packageDescription,
    shippingBatchId: preserveAdminFields ? existing.shippingBatchId : incoming.shippingBatchId,
    courierShipmentId: preserveAdminFields
      ? existing.courierShipmentId
      : incoming.courierShipmentId,
    shippingLabelGeneratedAt: preserveAdminFields
      ? existing.shippingLabelGeneratedAt
      : incoming.shippingLabelGeneratedAt,
    updatedAt: new Date().toISOString(),
  } satisfies StoredOrder;
}

async function readOrdersFromSupabase() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_id, session_id, payment_intent_id, ordered_at, updated_at, recorded_from, customer_name, customer_email, customer_phone, payment_status, checkout_status, currency, subtotal_amount, shipping_amount, tax_amount, total_amount, shipping_name, shipping_address, order_lines(order_session_id, line_position, description, quantity, currency, unit_amount, subtotal_amount, total_amount)",
    )
    .order("ordered_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to read orders from Supabase: ${error.message}`);
  }

  return (data ?? []).map((row) => fromSupabaseOrderRow(row as SupabaseOrderRow));
}

async function getOrderBySessionIdFromSupabase(sessionId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_id, session_id, payment_intent_id, ordered_at, updated_at, recorded_from, customer_name, customer_email, customer_phone, payment_status, checkout_status, currency, subtotal_amount, shipping_amount, tax_amount, total_amount, shipping_name, shipping_address, order_lines(order_session_id, line_position, description, quantity, currency, unit_amount, subtotal_amount, total_amount)",
    )
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load order from Supabase: ${error.message}`);
  }

  return data ? fromSupabaseOrderRow(data as SupabaseOrderRow) : null;
}

async function upsertOrderToSupabase(
  order: StoredOrder,
  preserveAdminFields: boolean,
) {
  const existing = await getOrderBySessionIdFromSupabase(order.sessionId).catch(() => null);
  const mergedOrder = mergeOrders(order, existing, preserveAdminFields);
  const supabase = getSupabaseAdmin();

  const { error: orderError } = await supabase
    .from("orders")
    .upsert(toSupabaseOrderRow(mergedOrder), { onConflict: "session_id" });

  if (orderError) {
    throw new Error(`Unable to store order in Supabase: ${orderError.message}`);
  }

  const { error: deleteError } = await supabase
    .from("order_lines")
    .delete()
    .eq("order_session_id", mergedOrder.sessionId);

  if (deleteError) {
    throw new Error(
      `Unable to refresh order lines in Supabase: ${deleteError.message}`,
    );
  }

  const lineRows = toSupabaseOrderLineRows(mergedOrder);

  if (lineRows.length > 0) {
    const { error: lineError } = await supabase.from("order_lines").insert(lineRows);

    if (lineError) {
      throw new Error(
        `Unable to store order lines in Supabase: ${lineError.message}`,
      );
    }
  }

  return mergedOrder;
}

export async function readOrders() {
  if (isSupabaseOrderStoreConfigured()) {
    try {
      return await readOrdersFromSupabase();
    } catch {
      return readOrdersFromFile();
    }
  }

  return readOrdersFromFile();
}

export async function upsertOrder(
  order: StoredOrder,
  options?: { preserveAdminFields?: boolean },
) {
  const preserveAdminFields = options?.preserveAdminFields ?? false;
  const normalizedOrder = {
    ...order,
    updatedAt: new Date().toISOString(),
  };

  if (isSupabaseOrderStoreConfigured()) {
    try {
      return await upsertOrderToSupabase(normalizedOrder, preserveAdminFields);
    } catch {
      // Fall back to file storage until the Supabase schema is fully applied.
    }
  }

  const orders = await readOrdersFromFile();
  const existingIndex = orders.findIndex(
    (entry) => entry.sessionId === normalizedOrder.sessionId,
  );
  const existing = existingIndex >= 0 ? orders[existingIndex] : null;
  const merged = mergeOrders(normalizedOrder, existing, preserveAdminFields);

  if (existingIndex >= 0) {
    orders[existingIndex] = merged;
  } else {
    orders.unshift(merged);
  }

  await writeOrdersToFile(orders);
  return merged;
}

export async function getOrderBySessionId(sessionId: string) {
  if (isSupabaseOrderStoreConfigured()) {
    try {
      return await getOrderBySessionIdFromSupabase(sessionId);
    } catch {
      return null;
    }
  }

  const orders = await readOrdersFromFile();
  return orders.find((order) => order.sessionId === sessionId) ?? null;
}

export async function getOrdersBySessionIds(sessionIds: string[]) {
  const sessionIdSet = new Set(sessionIds);
  const orders = await readOrders();
  return orders.filter((order) => sessionIdSet.has(order.sessionId));
}

export async function updateOrderManagement(
  sessionId: string,
  patch: Partial<AdminMeta>,
) {
  const existingOrder = await getOrderBySessionId(sessionId);

  if (!existingOrder) {
    throw new Error("Order not found.");
  }

  const fulfillmentStatus = patch.fulfillmentStatus ?? existingOrder.fulfillmentStatus;
  const fulfilledAt =
    fulfillmentStatus === "fulfilled"
      ? patch.fulfilledAt ?? existingOrder.fulfilledAt ?? new Date().toISOString()
      : fulfillmentStatus === "packed"
      ? existingOrder.fulfilledAt
      : null;

  const updatedOrder: StoredOrder = {
    ...existingOrder,
    fulfillmentStatus,
    trackingNumber:
      patch.trackingNumber !== undefined
        ? normalizeText(patch.trackingNumber)
        : existingOrder.trackingNumber,
    trackingCarrier:
      patch.trackingCarrier !== undefined
        ? normalizeText(patch.trackingCarrier)
        : existingOrder.trackingCarrier,
    trackingUrl:
      patch.trackingUrl !== undefined
        ? normalizeText(patch.trackingUrl)
        : existingOrder.trackingUrl,
    internalNotes:
      patch.internalNotes !== undefined
        ? normalizeText(patch.internalNotes)
        : existingOrder.internalNotes,
    fulfilledAt,
    packageWeightGrams:
      patch.packageWeightGrams !== undefined
        ? normalizeNumber(patch.packageWeightGrams)
        : existingOrder.packageWeightGrams,
    packageLengthCm:
      patch.packageLengthCm !== undefined
        ? normalizeNumber(patch.packageLengthCm)
        : existingOrder.packageLengthCm,
    packageWidthCm:
      patch.packageWidthCm !== undefined
        ? normalizeNumber(patch.packageWidthCm)
        : existingOrder.packageWidthCm,
    packageHeightCm:
      patch.packageHeightCm !== undefined
        ? normalizeNumber(patch.packageHeightCm)
        : existingOrder.packageHeightCm,
    packageDescription:
      patch.packageDescription !== undefined
        ? normalizeText(patch.packageDescription)
        : existingOrder.packageDescription,
    shippingBatchId:
      patch.shippingBatchId !== undefined
        ? normalizeText(patch.shippingBatchId)
        : existingOrder.shippingBatchId,
    courierShipmentId:
      patch.courierShipmentId !== undefined
        ? normalizeText(patch.courierShipmentId)
        : existingOrder.courierShipmentId,
    shippingLabelGeneratedAt:
      patch.shippingLabelGeneratedAt !== undefined
        ? normalizeText(patch.shippingLabelGeneratedAt)
        : existingOrder.shippingLabelGeneratedAt,
  };

  return upsertOrder(updatedOrder, { preserveAdminFields: false });
}

export async function recordCompletedOrder(params: {
  session: Stripe.Checkout.Session;
  lineItems: Stripe.ApiList<Stripe.LineItem>;
  source: "webhook" | "success-page";
}) {
  const { session, lineItems, source } = params;
  const customer = session.customer_details;
  const createdAt = new Date(
    (session.created ?? Math.floor(Date.now() / 1000)) * 1000,
  ).toISOString();
  const admin = createDefaultAdminMeta();

  const order: StoredOrder = {
    id:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.id,
    sessionId: session.id,
    paymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
    createdAt,
    updatedAt: new Date().toISOString(),
    recordedFrom: source,
    customerName: customer?.name ?? null,
    customerEmail: customer?.email ?? null,
    customerPhone: customer?.phone ?? null,
    paymentStatus: session.payment_status ?? null,
    checkoutStatus: session.status ?? null,
    currency: session.currency ?? "myr",
    subtotalAmount: session.amount_subtotal ?? null,
    shippingAmount: session.total_details?.amount_shipping ?? null,
    taxAmount: session.total_details?.amount_tax ?? null,
    totalAmount: session.amount_total ?? null,
    shippingName: customer?.name ?? null,
    shippingAddress: customer?.address ?? null,
    ...admin,
    lines: lineItems.data.map((line) => ({
      description: line.description ?? "Product",
      quantity: line.quantity ?? 0,
      currency: line.currency ?? session.currency ?? "myr",
      unitAmount: line.price?.unit_amount ?? null,
      subtotalAmount: line.amount_subtotal ?? null,
      totalAmount: line.amount_total ?? null,
    })),
  };

  return upsertOrder(order, { preserveAdminFields: true });
}
