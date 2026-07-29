import "server-only";

import { getSocialBrandContext } from "@/lib/social/brand";
import {
  generateSceneImage,
  isGeminiImageConfigured,
  type SceneImage,
} from "@/lib/social/gemini-image";
import { isKimiConfigured, kimiChat, kimiJson } from "@/lib/social/kimi";
import { ASPECT_RATIO, type Orientation } from "@/lib/social/orientation";

/**
 * Studio: turn a plain product photo into a social-ready scene.
 *
 * Three steps, split across the two models by what each can actually do:
 *
 *   1. Read the product     — Kimi (vision in, text out)
 *   2. Art-direct the scene — Kimi (text out)
 *   3. Draw it              — Gemini (the only one that emits pixels)
 *
 * The medsoc original ran all three on Gemini. Steps 1 and 2 are pure text
 * work, so they move to Kimi.
 */

export type ProductAnalysis = {
  productName: string;
  productType: string;
  visibleText: string;
  colorScheme: string[];
  targetAudience: string;
  mood: string;
  brandAesthetic: string;
};

export type SceneResult = {
  analysis: ProductAnalysis;
  scenePrompt: string;
  image: SceneImage;
};

const FALLBACK_ANALYSIS: ProductAnalysis = {
  productName: "Product",
  productType: "",
  visibleText: "",
  colorScheme: [],
  targetAudience: "",
  mood: "professional",
  brandAesthetic: "clean",
};

export function isStudioSceneConfigured() {
  return isKimiConfigured() && isGeminiImageConfigured();
}

/** Which half is missing, so the page can say something useful. */
export function describeStudioSetup() {
  return {
    kimi: isKimiConfigured(),
    gemini: isGeminiImageConfigured(),
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

/** Step 1 — Kimi reads the photo, including the wording printed on the label. */
async function analyseProduct(
  productImage: Buffer,
  mimeType: string,
): Promise<ProductAnalysis> {
  try {
    const raw = await kimiJson<Record<string, unknown>>({
      system:
        "You are a product analyst. You read product photographs precisely and never guess at text you cannot see.",
      prompt: `Look at this product image and describe it. Read ALL text visible on the product exactly as printed.

Reply with a JSON object with exactly these fields:
{
  "productName": "...",
  "productType": "...",
  "visibleText": "every word printed on the product",
  "colorScheme": ["colour", "colour"],
  "targetAudience": "...",
  "mood": "...",
  "brandAesthetic": "..."
}`,
      image: { data: productImage, mimeType },
    });

    return {
      productName: asString(raw.productName, FALLBACK_ANALYSIS.productName),
      productType: asString(raw.productType),
      visibleText: asString(raw.visibleText),
      colorScheme: asStringArray(raw.colorScheme),
      targetAudience: asString(raw.targetAudience),
      mood: asString(raw.mood, FALLBACK_ANALYSIS.mood),
      brandAesthetic: asString(raw.brandAesthetic, FALLBACK_ANALYSIS.brandAesthetic),
    };
  } catch {
    // A shaky read should not sink the whole run — the scene prompt still works
    // from the photo itself, just with less direction.
    return FALLBACK_ANALYSIS;
  }
}

/** Step 2 — Kimi writes the art direction the image model will follow. */
async function writeScenePrompt({
  analysis,
  orientation,
  style,
  notes,
  location,
  model,
}: {
  analysis: ProductAnalysis;
  orientation: Orientation;
  style: string;
  notes: string;
  location: string;
  model: string;
}): Promise<string> {
  const brand = getSocialBrandContext();

  return kimiChat({
    system:
      "You are a product photographer and art director writing a brief for an image model.",
    prompt: `Product details: ${JSON.stringify(analysis)}
Orientation: ${orientation} (${ASPECT_RATIO[orientation]})
Style preference: ${style || "elegant, professional, minimalist"}
Setting: ${location || "choose one that suits the product"}
Model: ${model || "no people in this shot"}
Additional notes: ${notes || "none"}
Brand: ${brand.brandName}

Write one instruction for placing THIS EXACT PRODUCT, taken from the reference
image, into a photorealistic social media product photography scene.

Describe the surface, props, natural elements, lighting and atmosphere that suit
the product's colours, mood and audience.

Hard rules:
- The product keeps its exact shape, label design and printed text. Do not
  redesign, relabel, translate or re-word anything on it.
- Add realistic contact shadows and reflections that match the lighting.
- Build the scene in the setting given above.
- Surrounding props must be safe: natural elements, ingredients, flowers,
  fabric, stone, wood, marble, plants.
- If a model is described, place them BESIDE the product. They must never hold,
  touch, or reach over it, and nothing may cover the label — a hand across the
  bottle forces the label to be redrawn and the printed text comes back wrong.
  The product stays on its own surface, fully visible.
- If no model is described, include no people, faces, hands or body parts.

Under 150 words. Reply with the instruction only, no preamble.`,
  });
}

/** Steps 1-3. */
export async function generateProductScene({
  productImage,
  mimeType,
  orientation,
  style,
  notes,
  location = "",
  model = "",
}: {
  productImage: Buffer;
  mimeType: string;
  orientation: Orientation;
  style: string;
  notes: string;
  /** Written setting, from a preset or typed by hand. */
  location?: string;
  /** Written model description. Empty means no people in the shot. */
  model?: string;
}): Promise<SceneResult> {
  const analysis = await analyseProduct(productImage, mimeType);
  const scenePrompt = await writeScenePrompt({
    analysis,
    orientation,
    style,
    notes,
    location,
    model,
  });
  const image = await generateSceneImage({
    productImage,
    mimeType,
    scenePrompt,
    orientation,
  });

  return { analysis, scenePrompt, image };
}
