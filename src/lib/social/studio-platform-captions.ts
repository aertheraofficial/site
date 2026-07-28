import "server-only";

import { getSocialBrandContext } from "@/lib/social/brand";
import { kimiJson } from "@/lib/social/kimi";
import {
  CAPTION_PLATFORMS,
  PLATFORM_RULES,
  type CaptionPlatform,
} from "@/lib/social/platform-rules";
import type { ProductAnalysis } from "@/lib/social/studio-scenes";

/**
 * Platform-tuned captions for a generated scene.
 *
 * Ported from the medsoc `StudioCaptionService`, which is the half of Studio the
 * first pass of this merge left behind. It runs on Kimi rather than Gemini, and
 * it is given the brand's prohibited claims so the copy cannot wander into a
 * medical promise.
 *
 * The point of feeding it both the product analysis and the scene description is
 * that the caption talks about the image that was actually made, rather than
 * being written blind from a product name.
 */

export type PlatformCaption = {
  platform: CaptionPlatform;
  caption: string;
  hashtags: string[];
  /** Why this caption suits the platform, and when to post it. */
  tips: string[];
  charCount: number;
};

type RawCaption = {
  caption?: unknown;
  hashtags?: unknown;
  tips?: unknown;
};

function normalizeHashtag(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/^#/, "").replace(/[^a-zA-Z0-9_]/g, "").trim();
  return cleaned ? `#${cleaned}` : null;
}

function asStringArray(value: unknown, limit: number): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, limit)
    : [];
}

export async function generateCaptionForPlatform({
  platform,
  analysis,
  scenePrompt,
  language = "Bahasa Malaysia",
}: {
  platform: CaptionPlatform;
  analysis: ProductAnalysis | string;
  scenePrompt: string;
  language?: string;
}): Promise<PlatformCaption> {
  const brand = getSocialBrandContext();
  const productContext =
    typeof analysis === "string" ? analysis : JSON.stringify(analysis);

  const system = [
    `You are a social media copywriter for ${brand.brandName}, a Malaysian wellness and home fragrance brand.`,
    brand.prohibitedClaims.length > 0
      ? `Never claim or imply any of the following: ${brand.prohibitedClaims.join("; ")}.`
      : "",
    "Never invent prices, ingredients, certifications or medical benefits.",
  ]
    .filter(Boolean)
    .join(" ");

  const prompt = `PRODUCT INFO:
${productContext}

IMAGE SCENE DESCRIPTION:
${scenePrompt}

${PLATFORM_RULES[platform]}

LANGUAGE: write the caption in ${language}. Hashtags in English.

Reply with a JSON object with exactly these fields:
{
  "caption": "the full caption text including emojis",
  "hashtags": ["tag1", "tag2"],
  "tips": ["why this caption works for ${platform}", "the best time to post this on ${platform}"]
}`;

  const raw = await kimiJson<RawCaption>({ system, prompt });

  const caption = typeof raw.caption === "string" ? raw.caption.trim() : "";
  if (!caption) {
    throw new Error(`Kimi did not return a ${platform} caption.`);
  }

  return {
    platform,
    caption,
    hashtags: Array.isArray(raw.hashtags)
      ? raw.hashtags.map(normalizeHashtag).filter((t): t is string => Boolean(t))
      : [],
    tips: asStringArray(raw.tips, 4),
    charCount: caption.length,
  };
}

/**
 * The same writer, driven by a written brief instead of a generated image. This
 * is the standalone caption generator from medsoc, which staff use when they
 * already have a photo of their own.
 */
export async function generateCaptionFromTopic({
  platform,
  topic,
  niche,
  tone = "casual",
  language = "Bahasa Malaysia",
}: {
  platform: CaptionPlatform;
  topic: string;
  niche?: string | null;
  tone?: string;
  language?: string;
}): Promise<PlatformCaption> {
  return generateCaptionForPlatform({
    platform,
    analysis: [
      `Topic / content idea: ${topic}`,
      niche ? `Niche: ${niche}` : "",
      `Tone: ${tone}`,
    ]
      .filter(Boolean)
      .join("\n"),
    // No image was made, so say so rather than leaving the model to invent a
    // scene it then writes a caption about.
    scenePrompt: "No generated image — write from the brief above alone.",
    language,
  });
}

type PlatformRunner = (platform: CaptionPlatform) => Promise<PlatformCaption>;

async function runAllPlatforms(run: PlatformRunner) {
  const results = await Promise.allSettled(CAPTION_PLATFORMS.map(run));

  const captions: PlatformCaption[] = [];
  const failed: Array<{ platform: CaptionPlatform; error: string }> = [];

  results.forEach((result, index) => {
    const platform = CAPTION_PLATFORMS[index];
    if (result.status === "fulfilled") {
      captions.push(result.value);
    } else {
      failed.push({
        platform,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : "Could not write this one.",
      });
    }
  });

  return { captions, failed };
}

/**
 * All four at once. Run in parallel — they are independent, and doing them in
 * sequence would leave staff waiting four times as long for the same result.
 * One platform failing must not lose the other three.
 */
export function generateCaptionsForAllPlatforms(args: {
  analysis: ProductAnalysis | string;
  scenePrompt: string;
  language?: string;
}) {
  return runAllPlatforms((platform) =>
    generateCaptionForPlatform({ ...args, platform }),
  );
}

/** All four from a written brief. */
export function generateTopicCaptionsForAllPlatforms(args: {
  topic: string;
  niche?: string | null;
  tone?: string;
  language?: string;
}) {
  return runAllPlatforms((platform) =>
    generateCaptionFromTopic({ ...args, platform }),
  );
}
