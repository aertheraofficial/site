"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearAdminSession,
  createAdminSession,
  isAdminConfigured,
  validateAdminCredentials,
} from "@/lib/admin-auth";
import {
  authenticateStaff,
  clearStaffSession,
  createStaffSession,
  hashPassword,
  requireActor,
  requireAdminActor,
  requirePermission,
} from "@/lib/staff-auth";
import {
  createStaff,
  getStaffById,
  setStaffPassword,
  setStaffStatus,
  updateStaff,
  updateStaffProfile,
  upsertPayslip,
  type StaffWriteInput,
} from "@/lib/staff";
import { calcPayroll } from "@/lib/payroll";
import {
  ASSIGNABLE_PAGES,
  DEFAULT_ROLE,
  getRole,
  isRoleKey,
  isStaffStatus,
  type PageKey,
  type StaffStatus,
} from "@/lib/staff-permissions";
import {
  createDhlShipmentBatch,
  getDhlTrackingPortalUrl,
  isDhlEcommerceConfigured,
} from "@/lib/dhl-ecommerce";
import { randomBytes } from "crypto";
import {
  type FulfillmentStatus,
  type StoredOrder,
  getOrdersBySessionIds,
  isDiscountPercent,
  upsertOrder,
  updateOrderManagement,
} from "@/lib/orders";
import {
  decrementStockForOrderLines,
  getLocationName,
  getProductBySlugWithStock,
  getQuantitiesForSlugs,
  isLocationId,
  markProductPreorder,
  quickDecrementStock,
  setProductQuantity,
} from "@/lib/product-stock";
import { createAdminProduct, uploadProductImage } from "@/lib/admin-products";
import { setProductOverride, type ProductOverride } from "@/lib/product-overrides";
import { createMember } from "@/lib/members";
import { searchCustomerBook, type CustomerMatch } from "@/lib/customers";
import { buildWhatsAppShareUrl } from "@/lib/receipt";
import { sendReceiptEmail, type ReceiptEmailResult } from "@/lib/receipt-email";
import { getPublicSiteUrl } from "@/lib/store-config";
import {
  isStaffSelfRegistrationEnabled,
  isValidStaffInviteCode,
} from "@/lib/staff-signup";
import {
  generateSingleSocialAd,
  regenerateSocialDraftVariant,
} from "@/lib/social/agents";
import type { SocialPlatform } from "@/lib/social/brand";
import {
  createPausedMetaAdFromDraft,
  isMetaAdBillingMissing,
} from "@/lib/social/meta-ads";
import {
  isMetaAccessTokenExpiredOrInvalid,
  publishSocialDraftToMeta,
} from "@/lib/social/meta";
import {
  getSocialDraftById,
  saveSocialCampaignWithDrafts,
  updateSocialDraft,
  type SocialPostStatus,
} from "@/lib/social/store";

const VALID_FULFILLMENT_STATUSES = new Set<FulfillmentStatus>([
  "unfulfilled",
  "packed",
  "fulfilled",
  "cancelled",
]);

function sanitizeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "/admin/orders";
  }

  return value.startsWith("/admin") ? value : "/admin/orders";
}

function appendAdminQuery(pathname: string, key: string, value: string) {
  const url = new URL(sanitizeNextPath(pathname), "http://admin.local");
  url.searchParams.set(key, value);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
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

function parseSocialPostStatus(value: FormDataEntryValue | null): SocialPostStatus {
  if (
    value === "approved" ||
    value === "scheduled" ||
    value === "published" ||
    value === "manual_posted" ||
    value === "rejected" ||
    value === "failed" ||
    value === "needs_review"
  ) {
    return value;
  }

  return "needs_review";
}

function parseSocialPlatform(value: FormDataEntryValue | null): SocialPlatform {
  if (
    value === "instagram" ||
    value === "facebook" ||
    value === "tiktok" ||
    value === "x"
  ) {
    return value;
  }

  return "instagram";
}

export async function loginAction(formData: FormData) {
  const username =
    typeof formData.get("username") === "string"
      ? String(formData.get("username"))
      : "";
  const password =
    typeof formData.get("password") === "string"
      ? String(formData.get("password"))
      : "";
  const nextPath = sanitizeNextPath(formData.get("next"));

  if (!isAdminConfigured()) {
    redirect("/admin/login?error=unconfigured");
  }

  if (validateAdminCredentials(username, password)) {
    await clearStaffSession();
    await createAdminSession();
    redirect(nextPath);
  }

  // Not the master admin — try a staff account.
  const staffId = await authenticateStaff(username, password);
  if (staffId) {
    await clearAdminSession();
    await createStaffSession(staffId);
    // Staff may not have access to the requested page; the index routes them
    // to their first allowed page (or their profile).
    redirect(nextPath === "/admin/orders" ? "/admin" : nextPath);
  }

  redirect(`/admin/login?error=invalid&next=${encodeURIComponent(nextPath)}`);
}

export async function logoutAction() {
  await clearAdminSession();
  await clearStaffSession();
  redirect("/admin/login?error=logged-out");
}

export async function updateOrderManagementAction(formData: FormData) {
  const sessionId =
    typeof formData.get("sessionId") === "string"
      ? String(formData.get("sessionId"))
      : "";

  if (!sessionId) {
    redirect("/admin/orders?error=missing-order");
  }

  await requirePermission("orders", `/admin/orders/${encodeURIComponent(sessionId)}`);

  const nextStatus =
    typeof formData.get("fulfillmentStatus") === "string"
      ? String(formData.get("fulfillmentStatus"))
      : "";

  const fulfillmentStatus = VALID_FULFILLMENT_STATUSES.has(
    nextStatus as FulfillmentStatus,
  )
    ? (nextStatus as FulfillmentStatus)
    : "unfulfilled";

  await updateOrderManagement(sessionId, {
    fulfillmentStatus,
    trackingCarrier:
      typeof formData.get("trackingCarrier") === "string"
        ? String(formData.get("trackingCarrier"))
        : "",
    trackingNumber:
      typeof formData.get("trackingNumber") === "string"
        ? String(formData.get("trackingNumber"))
        : "",
    trackingUrl:
      typeof formData.get("trackingUrl") === "string"
        ? String(formData.get("trackingUrl"))
        : "",
    internalNotes:
      typeof formData.get("internalNotes") === "string"
        ? String(formData.get("internalNotes"))
        : "",
    packageWeightGrams: parseOptionalNumber(formData.get("packageWeightGrams")),
    packageLengthCm: parseOptionalNumber(formData.get("packageLengthCm")),
    packageWidthCm: parseOptionalNumber(formData.get("packageWidthCm")),
    packageHeightCm: parseOptionalNumber(formData.get("packageHeightCm")),
    packageDescription:
      typeof formData.get("packageDescription") === "string"
        ? String(formData.get("packageDescription"))
        : "",
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${sessionId}`);
  redirect(`/admin/orders/${encodeURIComponent(sessionId)}?saved=1`);
}

function revalidateStockPaths(slug: string) {
  revalidatePath("/admin/stock");
  revalidatePath("/products");
  revalidatePath(`/product-page/${slug}`);
  revalidatePath("/");
}

function getRequiredSlug(formData: FormData) {
  const slug =
    typeof formData.get("slug") === "string" ? String(formData.get("slug")) : "";

  if (!slug) {
    redirect("/admin/stock?error=missing-product");
  }

  return slug;
}

function getRequiredLocation(formData: FormData) {
  const location =
    typeof formData.get("location") === "string" ? String(formData.get("location")) : "";

  if (!isLocationId(location)) {
    redirect("/admin/stock?error=missing-location");
  }

  return location;
}

function stockReturnPath(location: string) {
  return `/admin/stock?location=${encodeURIComponent(location)}`;
}

export async function setProductQuantityAction(formData: FormData) {
  await requirePermission("stock", "/admin/stock");

  const slug = getRequiredSlug(formData);
  const location = getRequiredLocation(formData);
  const rawQuantity =
    typeof formData.get("quantity") === "string" ? String(formData.get("quantity")) : "";
  const quantity = Number(rawQuantity);

  if (!Number.isFinite(quantity) || quantity < 0) {
    redirect(`${stockReturnPath(location)}&error=invalid-quantity`);
  }

  try {
    await setProductQuantity(slug, quantity, location);
  } catch (error) {
    redirect(
      `${stockReturnPath(location)}&error=${encodeURIComponent(
        error instanceof Error ? error.message : "Unable to update stock.",
      )}`,
    );
  }

  revalidateStockPaths(slug);
  redirect(`${stockReturnPath(location)}&saved=1`);
}

export async function quickDecrementStockAction(formData: FormData) {
  await requirePermission("stock", "/admin/stock");

  const slug = getRequiredSlug(formData);
  const location = getRequiredLocation(formData);

  try {
    await quickDecrementStock(slug, location, 1);
  } catch (error) {
    redirect(
      `${stockReturnPath(location)}&error=${encodeURIComponent(
        error instanceof Error ? error.message : "Unable to update stock.",
      )}`,
    );
  }

  revalidateStockPaths(slug);
  redirect(`${stockReturnPath(location)}&saved=1`);
}

export async function markProductPreorderAction(formData: FormData) {
  await requirePermission("stock", "/admin/stock");

  const slug = getRequiredSlug(formData);
  const location = getRequiredLocation(formData);

  try {
    await markProductPreorder(slug, location);
  } catch (error) {
    redirect(
      `${stockReturnPath(location)}&error=${encodeURIComponent(
        error instanceof Error ? error.message : "Unable to update stock.",
      )}`,
    );
  }

  revalidateStockPaths(slug);
  redirect(`${stockReturnPath(location)}&saved=1`);
}

export async function createAdminProductAction(formData: FormData) {
  await requirePermission("products", "/admin/products/new");

  const name = String(formData.get("name") ?? "").trim();
  const newCategoryLabel = String(formData.get("newCategoryLabel") ?? "").trim();
  const categoryLabel = newCategoryLabel || String(formData.get("categoryLabel") ?? "").trim();
  const size = String(formData.get("size") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageFile = formData.get("image");

  const price = Number(priceRaw);

  if (!name || !categoryLabel || !size || !Number.isFinite(price) || price <= 0) {
    redirect("/admin/products/new?error=missing-fields");
  }

  if (!(imageFile instanceof File) || imageFile.size === 0) {
    redirect("/admin/products/new?error=missing-image");
  }

  let slug: string;

  try {
    const imageUrl = await uploadProductImage(imageFile);
    slug = await createAdminProduct({
      name,
      categoryLabel,
      size,
      price,
      excerpt,
      description,
      imageUrl,
    });
  } catch (error) {
    redirect(
      `/admin/products/new?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Unable to create product.",
      )}`,
    );
  }

  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/admin/stock");
  revalidatePath("/admin/labels");
  revalidatePath("/admin/counter-sale");
  revalidatePath(`/product-page/${slug}`);
  redirect(`/admin/stock?saved=1`);
}

export type CounterSaleLine = {
  slug: string;
  quantity: number;
};

export async function updateProductAction(formData: FormData) {
  await requirePermission("products", "/admin/products");

  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) redirect("/admin/products?error=missing-slug");

  const name = String(formData.get("name") ?? "").trim();
  const newCategoryLabel = String(formData.get("newCategoryLabel") ?? "").trim();
  const categoryLabel =
    newCategoryLabel || String(formData.get("categoryLabel") ?? "").trim();
  const size = String(formData.get("size") ?? "").trim();
  const price = Number(String(formData.get("price") ?? "").trim());
  const imageFile = formData.get("image");

  // Optional caller-supplied return path (e.g. the Manage Stock quick-edit
  // modal wants to land back on /admin/stock, not the products list).
  const rawReturnTo = String(formData.get("redirectTo") ?? "").trim();
  const returnTo = rawReturnTo.startsWith("/admin/") ? rawReturnTo : null;
  const withParam = (path: string, key: string, value: string) =>
    `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;

  const editPath = `/admin/products/${encodeURIComponent(slug)}/edit`;
  if (!name || !categoryLabel || !size || !Number.isFinite(price) || price <= 0) {
    redirect(
      returnTo
        ? withParam(returnTo, "error", "missing-fields")
        : `${editPath}?error=missing-fields`,
    );
  }

  const fields: ProductOverride = { name, categoryLabel, size, price };
  try {
    if (imageFile instanceof File && imageFile.size > 0) {
      fields.imageUrl = await uploadProductImage(imageFile);
    }
    await setProductOverride(slug, fields);
  } catch (error) {
    const message = error instanceof Error ? error.message : "save-failed";
    redirect(
      returnTo
        ? withParam(returnTo, "error", message)
        : `${editPath}?error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/stock");
  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath(`/product-page/${slug}`);
  redirect(returnTo ? withParam(returnTo, "saved", "1") : "/admin/products?saved=1");
}

export type CounterSalePayload = {
  lines: CounterSaleLine[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  paymentMethod: "Cash" | "Card" | "DuitNow QR" | "Other";
  location: string;
  /** 10, 30 or 50 — anything else is treated as full price. */
  discountPercent: number | null;
};

/**
 * Counter typeahead for existing customers.
 *
 * A server action rather than a route handler: the admin/staff session cookies
 * are scoped to `path=/admin`, so a fetch to `/api/...` never carries them and
 * every lookup came back 401 (the counter simply showed no results).
 *
 * It searches the customer book, not the `members` table: most people who have
 * bought were never registered as members, so a name-only search over `members`
 * missed them.
 */
export async function searchCustomersAction(query: string): Promise<CustomerMatch[]> {
  await requirePermission("counter-sale", "/admin/counter-sale");

  return searchCustomerBook(query);
}

export async function recordCounterSaleAction(payload: CounterSalePayload) {
  const actor = await requirePermission("counter-sale", "/admin/counter-sale");
  const soldById = actor.type === "admin" ? "admin" : actor.staff.id;
  const soldByName = actor.type === "admin" ? actor.name : actor.staff.fullName;

  if (!isLocationId(payload.location) || payload.location === "online") {
    return { ok: false as const, error: "Choose which shop this sale happened at." };
  }

  const consolidated = new Map<string, number>();
  for (const line of payload.lines) {
    if (!line.slug || !Number.isFinite(line.quantity) || line.quantity <= 0) continue;
    const quantity = Math.floor(line.quantity);
    consolidated.set(line.slug, (consolidated.get(line.slug) ?? 0) + quantity);
  }

  if (consolidated.size === 0) {
    return { ok: false as const, error: "Add at least one product to the sale." };
  }

  const slugs = [...consolidated.keys()];
  const trackedQuantities = await getQuantitiesForSlugs(slugs, payload.location);

  const lineItems: Array<{
    slug: string;
    name: string;
    quantity: number;
    unitAmountCents: number;
  }> = [];

  for (const [slug, quantity] of consolidated.entries()) {
    const product = await getProductBySlugWithStock(slug);
    if (!product) {
      return { ok: false as const, error: `Unknown product: ${slug}` };
    }

    const available = trackedQuantities.get(slug);
    if (available !== null && available !== undefined && quantity > available) {
      return {
        ok: false as const,
        error: `Only ${available} of "${product.name}" left in stock.`,
      };
    }

    lineItems.push({
      slug,
      name: product.name,
      quantity,
      unitAmountCents: Math.round(product.price * 100),
    });
  }

  const subtotalCents = lineItems.reduce(
    (sum, l) => sum + l.unitAmountCents * l.quantity,
    0,
  );

  // Subtotal stays the list price so the receipt can show what was taken off.
  const discountPercent = isDiscountPercent(payload.discountPercent)
    ? payload.discountPercent
    : null;
  const discountCents = discountPercent
    ? Math.round((subtotalCents * discountPercent) / 100)
    : 0;
  const totalCents = subtotalCents - discountCents;

  const sessionId = `INSTORE-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const now = new Date().toISOString();

  const customerName = payload.customerName.trim() || null;
  const customerPhone = payload.customerPhone.trim() || null;
  const customerEmail = payload.customerEmail.trim().toLowerCase() || null;

  // Register / reuse the walk-in member when we have something to remember them by.
  // This id belongs in member_id — customer_id is a FK to auth.users, and a
  // members id there fails the constraint and drops the whole order.
  let memberId: string | null = null;
  if (customerName && (customerEmail || customerPhone)) {
    const member = await createMember({
      fullName: customerName,
      phone: customerPhone,
      email: customerEmail,
      location: payload.location,
    });
    memberId = member?.id ?? null;
  }

  const order: StoredOrder = {
      id: sessionId,
      sessionId,
      paymentIntentId: null,
      createdAt: now,
      updatedAt: now,
      recordedFrom: "admin-walk-in",
      customerId: null,
      memberId,
      location: payload.location,
      soldById,
      soldByName,
      customerName,
      customerEmail,
      customerPhone,
      paymentStatus: "paid",
      checkoutStatus: "complete",
      currency: "myr",
      subtotalAmount: subtotalCents,
      shippingAmount: null,
      taxAmount: null,
      totalAmount: totalCents,
      discountPercent,
      // Assigned by upsertOrder, so a reprint always shows the number issued.
      receiptNumber: null,
      fulfillmentType: "in-store",
      shippingName: null,
      shippingAddress: null,
      fulfillmentStatus: "fulfilled",
      trackingNumber: null,
      trackingCarrier: null,
      trackingUrl: null,
      internalNotes: `Counter sale at ${getLocationName(payload.location)} — paid via ${payload.paymentMethod}.${
        discountPercent ? ` Discount ${discountPercent}%.` : ""
      } Sold by ${soldByName}.`,
      fulfilledAt: now,
      packageWeightGrams: null,
      packageLengthCm: null,
      packageWidthCm: null,
      packageHeightCm: null,
      packageDescription: null,
      shippingBatchId: null,
      courierShipmentId: null,
      shippingLabelGeneratedAt: null,
      lines: lineItems.map((l) => ({
        slug: l.slug,
        description: l.name,
        quantity: l.quantity,
        currency: "myr",
        unitAmount: l.unitAmountCents,
        subtotalAmount: l.unitAmountCents * l.quantity,
        totalAmount: l.unitAmountCents * l.quantity,
      })),
  };

  await upsertOrder(order, { preserveAdminFields: false });

  await decrementStockForOrderLines(
    lineItems.map((l) => ({ slug: l.slug, quantity: l.quantity })),
    payload.location,
  );

  revalidatePath("/admin/orders");
  revalidatePath("/admin/stock");
  revalidatePath("/admin/counter-sale");

  // Receipt delivery. Email is fire-and-forget; the sale is already saved.
  // The address and the failure reason go back to the counter so staff can see
  // a typo (or a server misconfiguration) instead of a bare "failed".
  let receiptEmail: ReceiptEmailResult = {
    sent: false,
    address: null,
    reason: null,
  };

  if (customerEmail) {
    receiptEmail = await sendReceiptEmail(order).catch((error) => ({
      sent: false,
      address: customerEmail,
      reason: error instanceof Error ? error.message : "Unknown error.",
    }));
  }

  // Customer-facing link: never localhost, even when admin runs on a laptop.
  const receiptUrl = `${getPublicSiteUrl()}/receipt/${sessionId}`;
  const whatsAppUrl = buildWhatsAppShareUrl(
    customerPhone,
    `Terima kasih! Resit pembelian anda di ${getLocationName(payload.location)}: ${receiptUrl}`,
  );

  return {
    ok: true as const,
    sessionId,
    receiptUrl,
    whatsAppUrl,
    emailedReceipt: receiptEmail.sent,
    receiptEmailAddress: receiptEmail.address,
    receiptEmailError: receiptEmail.reason,
  };
}

export async function generateDhlShipmentBatchAction(formData: FormData) {
  const returnTo = sanitizeNextPath(formData.get("returnTo"));
  await requirePermission("orders", returnTo);

  if (!isDhlEcommerceConfigured()) {
    redirect(
      appendAdminQuery(
        returnTo,
        "shipmentError",
        "DHL eCommerce is not configured yet. Finish the account setup and add the DHL environment variables first.",
      ),
    );
  }

  const sessionIds = [...new Set(
    formData
      .getAll("selectedOrders")
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean),
  )];

  if (sessionIds.length === 0) {
    redirect(
      appendAdminQuery(returnTo, "shipmentError", "Select at least one order first."),
    );
  }

  const orders = await getOrdersBySessionIds(sessionIds);

  if (orders.length !== sessionIds.length) {
    redirect(
      appendAdminQuery(
        returnTo,
        "shipmentError",
        "One or more selected orders could not be found.",
      ),
    );
  }

  let batch: Awaited<ReturnType<typeof createDhlShipmentBatch>>;

  try {
    batch = await createDhlShipmentBatch(orders);
    const trackingUrl = getDhlTrackingPortalUrl();

    await Promise.all(
      batch.shipments.map((shipment) =>
        updateOrderManagement(shipment.sessionId, {
          fulfillmentStatus: "packed",
          trackingCarrier: "DHL eCommerce",
          trackingNumber: shipment.trackingNumber ?? shipment.shipmentId,
          trackingUrl,
          shippingBatchId: batch.id,
          courierShipmentId: shipment.shipmentId,
          shippingLabelGeneratedAt: batch.createdAt,
        }),
      ),
    );

    revalidatePath("/admin/orders");

    for (const sessionId of batch.orderSessionIds) {
      revalidatePath(`/admin/orders/${sessionId}`);
    }

    revalidatePath(`/admin/shipments/${batch.id}`);
  } catch (error) {
    redirect(
      appendAdminQuery(
        returnTo,
        "shipmentError",
        error instanceof Error ? error.message : "Unable to generate DHL labels.",
      ),
    );
  }

  redirect(`/admin/shipments/${encodeURIComponent(batch.id)}?created=1`);
}

export async function generateSocialCalendarAction(formData: FormData) {
  await requirePermission("social", "/admin/social");

  const productSlug =
    typeof formData.get("productSlug") === "string"
      ? String(formData.get("productSlug")).trim()
      : undefined;
  const platform = parseSocialPlatform(formData.get("platform"));
  let campaign: Awaited<ReturnType<typeof generateSingleSocialAd>>["campaign"];
  let drafts: Awaited<ReturnType<typeof generateSingleSocialAd>>["drafts"];

  try {
    const generated = await generateSingleSocialAd({
      productSlug,
      platform,
    });
    campaign = generated.campaign;
    drafts = generated.drafts;
  } catch (error) {
    redirect(
      `/admin/social?error=${encodeURIComponent(
        error instanceof Error ? error.message : "AI ad generation failed.",
      )}`,
    );
  }

  await saveSocialCampaignWithDrafts(campaign, drafts);
  revalidatePath("/admin/social");
  redirect("/admin/social?created=1&status=needs_review");
}

export async function generateReviewPublishSocialAdAction(formData: FormData) {
  await requirePermission("social", "/admin/social");

  const productSlug =
    typeof formData.get("productSlug") === "string"
      ? String(formData.get("productSlug")).trim()
      : undefined;
  const platform = parseSocialPlatform(formData.get("platform"));

  if (platform !== "facebook" && platform !== "instagram") {
    redirect("/admin/social?error=unsupported-platform");
  }

  let campaign: Awaited<ReturnType<typeof generateSingleSocialAd>>["campaign"];
  let drafts: Awaited<ReturnType<typeof generateSingleSocialAd>>["drafts"];

  try {
    const generated = await generateSingleSocialAd({
      productSlug,
      platform,
    });
    campaign = generated.campaign;
    drafts = generated.drafts;
  } catch (error) {
    redirect(
      `/admin/social?error=${encodeURIComponent(
        error instanceof Error ? error.message : "AI ad generation failed.",
      )}`,
    );
  }

  const draft = drafts[0];

  if (draft.reviewerFlags.length > 0) {
    await saveSocialCampaignWithDrafts(campaign, [
      {
        ...draft,
        status: "failed",
        approvalNotes: `Review blocked publishing: ${draft.reviewerFlags.join(" ")}`,
      },
    ]);
    revalidatePath("/admin/social");
    redirect("/admin/social?error=review-blocked");
  }

  try {
    const result = await publishSocialDraftToMeta(draft);
    await saveSocialCampaignWithDrafts(campaign, [
      {
        ...draft,
        status: "published",
        externalPostId: result.externalPostId,
        publishedUrl: result.publishedUrl,
        approvalNotes: `Generated, reviewed, and published to ${result.platform} via Meta Graph API.`,
        modelOutput: {
          ...(draft.modelOutput ?? {}),
          metaPublishResult: result.raw,
        },
      },
    ]);
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Unable to publish to Meta.";
    const metaError =
      isMetaAccessTokenExpiredOrInvalid(msg) ? "meta-token-expired" : "meta-publish-failed";

    await saveSocialCampaignWithDrafts(campaign, [
      {
        ...draft,
        status: "failed",
        approvalNotes: msg,
      },
    ]);
    revalidatePath("/admin/social");
    redirect(`/admin/social?error=${metaError}`);
  }

  revalidatePath("/admin/social");
  redirect("/admin/social?published=1");
}

// --- Staff & payroll ---

function textField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function textOrNullField(formData: FormData, key: string): string | null {
  const value = textField(formData, key);
  return value ? value : null;
}

function numberField(formData: FormData, key: string): number {
  const value = Number(textField(formData, key));
  return Number.isFinite(value) ? value : 0;
}

/** Only pages an admin is allowed to hand out — never the admin-only ones. */
function readPermissions(formData: FormData): PageKey[] {
  return formData
    .getAll("permissions")
    .filter((value): value is string => typeof value === "string")
    .filter((key): key is PageKey =>
      ASSIGNABLE_PAGES.some((page) => page.key === key),
    );
}

function readStaffFields(formData: FormData): Omit<StaffWriteInput, "isActive"> & {
  isActive: boolean;
} {
  const baseSalaryText = textField(formData, "baseSalary");
  const roleValue = textField(formData, "role");
  const role = isRoleKey(roleValue) ? roleValue : DEFAULT_ROLE;
  const customPages = formData.get("customPages") !== null;
  const statusValue = textField(formData, "status");
  // An unrecognised status means the least access, never the most.
  const status = isStaffStatus(statusValue) ? statusValue : "pending";
  return {
    username: textField(formData, "username").toLowerCase(),
    fullName: textField(formData, "fullName"),
    position: textOrNullField(formData, "position"),
    phone: textOrNullField(formData, "phone"),
    email: textOrNullField(formData, "email"),
    icNumber: textOrNullField(formData, "icNumber"),
    bankName: textOrNullField(formData, "bankName"),
    bankAccount: textOrNullField(formData, "bankAccount"),
    joinDate: textOrNullField(formData, "joinDate"),
    baseSalary: baseSalaryText ? numberField(formData, "baseSalary") : null,
    // Pages follow the role by default — choosing "Cashier" cannot half-tick
    // its way into handing over the Social account and the ad budget. An admin
    // who ticks "add extra pages" is making that call deliberately, and the
    // role still decides how much sales data the account can see.
    permissions: customPages
      ? readPermissions(formData)
      : getRole(role).permissions.filter((key) =>
          ASSIGNABLE_PAGES.some((page) => page.key === key),
        ),
    role,
    status,
    // Only a role that answers for one shop keeps a shop; clear it otherwise so
    // a demoted supervisor cannot keep shop-wide sight through a stale value.
    shopLocation: getRole(role).needsShop
      ? textOrNullField(formData, "shopLocation")
      : null,
    isActive: status === "active",
  };
}

export async function createStaffAction(formData: FormData) {
  await requireAdminActor("/admin/staff");

  const fields = readStaffFields(formData);
  const password = textField(formData, "password");

  if (!fields.username || !fields.fullName || password.length < 6) {
    redirect("/admin/staff/new?error=missing-fields");
  }

  let newId = "";
  try {
    const staff = await createStaff({
      ...fields,
      passwordHash: hashPassword(password),
    });
    newId = staff.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create staff.";
    redirect(`/admin/staff/new?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/staff");
  redirect(`/admin/staff/${newId}?saved=1`);
}

export async function updateStaffAction(formData: FormData) {
  await requireAdminActor("/admin/staff");

  const id = textField(formData, "id");
  if (!id) redirect("/admin/staff?error=missing-staff");

  const fields = readStaffFields(formData);
  const password = textField(formData, "password");

  if (!fields.username || !fields.fullName) {
    redirect(`/admin/staff/${id}?error=missing-fields`);
  }
  if (password && password.length < 6) {
    redirect(`/admin/staff/${id}?error=weak-password`);
  }

  try {
    await updateStaff(id, fields);
    if (password) {
      await setStaffPassword(id, hashPassword(password));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update staff.";
    redirect(`/admin/staff/${id}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/staff");
  revalidatePath(`/admin/staff/${id}`);
  redirect(`/admin/staff/${id}?saved=1`);
}

/**
 * A staff member editing their own details.
 *
 * Runs as the account being edited, so it takes the id from the session rather
 * than the form — a posted id would let anyone edit anyone. Role, status,
 * permissions, username and salary are not readable from here at all.
 */
export async function updateMyProfileAction(formData: FormData) {
  const actor = await requireActor("/admin/profile");
  if (actor.type !== "staff") redirect("/admin/staff");

  const fullName = textField(formData, "fullName");
  if (!fullName) {
    redirect("/admin/profile?error=missing-name");
  }

  const password = textField(formData, "password");
  if (password && password.length < 6) {
    redirect("/admin/profile?error=weak-password");
  }

  try {
    await updateStaffProfile(actor.staff.id, {
      fullName,
      phone: textOrNullField(formData, "phone"),
      email: textOrNullField(formData, "email"),
      icNumber: textOrNullField(formData, "icNumber"),
      bankName: textOrNullField(formData, "bankName"),
      bankAccount: textOrNullField(formData, "bankAccount"),
    });
    if (password) {
      await setStaffPassword(actor.staff.id, hashPassword(password));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save.";
    redirect(`/admin/profile?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/profile");
  revalidatePath("/admin/staff");
  redirect("/admin/profile?saved=1");
}

/**
 * Public staff sign-up.
 *
 * Unauthenticated on purpose — the applicant has no account yet. Three things
 * keep that safe: the feature is off unless switched on, the invite code is
 * re-checked here rather than trusted from the page that rendered the form, and
 * the account is created `pending`, which cannot log in until an admin approves
 * it and chooses what type of staff they are.
 */
export async function submitStaffApplicationAction(formData: FormData) {
  if (!isStaffSelfRegistrationEnabled()) {
    redirect("/");
  }

  const code = textField(formData, "code");
  if (!isValidStaffInviteCode(code)) {
    redirect("/");
  }

  const username = textField(formData, "username").toLowerCase();
  const fullName = textField(formData, "fullName");
  const password = textField(formData, "password");
  const back = `/join?code=${encodeURIComponent(code)}`;

  if (!username || !fullName || password.length < 6) {
    redirect(`${back}&error=missing-fields`);
  }

  try {
    await createStaff({
      username,
      fullName,
      position: textOrNullField(formData, "position"),
      phone: textOrNullField(formData, "phone"),
      email: textOrNullField(formData, "email"),
      icNumber: textOrNullField(formData, "icNumber"),
      bankName: textOrNullField(formData, "bankName"),
      bankAccount: textOrNullField(formData, "bankAccount"),
      joinDate: null,
      baseSalary: null,
      // No pages and no access until an admin decides. An applicant never
      // chooses their own role.
      permissions: [],
      role: DEFAULT_ROLE,
      status: "pending",
      shopLocation: null,
      isActive: false,
      passwordHash: hashPassword(password),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to apply.";
    redirect(`${back}&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/staff");
  redirect(`${back}&submitted=1`);
}

/**
 * Approve, suspend or re-suspend an account.
 *
 * Deliberately separate from updateStaffAction: granting someone access and
 * correcting their bank details are different decisions, and an admin editing
 * a phone number should not be able to hand out access by accident.
 */
export async function setStaffStatusAction(formData: FormData) {
  const actor = await requireAdminActor("/admin/staff");

  const id = textField(formData, "id");
  const next = textField(formData, "status");

  if (!id || !isStaffStatus(next)) {
    redirect("/admin/staff?error=missing-staff");
  }

  try {
    await setStaffStatus(id, next as StaffStatus, actor.type === "admin" ? actor.name : "admin");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update account status.";
    redirect(`/admin/staff?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/staff");
  revalidatePath(`/admin/staff/${id}`);
  redirect(`/admin/staff?status=${next}`);
}

export async function createPayslipAction(formData: FormData) {
  await requireAdminActor("/admin/staff");

  const staffId = textField(formData, "staffId");
  if (!staffId) redirect("/admin/staff?error=missing-staff");

  const staff = await getStaffById(staffId);
  if (!staff) redirect("/admin/staff?error=missing-staff");

  const periodMonth = Math.min(
    12,
    Math.max(1, Math.round(numberField(formData, "periodMonth"))),
  );
  const periodYear = Math.round(numberField(formData, "periodYear"));
  if (!periodYear || periodYear < 2000) {
    redirect(`/admin/staff/${staffId}?error=bad-period`);
  }

  const result = calcPayroll({
    basic: numberField(formData, "basic"),
    allowances: numberField(formData, "allowances"),
    pcb: numberField(formData, "pcb"),
    otherDeductions: numberField(formData, "otherDeductions"),
  });

  let payslipId = "";
  try {
    const payslip = await upsertPayslip({
      staffId,
      periodMonth,
      periodYear,
      basic: result.basic,
      allowances: result.allowances,
      epfEmployee: result.epfEmployee,
      epfEmployer: result.epfEmployer,
      socsoEmployee: result.socsoEmployee,
      eisEmployee: result.eisEmployee,
      pcb: result.pcb,
      otherDeductions: result.otherDeductions,
      gross: result.gross,
      net: result.net,
      notes: textOrNullField(formData, "notes"),
      issued: textField(formData, "issued") === "true",
    });
    payslipId = payslip.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save payslip.";
    redirect(`/admin/staff/${staffId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/admin/staff/${staffId}`);
  redirect(`/admin/payslips/${payslipId}`);
}

export async function generateReviewCreateMetaAdAction(formData: FormData) {
  await requirePermission("social", "/admin/social");

  const productSlug =
    typeof formData.get("productSlug") === "string"
      ? String(formData.get("productSlug")).trim()
      : undefined;

  let campaign: Awaited<ReturnType<typeof generateSingleSocialAd>>["campaign"];
  let drafts: Awaited<ReturnType<typeof generateSingleSocialAd>>["drafts"];

  try {
    const generated = await generateSingleSocialAd({
      productSlug,
      platform: "instagram",
    });
    campaign = generated.campaign;
    drafts = generated.drafts;
  } catch (error) {
    redirect(
      `/admin/social?error=${encodeURIComponent(
        error instanceof Error ? error.message : "AI ad generation failed.",
      )}`,
    );
  }

  const draft = drafts[0];

  if (draft.reviewerFlags.length > 0) {
    await saveSocialCampaignWithDrafts(campaign, [
      {
        ...draft,
        status: "failed",
        approvalNotes: `Review blocked ad creation: ${draft.reviewerFlags.join(" ")}`,
      },
    ]);
    revalidatePath("/admin/social");
    redirect("/admin/social?error=review-blocked");
  }

  try {
    const result = await createPausedMetaAdFromDraft(draft);
    await saveSocialCampaignWithDrafts(campaign, [
      {
        ...draft,
        platform: "facebook",
        status: "scheduled",
        externalPostId: result.adId,
        publishedUrl: result.adsManagerUrl,
        approvalNotes:
          "Generated, reviewed, and created as a paused Meta ad for Facebook and Instagram placements. It will not spend until activated in Ads Manager.",
        modelOutput: {
          ...(draft.modelOutput ?? {}),
          metaAdResult: result.raw,
          metaAdIds: {
            campaignId: result.campaignId,
            adSetId: result.adSetId,
            creativeId: result.creativeId,
            adId: result.adId,
          },
          productUrl: result.productUrl,
        },
      },
    ]);
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Unable to create Meta ad.";
    const metaError = isMetaAccessTokenExpiredOrInvalid(msg)
      ? "meta-token-expired"
      : isMetaAdBillingMissing(msg)
        ? "meta-billing-missing"
        : "meta-ad-failed";

    await saveSocialCampaignWithDrafts(campaign, [
      {
        ...draft,
        platform: "facebook",
        status: "failed",
        approvalNotes: msg,
      },
    ]);
    revalidatePath("/admin/social");
    redirect(`/admin/social?error=${metaError}`);
  }

  revalidatePath("/admin/social");
  redirect("/admin/social?adCreated=1");
}

export async function updateSocialDraftStatusAction(formData: FormData) {
  await requirePermission("social", "/admin/social");

  const draftId =
    typeof formData.get("draftId") === "string" ? String(formData.get("draftId")) : "";
  const status = parseSocialPostStatus(formData.get("status"));
  const approvalNotes =
    typeof formData.get("approvalNotes") === "string"
      ? String(formData.get("approvalNotes")).trim() || null
      : null;

  if (!draftId) {
    redirect("/admin/social?error=missing-draft");
  }

  const draft = await getSocialDraftById(draftId);
  if (!draft) {
    redirect("/admin/social?error=missing-draft");
  }

  if (status === "approved" && draft.reviewerFlags.length > 0) {
    redirect("/admin/social?error=flags-block-approval");
  }

  await updateSocialDraft(draftId, {
    status,
    approvalNotes,
    manualPostedAt: status === "manual_posted" ? new Date().toISOString() : null,
  });
  revalidatePath("/admin/social");
  redirect("/admin/social?saved=1");
}

export async function regenerateSocialDraftAction(formData: FormData) {
  await requirePermission("social", "/admin/social");

  const draftId =
    typeof formData.get("draftId") === "string" ? String(formData.get("draftId")) : "";

  if (!draftId) {
    redirect("/admin/social?error=missing-draft");
  }

  const draft = await getSocialDraftById(draftId);
  if (!draft) {
    redirect("/admin/social?error=missing-draft");
  }

  const regenerated = await regenerateSocialDraftVariant(draft);
  await updateSocialDraft(draftId, regenerated);
  revalidatePath("/admin/social");
  redirect("/admin/social?regenerated=1");
}

export async function publishSocialDraftToMetaAction(formData: FormData) {
  await requirePermission("social", "/admin/social");

  const draftId =
    typeof formData.get("draftId") === "string" ? String(formData.get("draftId")) : "";

  if (!draftId) {
    redirect("/admin/social?error=missing-draft");
  }

  const draft = await getSocialDraftById(draftId);
  if (!draft) {
    redirect("/admin/social?error=missing-draft");
  }

  if (draft.platform !== "facebook" && draft.platform !== "instagram") {
    redirect("/admin/social?error=unsupported-platform");
  }

  if (draft.status !== "approved" && draft.status !== "scheduled") {
    redirect("/admin/social?error=publish-needs-approval");
  }

  if (draft.reviewerFlags.length > 0) {
    redirect("/admin/social?error=flags-block-publish");
  }

  try {
    const result = await publishSocialDraftToMeta(draft);
    await updateSocialDraft(draftId, {
      status: "published",
      externalPostId: result.externalPostId,
      publishedUrl: result.publishedUrl,
      approvalNotes: `Published to ${result.platform} via Meta Graph API.`,
      modelOutput: {
        ...(draft.modelOutput ?? {}),
        metaPublishResult: result.raw,
      },
    });
  } catch (error) {
    await updateSocialDraft(draftId, {
      status: "failed",
      approvalNotes:
        error instanceof Error ? error.message : "Unable to publish to Meta.",
    });
    revalidatePath("/admin/social");
    redirect("/admin/social?error=meta-publish-failed");
  }

  revalidatePath("/admin/social");
  redirect("/admin/social?published=1");
}
