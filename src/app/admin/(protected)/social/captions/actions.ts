"use server";

import { requirePermission } from "@/lib/staff-auth";
import { isKimiConfigured } from "@/lib/social/kimi";
import { isCaptionPlatform } from "@/lib/social/platform-rules";
import {
  generateCaptionFromTopic,
  generateTopicCaptionsForAllPlatforms,
  type PlatformCaption,
} from "@/lib/social/studio-platform-captions";

const CAPTIONS_PATH = "/admin/social/captions";

export type TopicCaptionResult =
  | {
      ok: true;
      captions: PlatformCaption[];
      failed: Array<{ platform: string; error: string }>;
    }
  | { ok: false; error: string };

export async function generateTopicCaptionsAction(input: {
  topic: string;
  niche?: string;
  tone?: string;
  language?: string;
  /** Omit for all four platforms. */
  platform?: string;
}): Promise<TopicCaptionResult> {
  await requirePermission("social", CAPTIONS_PATH);

  if (!isKimiConfigured()) {
    return { ok: false, error: "Kimi is not connected. Add MOONSHOT_API_KEY." };
  }

  const topic = input.topic?.trim();
  if (!topic) {
    return { ok: false, error: "Describe what the post is about first." };
  }

  const args = {
    topic,
    niche: input.niche?.trim() || null,
    tone: input.tone?.trim() || "casual",
    language: input.language?.trim() || "Bahasa Malaysia",
  };

  try {
    if (input.platform !== undefined) {
      if (!isCaptionPlatform(input.platform)) {
        return { ok: false, error: "That is not a platform we write for." };
      }
      const caption = await generateCaptionFromTopic({
        ...args,
        platform: input.platform,
      });
      return { ok: true, captions: [caption], failed: [] };
    }

    const { captions, failed } = await generateTopicCaptionsForAllPlatforms(args);
    if (captions.length === 0) {
      return { ok: false, error: failed[0]?.error ?? "Could not write any captions." };
    }
    return { ok: true, captions, failed };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not write captions.",
    };
  }
}
