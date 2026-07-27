import { listMembers, type Member } from "@/lib/members";
import { readOrders, type StoredOrder } from "@/lib/orders";
import { buildWhatsAppShareUrl, getReceiptNumber } from "@/lib/receipt";
import { getPublicSiteUrl } from "@/lib/store-config";

/**
 * The customer book: registered walk-in members joined to every order they have
 * made, plus anyone who bought without being registered (online checkouts, and
 * counter sales taken before the members table existed).
 *
 * Orders link to a member through `member_id`. Older rows predate that column,
 * so phone and email are used as secondary keys — the counter re-uses a member
 * row whenever either matches, which makes them reliable identifiers.
 */

export type CustomerReceipt = {
  sessionId: string;
  receiptNumber: string;
  createdAt: string;
  totalAmount: number | null;
  paymentStatus: string | null;
  recordedFrom: StoredOrder["recordedFrom"];
  fulfillmentType: StoredOrder["fulfillmentType"];
  itemCount: number;
  /** Staff who rang the sale up, when it was a counter sale. */
  soldById: string | null;
  soldByName: string | null;
  location: string | null;
  discountPercent: number | null;
  /** Relative link for admin use. */
  receiptPath: string;
  /** Absolute link — this is what the customer receives. */
  receiptUrl: string;
  whatsAppUrl: string | null;
};

export type CustomerRecord = {
  /** Stable, URL-safe id: `m-<uuid>` for members, `c-<hash>` for contact-only. */
  id: string;
  memberId: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  joinedAt: string | null;
  isMember: boolean;
  orderCount: number;
  paidOrderCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
  /** Every staff member who has sold to this customer, most recent first. */
  soldBy: Array<{ id: string; name: string }>;
  receipts: CustomerReceipt[];
};

function phoneKey(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  // Compare on the national part so 0173159643 and +60173159643 are one person.
  return digits.slice(-9);
}

function emailKey(email: string | null | undefined) {
  const trimmed = email?.trim().toLowerCase();
  return trimmed || null;
}

/** Short, stable id for a customer we only know by contact details. */
function contactId(key: string) {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) | 0;
  }
  return `c-${(hash >>> 0).toString(36)}`;
}

function toReceipt(order: StoredOrder, origin: string): CustomerReceipt {
  const receiptPath = `/receipt/${order.sessionId}`;
  const receiptUrl = `${origin}${receiptPath}`;

  return {
    sessionId: order.sessionId,
    receiptNumber: getReceiptNumber(order),
    createdAt: order.createdAt,
    totalAmount: order.totalAmount,
    paymentStatus: order.paymentStatus,
    recordedFrom: order.recordedFrom,
    fulfillmentType: order.fulfillmentType,
    itemCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
    soldById: order.soldById,
    soldByName: order.soldByName,
    location: order.location,
    discountPercent: order.discountPercent,
    receiptPath,
    receiptUrl,
    whatsAppUrl: buildWhatsAppShareUrl(
      order.customerPhone,
      `Resit pembelian anda di Aerthera: ${receiptUrl}`,
    ),
  };
}

function createRecord(input: {
  id: string;
  memberId: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  joinedAt: string | null;
  isMember: boolean;
}): CustomerRecord {
  return {
    ...input,
    orderCount: 0,
    paidOrderCount: 0,
    totalSpentCents: 0,
    lastOrderAt: null,
    soldBy: [],
    receipts: [],
  };
}

function attachOrder(record: CustomerRecord, order: StoredOrder, origin: string) {
  record.receipts.push(toReceipt(order, origin));
  record.orderCount += 1;

  if (order.paymentStatus === "paid") {
    record.paidOrderCount += 1;
    record.totalSpentCents += order.totalAmount ?? 0;
  }

  if (!record.lastOrderAt || order.createdAt > record.lastOrderAt) {
    record.lastOrderAt = order.createdAt;
  }

  if (order.soldById && !record.soldBy.some((staff) => staff.id === order.soldById)) {
    record.soldBy.push({
      id: order.soldById,
      name: order.soldByName ?? order.soldById,
    });
  }

  // Fill blanks from the order so a member registered without an email still
  // shows the one they gave at the till.
  record.phone = record.phone ?? order.customerPhone;
  record.email = record.email ?? order.customerEmail;
}

function fromMember(member: Member): CustomerRecord {
  return createRecord({
    id: `m-${member.id}`,
    memberId: member.id,
    fullName: member.fullName,
    phone: member.phone,
    email: member.email,
    location: member.location,
    joinedAt: member.createdAt,
    isMember: true,
  });
}

/** Everyone who has bought or been registered, most recent activity first. */
export async function listCustomers(): Promise<CustomerRecord[]> {
  const [members, orders] = await Promise.all([listMembers(), readOrders()]);
  const origin = getPublicSiteUrl();

  const records: CustomerRecord[] = [];
  const byMemberId = new Map<string, CustomerRecord>();
  const byPhone = new Map<string, CustomerRecord>();
  const byEmail = new Map<string, CustomerRecord>();

  function index(record: CustomerRecord) {
    records.push(record);
    if (record.memberId) byMemberId.set(record.memberId, record);
    const phone = phoneKey(record.phone);
    if (phone && !byPhone.has(phone)) byPhone.set(phone, record);
    const email = emailKey(record.email);
    if (email && !byEmail.has(email)) byEmail.set(email, record);
  }

  for (const member of members) {
    index(fromMember(member));
  }

  for (const order of orders) {
    const phone = phoneKey(order.customerPhone);
    const email = emailKey(order.customerEmail);
    const match =
      (order.memberId ? byMemberId.get(order.memberId) : undefined) ??
      (phone ? byPhone.get(phone) : undefined) ??
      (email ? byEmail.get(email) : undefined);

    if (match) {
      attachOrder(match, order, origin);
      continue;
    }

    // Nothing to identify this buyer by — an anonymous till sale or an
    // abandoned online checkout. Not a customer record.
    if (!order.customerName && !phone && !email) continue;

    const key = phone ?? email ?? order.sessionId;
    const record = createRecord({
      id: contactId(key),
      memberId: null,
      fullName: order.customerName?.trim() || order.shippingName?.trim() || "Guest",
      phone: order.customerPhone,
      email: order.customerEmail,
      location: null,
      joinedAt: order.createdAt,
      isMember: false,
    });

    attachOrder(record, order, origin);
    index(record);
  }

  for (const record of records) {
    record.receipts.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  return records.sort((left, right) => {
    const leftAt = left.lastOrderAt ?? left.joinedAt ?? "";
    const rightAt = right.lastOrderAt ?? right.joinedAt ?? "";
    return rightAt.localeCompare(leftAt);
  });
}

export async function getCustomerById(id: string): Promise<CustomerRecord | null> {
  const customers = await listCustomers();
  return customers.find((customer) => customer.id === id) ?? null;
}

/** Name / phone / email search over the customer book. */
export function filterCustomers(customers: CustomerRecord[], query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return customers;

  const digits = trimmed.replace(/\D/g, "");

  return customers.filter((customer) => {
    if (customer.fullName.toLowerCase().includes(trimmed)) return true;
    if (customer.email?.toLowerCase().includes(trimmed)) return true;
    if (digits.length >= 3 && customer.phone?.replace(/\D/g, "").includes(digits)) {
      return true;
    }
    return false;
  });
}

/** Only the customers a given staff member has sold to. */
export function filterCustomersBySeller(customers: CustomerRecord[], soldById: string) {
  return customers.filter((customer) =>
    customer.soldBy.some((staff) => staff.id === soldById),
  );
}

export type CustomerMatch = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  isMember: boolean;
  orderCount: number;
};

/**
 * Typeahead for the counter. Searches the whole customer book rather than the
 * `members` table alone: most buyers were never registered as members, and a
 * phone typed as plain digits has to match one stored as "+60 17-315 9643".
 */
export async function searchCustomerBook(
  query: string,
  limit = 8,
): Promise<CustomerMatch[]> {
  if (query.trim().length < 2) return [];

  return filterCustomers(await listCustomers(), query)
    .slice(0, limit)
    .map((customer) => ({
      id: customer.id,
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      isMember: customer.isMember,
      orderCount: customer.orderCount,
    }));
}
