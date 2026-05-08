import { getSocialBrandContext, type SocialPlatform } from "./brand";
import type { SocialPostDraft } from "./store";
import { getMetaPublicSiteUrl, isPublicHttpsOrigin } from "@/lib/store-config";

type MetaGraphResponse = {
  id?: string;
  post_id?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

export type MetaPublishResult = {
  platform: Extract<SocialPlatform, "facebook" | "instagram">;
  externalPostId: string;
  publishedUrl: string;
  raw: Record<string, unknown>;
};

/** Detect expired/invalid Meta access tokens from Graph API error text. */
export function isMetaAccessTokenExpiredOrInvalid(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("session has expired") ||
    m.includes("error validating access token") ||
    m.includes("invalid oauth") ||
    m.includes("oauth exception") ||
    (m.includes("token") && m.includes("expired"))
  );
}

const GRAPH_VERSION = "v20.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function getMetaPublishBaseUrl() {
  const siteUrl = getMetaPublicSiteUrl();

  return {
    siteUrl,
    isPublic: isPublicHttpsOrigin(siteUrl),
  };
}

function absoluteSiteUrl(pathname: string | null) {
  if (!pathname) {
    return null;
  }

  return new URL(pathname, getMetaPublicSiteUrl()).toString();
}

function getDraftImageUrl(draft: SocialPostDraft) {
  const primaryProductSlug = draft.productSlugs[0];
  const product = getSocialBrandContext().productFacts.find(
    (entry) => entry.slug === primaryProductSlug,
  );

  if (!product) {
    return null;
  }

  const instagramPublishImagePath = `/assets/products/social/${product.slug}.jpg`;
  return new URL(instagramPublishImagePath, getMetaPublicSiteUrl()).toString();
}

function buildCaption(draft: SocialPostDraft) {
  return [draft.caption, draft.hashtags.join(" ")].filter(Boolean).join("\n\n");
}

async function callMetaGraph(
  path: string,
  params: Record<string, string>,
): Promise<MetaGraphResponse> {
  const response = await fetch(`${GRAPH_BASE_URL}/${path.replace(/^\//, "")}`, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  const data = (await response.json()) as MetaGraphResponse;

  if (!response.ok || data.error) {
    const message = data.error?.message ?? response.statusText;
    throw new Error(`Meta API error: ${message}`);
  }

  return data;
}

async function getMetaGraph(
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = new URL(`${GRAPH_BASE_URL}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  const data = (await response.json()) as MetaGraphResponse & Record<string, unknown>;

  if (!response.ok || data.error) {
    const message = data.error?.message ?? response.statusText;
    throw new Error(`Meta API error: ${message}`);
  }

  return data;
}

export function isMetaPublishingConfigured(platform: SocialPlatform) {
  if (platform === "facebook") {
    return Boolean(
      process.env.META_PAGE_ID?.trim() &&
        process.env.META_PAGE_ACCESS_TOKEN?.trim(),
    );
  }

  if (platform === "instagram") {
    return Boolean(
      process.env.META_IG_USER_ID?.trim() &&
        process.env.META_PAGE_ACCESS_TOKEN?.trim(),
    );
  }

  return false;
}

export async function publishSocialDraftToMeta(
  draft: SocialPostDraft,
): Promise<MetaPublishResult> {
  if (draft.platform === "facebook") {
    return publishFacebookDraft(draft);
  }

  if (draft.platform === "instagram") {
    return publishInstagramDraft(draft);
  }

  throw new Error(`Meta publishing is not available for ${draft.platform}.`);
}

async function publishFacebookDraft(
  draft: SocialPostDraft,
): Promise<MetaPublishResult> {
  const pageId = requireEnv("META_PAGE_ID");
  const accessToken = requireEnv("META_PAGE_ACCESS_TOKEN");
  const productUrl = absoluteSiteUrl(draft.productUrlPath);
  const data = await callMetaGraph(`/${pageId}/feed`, {
    access_token: accessToken,
    message: buildCaption(draft),
    ...(productUrl ? { link: productUrl } : {}),
  });
  const externalPostId = data.post_id ?? data.id;

  if (!externalPostId) {
    throw new Error("Meta did not return a Facebook post id.");
  }

  return {
    platform: "facebook",
    externalPostId,
    publishedUrl: `https://www.facebook.com/${externalPostId}`,
    raw: data as Record<string, unknown>,
  };
}

async function publishInstagramDraft(
  draft: SocialPostDraft,
): Promise<MetaPublishResult> {
  const { isPublic } = getMetaPublishBaseUrl();

  if (!isPublic) {
    throw new Error(
      "Instagram needs a public HTTPS URL for product images. Set NEXT_PUBLIC_SITE_URL to your live site, or set META_PUBLIC_SITE_URL (https://…) while developing locally.",
    );
  }

  const igUserId = requireEnv("META_IG_USER_ID");
  const accessToken = requireEnv("META_PAGE_ACCESS_TOKEN");
  const imageUrl = getDraftImageUrl(draft);

  if (!imageUrl) {
    throw new Error("No catalog product image is available for this Instagram draft.");
  }

  const container = await callMetaGraph(`/${igUserId}/media`, {
    access_token: accessToken,
    image_url: imageUrl,
    caption: buildCaption(draft),
  });

  if (!container.id) {
    throw new Error("Meta did not return an Instagram media container id.");
  }

  const published = await callMetaGraph(`/${igUserId}/media_publish`, {
    access_token: accessToken,
    creation_id: container.id,
  });

  if (!published.id) {
    throw new Error("Meta did not return an Instagram media id.");
  }

  const permalinkData = await getMetaGraph(`/${published.id}`, {
    access_token: accessToken,
    fields: "permalink",
  }).catch(() => null);
  const permalink =
    typeof permalinkData?.permalink === "string"
      ? permalinkData.permalink
      : `https://www.instagram.com/aerthera.official/`;

  return {
    platform: "instagram",
    externalPostId: published.id,
    publishedUrl: permalink,
    raw: {
      container,
      published,
      permalink: permalinkData,
    },
  };
}
