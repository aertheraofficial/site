import "server-only";

import { getSocialBrandContext } from "@/lib/social/brand";
import type { CaptionLanguage, CaptionTone } from "@/lib/social/caption-options";
import { kimiJson } from "@/lib/social/kimi";
import type { StudioPlatform } from "@/lib/social/studio-posts";

/**
 * Caption writing for organic posts, ported from the medsoc `CaptionService`.
 *
 * Two changes from the original. It runs on Kimi rather than Gemini, and it is
 * given the Aerthera brand context, so a caption comes back sounding like the
 * shop instead of like generic social filler.
 */

/** House rules per network, carried over from the medsoc service. */
const PLATFORM_GUIDES: Record<StudioPlatform, string> = {
  instagram:
    "Emojis are fine. Use line breaks. End with 3-5 relevant hashtags. Visual and engaging. Under 2200 characters.",
  facebook:
    "Conversational and a little more detailed. One clear call to action. No hashtag spam. Under 500 characters.",
  tiktok:
    "Short and punchy. Hook in the first line. 3-5 hashtags including trending ones. Under 150 characters.",
  threads:
    "Conversational and authentic, longer than a tweet. Hashtags are not needed. Under 500 characters.",
};

export type CaptionRequest = {
  topic: string;
  platform: StudioPlatform;
  niche?: string | null;
  tone?: CaptionTone;
  language?: CaptionLanguage;
};

export type CaptionResult = {
  caption: string;
  hashtags: string[];
};

type RawCaption = {
  caption?: unknown;
  hashtags?: unknown;
};

function normalizeHashtag(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/^#/, "").replace(/[^a-zA-Z0-9_]/g, "").trim();
  return cleaned ? `#${cleaned}` : null;
}

export async function generateCaption({
  topic,
  platform,
  niche,
  tone = "casual",
  language = "English",
}: CaptionRequest): Promise<CaptionResult> {
  const brand = getSocialBrandContext();

  // The guardrails matter as much as the copy: this shop sells skincare and
  // wellness products, where a stray medical claim is a regulatory problem, not
  // just an off-brand sentence.
  const system = [
    "You are a social media copywriter for Aerthera, a Malaysian wellness and home fragrance brand.",
    brand.prohibitedClaims.length > 0
      ? `Never claim or imply any of the following: ${brand.prohibitedClaims.join("; ")}.`
      : "",
    "Never invent prices, ingredients, certifications or medical benefits.",
  ]
    .filter(Boolean)
    .join(" ");

  const prompt = `Write one ${tone} caption for ${platform}, in ${language}.

Topic: ${topic}
Niche: ${niche || "general"}
Platform rules: ${PLATFORM_GUIDES[platform]}

Reply with a JSON object with exactly these fields:
{
  "caption": "the caption text, without the hashtags",
  "hashtags": ["#example", "#tags"]
}`;

  const raw = await kimiJson<RawCaption>({ system, prompt });

  const caption = typeof raw.caption === "string" ? raw.caption.trim() : "";
  if (!caption) {
    throw new Error("Kimi did not return a caption.");
  }

  const hashtags = Array.isArray(raw.hashtags)
    ? raw.hashtags.map(normalizeHashtag).filter((tag): tag is string => Boolean(tag))
    : [];

  return { caption, hashtags };
}
