import type { SocialPlatform } from "./brand";
import type { SocialPostDraft } from "./store";

export type PlatformIntegrationStage =
  | "manual_export"
  | "ready_for_meta_setup"
  | "requires_app_review"
  | "requires_paid_api"
  | "connected";

export type PlatformIntegrationStatus = {
  platform: SocialPlatform;
  label: string;
  stage: PlatformIntegrationStage;
  canDirectPublish: boolean;
  nextStep: string;
  constraint: string;
};

const META_ACCESS_READY = Boolean(
  process.env.META_APP_ID?.trim() &&
    process.env.META_APP_SECRET?.trim() &&
    process.env.META_PAGE_ID?.trim() &&
    process.env.META_PAGE_ACCESS_TOKEN?.trim(),
);

const META_INSTAGRAM_ACCESS_READY = Boolean(
  META_ACCESS_READY && process.env.META_IG_USER_ID?.trim(),
);

const TIKTOK_ACCESS_READY = Boolean(
  process.env.TIKTOK_CLIENT_KEY?.trim() &&
    process.env.TIKTOK_CLIENT_SECRET?.trim() &&
    process.env.TIKTOK_ACCESS_TOKEN?.trim(),
);

const X_ACCESS_READY = Boolean(
  process.env.X_API_KEY?.trim() &&
    process.env.X_API_SECRET?.trim() &&
    process.env.X_ACCESS_TOKEN?.trim() &&
    process.env.X_ACCESS_TOKEN_SECRET?.trim(),
);

export function getPlatformIntegrationStatuses(): PlatformIntegrationStatus[] {
  return [
    {
      platform: "instagram",
      label: "Instagram",
      stage: META_INSTAGRAM_ACCESS_READY ? "connected" : "ready_for_meta_setup",
      canDirectPublish: META_INSTAGRAM_ACCESS_READY,
      nextStep: META_INSTAGRAM_ACCESS_READY
        ? "Test media-container creation and publish flow with an approved post."
        : "Create/connect the Meta app, Instagram Professional account, Facebook Page, and content publishing permission.",
      constraint:
        "Instagram publishing requires a Professional account linked to a Facebook Page and approved Meta permissions.",
    },
    {
      platform: "facebook",
      label: "Facebook",
      stage: META_ACCESS_READY ? "connected" : "ready_for_meta_setup",
      canDirectPublish: META_ACCESS_READY,
      nextStep: META_ACCESS_READY
        ? "Test Page publishing with a non-critical approved post."
        : "Create/connect the Meta app and Page publishing permissions.",
      constraint:
        "Facebook Page posting uses Meta Graph API permissions and long-lived Page access tokens.",
    },
    {
      platform: "tiktok",
      label: "TikTok",
      stage: TIKTOK_ACCESS_READY ? "connected" : "requires_app_review",
      canDirectPublish: TIKTOK_ACCESS_READY,
      nextStep: TIKTOK_ACCESS_READY
        ? "Test draft upload or direct post against approved TikTok scopes."
        : "Prepare TikTok developer app audit for public direct posting; keep scripts/export manual until then.",
      constraint:
        "TikTok public direct posting requires approved Content Posting API scopes and app audit.",
    },
    {
      platform: "x",
      label: "X",
      stage: X_ACCESS_READY ? "connected" : "requires_paid_api",
      canDirectPublish: X_ACCESS_READY,
      nextStep: X_ACCESS_READY
        ? "Test low-volume posting and rate-limit handling."
        : "Only connect if the paid API tier is justified by an active audience.",
      constraint:
        "X posting depends on paid/tiered API access and platform-specific rate limits.",
    },
  ];
}

export function getManualPostingChecklist(draft: SocialPostDraft) {
  return [
    `Open the ${draft.platform} brand account.`,
    `Use format: ${draft.format}.`,
    `Create or select media from the visual brief: ${draft.visualBrief}`,
    `Paste caption: ${draft.caption}`,
    `Add hashtags: ${draft.hashtags.join(" ") || "No hashtags suggested"}.`,
    draft.productUrlPath
      ? `Include product link where the platform supports links: ${draft.productUrlPath}.`
      : "No product link was attached to this draft.",
    "Publish manually, then mark the draft as manually posted in Aerthera Admin.",
  ];
}
