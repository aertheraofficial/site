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
import {
  type FulfillmentStatus,
  getOrdersBySessionIds,
  updateOrderManagement,
} from "@/lib/orders";
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
