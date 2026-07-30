"use server";

import { promises as fs } from "fs";
import path from "path";
import { requirePermission } from "@/lib/staff-auth";
import { getProductBySlugWithStock } from "@/lib/product-stock";
import { isKimiConfigured } from "@/lib/social/kimi";
import { isOrientation, type Orientation } from "@/lib/social/orientation";
import { describeScene } from "@/lib/social/scene-presets";
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
      /**
       * The shape this image was actually made at. Carried back rather than read
       * from the picker: staff can change the picker after generating, and the
       * video step needs the shape of the frame it is animating, not the one
       * currently selected.
       */
      orientation: Orientation;
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
 * Fetch a catalog product's own photo.
 *
 * Static catalog images are site-relative ("/assets/..."), so they are read off
 * disk rather than fetched over HTTP — a server calling back into itself needs
 * an absolute origin it does not reliably know, and would fail on a cold start.
 * Admin-added products point at Supabase storage and are fetched.
 */
async function loadCatalogPhoto(slug: string) {
  const product = await getProductBySlugWithStock(slug);
  if (!product?.image) {
    throw new Error("That product has no photo to work from.");
  }

  if (/^https?:\/\//i.test(product.image)) {
    const response = await fetch(product.image);
    if (!response.ok) {
      throw new Error("Could not load that product's photo.");
    }
    const mimeType = response.headers.get("content-type") ?? "image/jpeg";
    return {
      productImage: Buffer.from(await response.arrayBuffer()),
      mimeType: mimeType.split(";")[0].trim(),
    };
  }

  const filePath = path.join(process.cwd(), "public", product.image.replace(/^\//, ""));
  const extension = path.extname(filePath).toLowerCase();
  return {
    productImage: await fs.readFile(filePath),
    mimeType:
      extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg",
  };
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

  // Two ways in: a slug picked from the catalog, or a file from the device.
  // The catalog is the common case — the shop already has a photo of every
  // product it sells, and re-uploading one to a tool that could just fetch it
  // is busywork.
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const file = formData.get("productImage");
  const hasUpload = file instanceof File && file.size > 0;

  if (!productSlug && !hasUpload) {
    return { ok: false, error: "Pick a product, or choose a photo from your device." };
  }

  if (hasUpload) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return { ok: false, error: "Use a PNG, JPEG or WebP photo." };
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return {
        ok: false,
        error: "That photo is over 8 MB. Use a smaller one.",
      };
    }
  }

  const orientationValue = String(formData.get("orientation") ?? "square");
  if (!isOrientation(orientationValue)) {
    return { ok: false, error: "Pick a shape for the image." };
  }

  try {
    // An upload wins when both are present: staff who just chose a file meant
    // to use it, whatever is still selected in the product list.
    const source = hasUpload
      ? {
          productImage: Buffer.from(await file.arrayBuffer()),
          mimeType: file.type,
        }
      : await loadCatalogPhoto(productSlug);

    const { location, model } = describeScene({
      locationKey: String(formData.get("locationKey") ?? ""),
      locationText: String(formData.get("locationText") ?? ""),
      modelKey: String(formData.get("modelKey") ?? ""),
      modelText: String(formData.get("modelText") ?? ""),
    });

    const { analysis, scenePrompt, image } = await generateProductScene({
      productImage: source.productImage,
      mimeType: source.mimeType,
      orientation: orientationValue,
      style: String(formData.get("style") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim(),
      location,
      model,
    });

    return {
      ok: true,
      analysis,
      scenePrompt,
      imageUrl: `data:${image.mimeType};base64,${image.data}`,
      fileName: `${slugifyForFile(analysis.productName)}-${orientationValue}.${
        image.mimeType === "image/jpeg" ? "jpg" : "png"
      }`,
      orientation: orientationValue,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not make the scene.",
    };
  }
}
