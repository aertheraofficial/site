"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearAdminSession,
  createAdminSession,
  isAdminConfigured,
  requireAdminSession,
  validateAdminCredentials,
} from "@/lib/admin-auth";
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
import { sendReceiptEmail } from "@/lib/receipt-email";
import { getSiteUrl } from "@/lib/store-config";
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

  if (!validateAdminCredentials(username, password)) {
    redirect(
      `/admin/login?error=invalid&next=${encodeURIComponent(nextPath)}`,
    );
  }

  await createAdminSession();
  redirect(nextPath);
}

export async function logoutAction() {
  await clearAdminSession();
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

  await requireAdminSession(`/admin/orders/${encodeURIComponent(sessionId)}`);

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
  await requireAdminSession("/admin/stock");

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
  await requireAdminSession("/admin/stock");

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
  await requireAdminSession("/admin/stock");

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
  await requireAdminSession("/admin/products/new");

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
  await requireAdminSession("/admin/products");

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
};

/** Turn a local Malaysian number into wa.me digits (0123... -> 60123...). */
function toWhatsAppDigits(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `60${digits.slice(1)}`;
  return digits.length >= 8 ? digits : null;
}

export async function recordCounterSaleAction(payload: CounterSalePayload) {
  await requireAdminSession("/admin/counter-sale");

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

  const sessionId = `INSTORE-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const now = new Date().toISOString();

  const customerName = payload.customerName.trim() || null;
  const customerPhone = payload.customerPhone.trim() || null;
  const customerEmail = payload.customerEmail.trim().toLowerCase() || null;

  // Register / reuse the walk-in member when we have something to remember them by.
  let customerId: string | null = null;
  if (customerName && (customerEmail || customerPhone)) {
    const member = await createMember({
      fullName: customerName,
      phone: customerPhone,
      email: customerEmail,
      location: payload.location,
    });
    customerId = member?.id ?? null;
  }

  const order: StoredOrder = {
      id: sessionId,
      sessionId,
      paymentIntentId: null,
      createdAt: now,
      updatedAt: now,
      recordedFrom: "admin-walk-in",
      customerId,
      customerName,
      customerEmail,
      customerPhone,
      paymentStatus: "paid",
      checkoutStatus: "complete",
      currency: "myr",
      subtotalAmount: subtotalCents,
      shippingAmount: null,
      taxAmount: null,
      totalAmount: subtotalCents,
      fulfillmentType: "in-store",
      shippingName: null,
      shippingAddress: null,
      fulfillmentStatus: "fulfilled",
      trackingNumber: null,
      trackingCarrier: null,
      trackingUrl: null,
      internalNotes: `Counter sale at ${getLocationName(payload.location)} — paid via ${payload.paymentMethod}.`,
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
  let emailedReceipt = false;
  if (customerEmail) {
    emailedReceipt = await sendReceiptEmail(order).catch(() => false);
  }

  const receiptUrl = `${getSiteUrl()}/receipt/${sessionId}`;
  const waDigits = customerPhone ? toWhatsAppDigits(customerPhone) : null;
  const whatsAppUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
        `Terima kasih! Resit pembelian anda di ${getLocationName(payload.location)}: ${receiptUrl}`,
      )}`
    : null;

  return {
    ok: true as const,
    sessionId,
    receiptUrl,
    whatsAppUrl,
    emailedReceipt,
  };
}

export async function generateDhlShipmentBatchAction(formData: FormData) {
  const returnTo = sanitizeNextPath(formData.get("returnTo"));
  await requireAdminSession(returnTo);

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
  await requireAdminSession("/admin/social");

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
  await requireAdminSession("/admin/social");

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

export async function generateReviewCreateMetaAdAction(formData: FormData) {
  await requireAdminSession("/admin/social");

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
  await requireAdminSession("/admin/social");

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
  await requireAdminSession("/admin/social");

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
  await requireAdminSession("/admin/social");

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
