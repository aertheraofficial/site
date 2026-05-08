import { promises as fs } from "fs";
import path from "path";
import { getSocialBrandContext } from "@/lib/social/brand";
import { getMetaPublicSiteUrl } from "@/lib/store-config";
import type { SocialPostDraft } from "./store";

type MetaAdsResponse = {
  id?: string;
  account_status?: number;
  currency?: string;
  disable_reason?: number;
  funding_source?: string;
  funding_source_details?: unknown;
  images?: Record<string, { hash?: string; url?: string }>;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_data?: unknown;
    error_user_msg?: string;
    error_user_title?: string;
    fbtrace_id?: string;
  };
};

export type MetaAdCreationResult = {
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
  adsManagerUrl: string;
  productUrl: string;
  raw: Record<string, unknown>;
};

const GRAPH_VERSION = "v25.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function getAdAccessToken() {
  return (
    process.env.META_AD_ACCESS_TOKEN?.trim() ||
    process.env.META_USER_ACCESS_TOKEN?.trim() ||
    requireEnv("META_PAGE_ACCESS_TOKEN")
  );
}

function getAdAccountId() {
  const raw = requireEnv("META_AD_ACCOUNT_ID");
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

function getDailyBudgetMinor() {
  const raw = process.env.META_AD_DAILY_BUDGET_MINOR?.trim() || "1000";
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed < 100) {
    throw new Error("META_AD_DAILY_BUDGET_MINOR must be at least 100.");
  }

  return String(parsed);
}

function getTargetCountries() {
  const countries = (process.env.META_AD_COUNTRIES?.trim() || "MY")
    .split(",")
    .map((country) => country.trim().toUpperCase())
    .filter(Boolean);

  return countries.length > 0 ? countries : ["MY"];
}

function getProductForDraft(draft: SocialPostDraft) {
  const primaryProductSlug = draft.productSlugs[0];
  const product = getSocialBrandContext().productFacts.find(
    (entry) => entry.slug === primaryProductSlug,
  );

  if (!product) {
    throw new Error("No catalog product is available for this Meta ad draft.");
  }

  return product;
}

function getProductUrl(draft: SocialPostDraft) {
  const product = getProductForDraft(draft);
  return new URL(product.urlPath, getMetaPublicSiteUrl()).toString();
}

function getProductSocialImagePath(draft: SocialPostDraft) {
  const product = getProductForDraft(draft);
  return path.join(
    process.cwd(),
    "public",
    "assets",
    "products",
    "social",
    `${product.slug}.jpg`,
  );
}

function buildCaption(draft: SocialPostDraft) {
  const productUrl = getProductUrl(draft);
  const caption = [draft.caption, `Shop now: ${productUrl}`]
    .filter(Boolean)
    .join("\n\n");

  return [caption, draft.hashtags.join(" ")].filter(Boolean).join("\n\n");
}

async function callMetaAds(
  pathValue: string,
  params: Record<string, string>,
): Promise<MetaAdsResponse> {
  const response = await fetch(`${GRAPH_BASE_URL}/${pathValue.replace(/^\//, "")}`, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  const data = (await response.json()) as MetaAdsResponse;

  if (!response.ok || data.error) {
    const message = formatMetaAdsError(pathValue, data, response.statusText);
    throw new Error(message);
  }

  return data;
}

async function readMetaAds(
  pathValue: string,
  params: Record<string, string>,
): Promise<MetaAdsResponse> {
  const url = new URL(`${GRAPH_BASE_URL}/${pathValue.replace(/^\//, "")}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  const data = (await response.json()) as MetaAdsResponse;

  if (!response.ok || data.error) {
    const message = formatMetaAdsError(pathValue, data, response.statusText);
    throw new Error(message);
  }

  return data;
}

async function uploadAdImage(adAccountId: string, accessToken: string, draft: SocialPostDraft) {
  const imagePath = getProductSocialImagePath(draft);
  const imageBytes = await fs.readFile(imagePath);
  const formData = new FormData();

  formData.set("access_token", accessToken);
  formData.set(
    "filename",
    new Blob([imageBytes], { type: "image/jpeg" }),
    path.basename(imagePath),
  );

  const response = await fetch(`${GRAPH_BASE_URL}/${adAccountId}/adimages`, {
    method: "POST",
    body: formData,
  });
  const data = (await response.json()) as MetaAdsResponse;

  if (!response.ok || data.error) {
    const message = formatMetaAdsError(`/${adAccountId}/adimages`, data, response.statusText);
    throw new Error(message);
  }

  const image = Object.values(data.images ?? {})[0];
  if (!image?.hash) {
    throw new Error("Meta Ads API did not return an image hash.");
  }

  return {
    hash: image.hash,
    raw: data as Record<string, unknown>,
  };
}

function formatMetaAdsError(
  pathValue: string,
  data: MetaAdsResponse,
  fallback: string,
) {
  const error = data.error;

  if (!error) {
    return `Meta Ads API error at ${pathValue}: ${fallback}`;
  }

  const details = [
    error.message,
    error.error_user_title,
    error.error_user_msg,
    typeof error.code === "number" ? `code ${error.code}` : null,
    typeof error.error_subcode === "number"
      ? `subcode ${error.error_subcode}`
      : null,
    error.fbtrace_id ? `trace ${error.fbtrace_id}` : null,
    error.error_data ? `data ${JSON.stringify(error.error_data)}` : null,
  ].filter(Boolean);

  return `Meta Ads API error at ${pathValue}: ${details.join(" | ") || fallback}`;
}

async function assertAdAccountCanCreateAds(adAccountId: string, accessToken: string) {
  const adAccount = await readMetaAds(`/${adAccountId}`, {
    access_token: accessToken,
    fields:
      "id,account_status,currency,disable_reason,funding_source,funding_source_details",
  });

  if (adAccount.account_status !== 1) {
    throw new Error(
      `Meta ad account ${adAccountId} is not active. Current account_status is ${adAccount.account_status ?? "unknown"}.`,
    );
  }

  if (!adAccount.funding_source && !adAccount.funding_source_details) {
    throw new Error(
      `Meta ad account ${adAccountId} has no payment method. Add a valid payment method in Meta Billing and Payment Center for this ad account, then try again.`,
    );
  }
}

export function isMetaAdBillingMissing(message: string) {
  return /no payment method|payment method|funding source/i.test(message);
}

function buildAdName(draft: SocialPostDraft) {
  const product = getProductForDraft(draft);
  const date = new Date().toISOString().slice(0, 10);
  return `Aerthera ${product.shortName} Traffic Test ${date}`;
}

function getAdSchedule() {
  const start = new Date(Date.now() + 15 * 60 * 1000);
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

export function isMetaAdsConfigured() {
  return Boolean(
    process.env.META_AD_ACCOUNT_ID?.trim() &&
      (process.env.META_AD_ACCESS_TOKEN?.trim() ||
        process.env.META_USER_ACCESS_TOKEN?.trim()) &&
      process.env.META_PAGE_ID?.trim() &&
      process.env.META_IG_USER_ID?.trim(),
  );
}

export async function createPausedMetaAdFromDraft(
  draft: SocialPostDraft,
): Promise<MetaAdCreationResult> {
  const adAccountId = getAdAccountId();
  const accessToken = getAdAccessToken();
  const pageId = requireEnv("META_PAGE_ID");
  const instagramUserId = requireEnv("META_IG_USER_ID");
  const product = getProductForDraft(draft);
  const productUrl = getProductUrl(draft);
  const adName = buildAdName(draft);
  const { startTime, endTime } = getAdSchedule();

  await assertAdAccountCanCreateAds(adAccountId, accessToken);

  const uploadedImage = await uploadAdImage(adAccountId, accessToken, draft);

  const campaign = await callMetaAds(`/${adAccountId}/campaigns`, {
    access_token: accessToken,
    name: `${adName} Campaign`,
    objective: "OUTCOME_TRAFFIC",
    is_adset_budget_sharing_enabled: "false",
    status: "PAUSED",
    special_ad_categories: "[]",
  });
  if (!campaign.id) {
    throw new Error("Meta Ads API did not return a campaign id.");
  }

  const adSet = await callMetaAds(`/${adAccountId}/adsets`, {
    access_token: accessToken,
    name: `${adName} Ad Set`,
    campaign_id: campaign.id,
    daily_budget: getDailyBudgetMinor(),
    billing_event: "IMPRESSIONS",
    optimization_goal: "LINK_CLICKS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    start_time: startTime,
    end_time: endTime,
    targeting: JSON.stringify({
      age_min: 21,
      geo_locations: {
        countries: getTargetCountries(),
      },
      publisher_platforms: ["facebook", "instagram"],
      facebook_positions: ["feed"],
      instagram_positions: ["stream", "explore"],
      device_platforms: ["mobile", "desktop"],
    }),
    status: "PAUSED",
  });
  if (!adSet.id) {
    throw new Error("Meta Ads API did not return an ad set id.");
  }

  const creative = await callMetaAds(`/${adAccountId}/adcreatives`, {
    access_token: accessToken,
    name: `${adName} Creative`,
    object_story_spec: JSON.stringify({
      page_id: pageId,
      instagram_user_id: instagramUserId,
      link_data: {
        image_hash: uploadedImage.hash,
        link: productUrl,
        message: buildCaption(draft),
        name: product.name,
        description: product.availability,
        call_to_action: {
          type: "SHOP_NOW",
          value: {
            link: productUrl,
          },
        },
      },
    }),
  });
  if (!creative.id) {
    throw new Error("Meta Ads API did not return an ad creative id.");
  }

  const ad = await callMetaAds(`/${adAccountId}/ads`, {
    access_token: accessToken,
    name: `${adName} Ad`,
    adset_id: adSet.id,
    creative: JSON.stringify({
      creative_id: creative.id,
    }),
    status: "PAUSED",
  });
  if (!ad.id) {
    throw new Error("Meta Ads API did not return an ad id.");
  }

  const adsManagerUrl = `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${adAccountId.replace(/^act_/, "")}`;

  return {
    campaignId: campaign.id,
    adSetId: adSet.id,
    creativeId: creative.id,
    adId: ad.id,
    adsManagerUrl,
    productUrl,
    raw: {
      image: uploadedImage.raw,
      campaign,
      adSet,
      creative,
      ad,
    },
  };
}
