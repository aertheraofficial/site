"use server";

import { requirePermission } from "@/lib/staff-auth";
import { isKimiConfigured } from "@/lib/social/kimi";
import { isOrientation } from "@/lib/social/orientation";
import { isCaptionPlatform } from "@/lib/social/platform-rules";
import {
  generateCaptionForPlatform,
  generateCaptionsForAllPlatforms,
  type PlatformCaption,
} from "@/lib/social/studio-platform-captions";
import {
  generateProductScene,
  type ProductAnalysis,
} from "@/lib/social/studio-scenes";

/** Big enough for a phone photo, small enough not to blow the request limit. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type SceneActionResult =
  | {
      ok: true;
      analysis: ProductAnalysis;
      scenePrompt: string;
      /** data: URL, ready for <img> and for a download link. */
      imageUrl: string;
      fileName: string;
    }
  | { ok: false; error: string };

export type CaptionResult =
  | { ok: true; captions: PlatformCaption[]; failed: Array<{ platform: string; error: string }> }
  | { ok: false; error: string };

/**
 * Captions for the scene that was just generated. Takes the analysis and scene
 * description back from the client rather than re-reading the image: the work is
 * already done, and re-running the vision pass would cost a second call for the
 * same answer.
 */
export async function generateSceneCaptionsAction(input: {
  analysis: ProductAnalysis | string;
  scenePrompt: string;
  language?: string;
  /** Omit for all four platforms. */
  platform?: string;
}): Promise<CaptionResult> {
  await requirePermission("social", "/admin/social/studio");

  if (!isKimiConfigured()) {
    return { ok: false, error: "Kimi is not connected. Add MOONSHOT_API_KEY." };
  }

  const scenePrompt = input.scenePrompt?.trim();
  if (!scenePrompt) {
    return { ok: false, error: "Generate a scene first." };
  }

  const language = input.language?.trim() || "Bahasa Malaysia";

  try {
    if (input.platform !== undefined) {
      if (!isCaptionPlatform(input.platform)) {
        return { ok: false, error: "That is not a platform we write for." };
      }
      const caption = await generateCaptionForPlatform({
        platform: input.platform,
        analysis: input.analysis,
        scenePrompt,
        language,
      });
      return { ok: true, captions: [caption], failed: [] };
    }

    const { captions, failed } = await generateCaptionsForAllPlatforms({
      analysis: input.analysis,
      scenePrompt,
      language,
    });

    if (captions.length === 0) {
      return {
        ok: false,
        error: failed[0]?.error ?? "Could not write any captions.",
      };
    }

    return { ok: true, captions, failed };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not write captions.",
    };
  }
}

function slugifyForFile(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "scene"
  );
}

/**
 * Returns the scene instead of redirecting: the image is the whole point of the
 * screen, and a redirect would throw it away.
 *
 * Nothing is stored. Staff post by hand, so the hand-off is the download button
 * — adding a storage bucket to keep images nobody re-opens is cost without use.
 */
export async function generateSceneAction(
  formData: FormData,
): Promise<SceneActionResult> {
  await requirePermission("social", "/admin/social/studio");

  const file = formData.get("productImage");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a product photo first." };
  }

  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { ok: false, error: "Use a PNG, JPEG or WebP photo." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: "That photo is over 8 MB. Use a smaller one.",
    };
  }

  const orientationValue = String(formData.get("orientation") ?? "square");
  if (!isOrientation(orientationValue)) {
    return { ok: false, error: "Pick a shape for the image." };
  }

  try {
    const productImage = Buffer.from(await file.arrayBuffer());
    const { analysis, scenePrompt, image } = await generateProductScene({
      productImage,
      mimeType: file.type,
      orientation: orientationValue,
      style: String(formData.get("style") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim(),
    });

    return {
      ok: true,
      analysis,
      scenePrompt,
      imageUrl: `data:${image.mimeType};base64,${image.data}`,
      fileName: `${slugifyForFile(analysis.productName)}-${orientationValue}.${
        image.mimeType === "image/jpeg" ? "jpg" : "png"
      }`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not make the scene.",
    };
  }
}
