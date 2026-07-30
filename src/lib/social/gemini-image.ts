import "server-only";

import { ASPECT_RATIO, type Orientation } from "@/lib/social/orientation";

/**
 * Gemini — the only part of the pipeline that produces pixels.
 *
 * Kimi writes every word in the Social tab, but no Kimi model emits an image,
 * so compositing a product into a scene lives here.
 *
 * Built against the current Interactions API, not the `generateContent` call
 * the old medsoc service used: that code targeted `gemini-2.5-flash-image` with
 * `responseModalities` and an `imageConfig` block, which is a different request
 * shape from what the API takes now. Porting it verbatim would have failed at
 * runtime.
 */

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

/** Flash tier: fast and cheap enough to regenerate a scene a few times. */
const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image";

/** Image work is slow; well past a normal request but short of hanging. */
const GEMINI_TIMEOUT_MS = 120_000;

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || "";
}

export function isGeminiImageConfigured() {
  return Boolean(getGeminiApiKey());
}

export function getGeminiImageModel() {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
}

export class GeminiImageError extends Error {}

type InteractionResponse = {
  output_image?: { data?: string; mime_type?: string };
  steps?: Array<{
    type?: string;
    /** Present on reasoning steps. Base64, but not an image — see below. */
    signature?: string;
    content?: Array<{
      type?: string;
      data?: string;
      mime_type?: string;
    }>;
  }>;
  error?: { message?: string };
};

/**
 * Pull the image out of a response.
 *
 * `output_image` is what the docs describe, but what actually comes back from
 * gemini-3.1-flash-image is a `steps` array: a `thought` step, then a
 * `model_output` step whose `content` holds the image block.
 *
 * The `type === "image"` check is load-bearing. The thought step carries a
 * `signature` field over a megabyte of base64 — grabbing the first base64-looking
 * value would hand back reasoning state as if it were a JPEG.
 */
function extractImage(payload: InteractionResponse) {
  if (payload.output_image?.data) {
    return {
      data: payload.output_image.data,
      mimeType: payload.output_image.mime_type ?? "image/png",
    };
  }

  for (const step of payload.steps ?? []) {
    for (const block of step.content ?? []) {
      if (block?.type === "image" && block.data) {
        return { data: block.data, mimeType: block.mime_type ?? "image/png" };
      }
    }
  }

  return null;
}

export type SceneImage = {
  /** base64, ready for a data: URL or a Buffer. */
  data: string;
  mimeType: string;
};

/**
 * Place a real product photo into a described scene.
 *
 * The source image is sent alongside the prompt so the model composites rather
 * than invents — the product's label and wording have to survive untouched, or
 * the shop is advertising a bottle it does not sell.
 */
export async function generateSceneImage({
  productImage,
  mimeType,
  scenePrompt,
  orientation,
  reference,
}: {
  productImage: Buffer;
  mimeType: string;
  scenePrompt: string;
  orientation: Orientation;
  /**
   * A second image to match, used when this shot belongs to a sequence.
   *
   * Shots generated independently come back with different people in them — a
   * man's hands opening the jar, a woman's finger in the next shot. Words alone
   * cannot hold a person steady across separate generations; an earlier frame
   * from the same sequence can.
   */
  reference?: { data: Buffer; mimeType: string };
}): Promise<SceneImage> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new GeminiImageError("Gemini API key is not set.");
  }

  let response: Response;
  try {
    response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Header rather than ?key= so the secret stays out of URLs and logs.
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: getGeminiImageModel(),
        input: [
          { type: "text", text: scenePrompt },
          {
            type: "image",
            mime_type: mimeType,
            data: productImage.toString("base64"),
          },
          // Order matters: the product stays first so it reads as the thing being
          // placed, and the reference second as something to match.
          ...(reference
            ? [
                {
                  type: "image",
                  mime_type: reference.mimeType,
                  data: reference.data.toString("base64"),
                },
              ]
            : []),
        ],
        response_format: {
          type: "image",
          aspect_ratio: ASPECT_RATIO[orientation],
        },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
  } catch (error) {
    throw new GeminiImageError(
      error instanceof Error && error.name === "TimeoutError"
        ? "Gemini took too long to draw the scene. Try again."
        : "Could not reach Gemini.",
    );
  }

  const payload = (await response
    .json()
    .catch(() => null)) as InteractionResponse | null;

  if (!response.ok) {
    // A wrong model id is the likeliest failure here, and Gemini says so in the
    // body — worth surfacing verbatim so it is a config fix, not a mystery.
    throw new GeminiImageError(
      payload?.error?.message ??
        `Gemini rejected the request (${response.status}). Check GEMINI_IMAGE_MODEL.`,
    );
  }

  const image = payload ? extractImage(payload) : null;
  if (!image) {
    // Safety filters return a normal 200 with no image attached.
    throw new GeminiImageError(
      "Gemini did not return an image. It may have refused the scene — try different wording.",
    );
  }

  return image;
}
