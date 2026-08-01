import "server-only";

import type { Orientation } from "@/lib/social/orientation";
import { VIDEO_ASPECT_RATIO, type VideoDuration } from "@/lib/social/video-options";

/**
 * Veo — the second half of the pixel pipeline: a still scene, set moving.
 *
 * Different API surface from `gemini-image`, not a variation on it. Image
 * generation is one request that returns the picture; video is a long-running
 * operation — `:predictLongRunning` hands back an operation name, and the bytes
 * only exist a minute or two later behind a separate download URI. Nothing here
 * can be folded into a single call, which is why the caller polls.
 *
 * Built against the Veo REST docs at ai.google.dev/gemini-api/docs/veo. Note it
 * takes the older `instances`/`parameters` predict shape, not the Interactions
 * body the image model uses.
 */

const GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Cheapest tier, and now the only one that runs without a second key turned.
 *
 * The full model does follow a brief better — measured on the same still,
 * `veo-3.1-fast-generate-preview` let the subject turn to the lens and smile
 * halfway through a brief that held her gaze away, while the full one held it.
 * That is why the default was raised to the full model for an afternoon of
 * iteration on 2026-07-29, and it is the most expensive mistake this file has
 * caused: sixteen times the Lite price, about RM 13 a clip, for roughly four
 * hours of exploratory renders whose only question was whether a composition
 * worked. Around RM 95 of a RM 100 balance went that way, and the owner found out
 * from the bill.
 *
 * So the tier is no longer a default that a later edit can quietly raise. Lite
 * is what runs. Anything dearer needs GEMINI_VIDEO_ALLOW_PAID_TIER=true set
 * alongside GEMINI_VIDEO_MODEL, which is a deliberate act by whoever is paying —
 * per posted clip, not per experiment.
 */
const DEFAULT_VIDEO_MODEL = "veo-3.1-lite-generate-preview";

/** Roughly what each tier costs for one 8-second clip, for the log line below. */
const TIER_RINGGIT: Record<string, string> = {
  "veo-3.1-lite-generate-preview": "RM 2",
  "veo-3.1-fast-generate-preview": "RM 4",
  "veo-3.1-generate-preview": "RM 13",
};

/**
 * 720p unless someone asks otherwise, because it is the cheapest thing Veo will
 * render and the shot either suits the product or it does not — that reads the
 * same at either size.
 *
 * The override is guarded rather than passed straight through: Veo refuses the
 * full frame on short clips ("1080p is not supported for a duration of 4
 * seconds"), so asking for 1080p on a 4 or 6 second clip quietly gets 720p
 * instead of failing at the API.
 */
function resolutionFor(durationSeconds: VideoDuration) {
  const wanted = process.env.GEMINI_VIDEO_RESOLUTION?.trim();
  const allowed = process.env.GEMINI_VIDEO_ALLOW_PAID_TIER?.trim() === "true";
  if (allowed && wanted && wanted !== "720p" && durationSeconds === "8") {
    return wanted;
  }
  return "720p";
}

/** Starting the job is quick — it returns before any frame is rendered. */
const START_TIMEOUT_MS = 60_000;

const POLL_TIMEOUT_MS = 20_000;

/** The finished file is tens of megabytes and comes from a different host. */
const DOWNLOAD_TIMEOUT_MS = 120_000;

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || "";
}

export function isGeminiVideoConfigured() {
  return Boolean(getGeminiApiKey());
}

export function getGeminiVideoModel() {
  const asked = process.env.GEMINI_VIDEO_MODEL?.trim();
  if (!asked || asked === DEFAULT_VIDEO_MODEL) return DEFAULT_VIDEO_MODEL;

  // Ignored rather than obeyed, and said out loud. A silent downgrade would have
  // someone believe they were rendering a final take at full quality.
  if (process.env.GEMINI_VIDEO_ALLOW_PAID_TIER?.trim() !== "true") {
    console.warn(
      `GEMINI_VIDEO_MODEL is set to ${asked} (about ${
        TIER_RINGGIT[asked] ?? "much more"
      } per 8s clip) but GEMINI_VIDEO_ALLOW_PAID_TIER is not "true". Rendering on ${DEFAULT_VIDEO_MODEL} instead, about ${
        TIER_RINGGIT[DEFAULT_VIDEO_MODEL]
      }.`,
    );
    return DEFAULT_VIDEO_MODEL;
  }

  return asked;
}

export class GeminiVideoError extends Error {}

/**
 * Operation names come back from the browser on every poll and are pasted
 * straight into a URL that carries our API key, so the shape is checked rather
 * than trusted. Without this a crafted name walks the path to any endpoint on
 * the host, with the key attached.
 */
const OPERATION_NAME = /^models\/[A-Za-z0-9._-]+\/operations\/[A-Za-z0-9._-]+$/;

export function isOperationName(value: string): boolean {
  return OPERATION_NAME.test(value);
}

type PredictResponse = {
  name?: string;
  error?: { message?: string };
};

/**
 * Hand Veo the finished scene and the motion brief.
 *
 * The scene image is the whole point: generating a video from the prompt alone
 * would invent a new product. Veo animates the pixels it is given, so the label
 * that survived the image pass survives this one too.
 *
 * Returns the operation name to poll. No frames exist yet at this point.
 */
export async function startSceneVideo({
  sceneImage,
  mimeType,
  motionPrompt,
  orientation,
  durationSeconds,
}: {
  sceneImage: Buffer;
  mimeType: string;
  motionPrompt: string;
  orientation: Orientation;
  durationSeconds: VideoDuration;
}): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new GeminiVideoError("Gemini API key is not set.");
  }

  const model = getGeminiVideoModel();

  let response: Response;
  try {
    response = await fetch(`${GEMINI_API_ROOT}/models/${model}:predictLongRunning`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Header rather than ?key= so the secret stays out of URLs and logs.
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: motionPrompt,
            // `bytesBase64Encoded`, not the `inlineData` block the rest of the
            // Gemini API takes: this endpoint is the older predict surface and
            // rejects inline data outright ("`inlineData` isn't supported by
            // this model").
            image: {
              bytesBase64Encoded: sceneImage.toString("base64"),
              mimeType,
            },
          },
        ],
        parameters: {
          aspectRatio: VIDEO_ASPECT_RATIO[orientation],
          // A number, not the string the option list carries: form values and
          // the picker are text, and Veo rejects a quoted length outright.
          durationSeconds: Number(durationSeconds),
          resolution: resolutionFor(durationSeconds),
          // Image-to-video accepts no other value, and every model preset in
          // Studio puts a person beside the product.
          personGeneration: "allow_adult",
        },
      }),
      signal: AbortSignal.timeout(START_TIMEOUT_MS),
    });
  } catch (error) {
    throw new GeminiVideoError(
      error instanceof Error && error.name === "TimeoutError"
        ? "Veo took too long to accept the job. Try again."
        : "Could not reach Veo.",
    );
  }

  const payload = (await response
    .json()
    .catch(() => null)) as PredictResponse | null;

  if (!response.ok) {
    // A wrong model id or an unsupported resolution both land here, and Veo
    // names which — worth surfacing verbatim so it is a config fix.
    throw new GeminiVideoError(
      payload?.error?.message ??
        `Veo rejected the request (${response.status}). Check GEMINI_VIDEO_MODEL.`,
    );
  }

  const name = payload?.name?.trim();
  if (!name || !isOperationName(name)) {
    throw new GeminiVideoError("Veo did not start a job for that scene.");
  }

  return name;
}

export type VideoStatus =
  | { state: "working" }
  | { state: "ready"; uri: string }
  | { state: "failed"; error: string };

type OperationResponse = {
  done?: boolean;
  error?: { message?: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{ video?: { uri?: string } }>;
      raiMediaFilteredReasons?: string[];
    };
  };
};

async function readOperation(operationName: string): Promise<OperationResponse> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new GeminiVideoError("Gemini API key is not set.");
  }

  if (!isOperationName(operationName)) {
    throw new GeminiVideoError("That is not a job we started.");
  }

  let response: Response;
  try {
    response = await fetch(`${GEMINI_API_ROOT}/${operationName}`, {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });
  } catch (error) {
    throw new GeminiVideoError(
      error instanceof Error && error.name === "TimeoutError"
        ? "Veo took too long to answer. Try again."
        : "Could not reach Veo.",
    );
  }

  const payload = (await response
    .json()
    .catch(() => null)) as OperationResponse | null;

  if (!response.ok) {
    throw new GeminiVideoError(
      payload?.error?.message ?? `Veo rejected the check (${response.status}).`,
    );
  }

  if (!payload) {
    throw new GeminiVideoError("Veo returned nothing for that job.");
  }

  return payload;
}

/** Where the job has got to. Called on a timer until it stops being `working`. */
export async function pollSceneVideo(operationName: string): Promise<VideoStatus> {
  const payload = await readOperation(operationName);

  if (!payload.done) {
    return { state: "working" };
  }

  if (payload.error?.message) {
    return { state: "failed", error: payload.error.message };
  }

  const generated = payload.response?.generateVideoResponse;
  const uri = generated?.generatedSamples?.[0]?.video?.uri;

  if (uri) {
    return { state: "ready", uri };
  }

  // A refused scene finishes successfully with nothing attached — the reason,
  // when there is one, is the only clue staff get about what to change.
  const filtered = generated?.raiMediaFilteredReasons?.[0];
  return {
    state: "failed",
    error: filtered
      ? `Veo would not make this clip: ${filtered}`
      : "Veo finished without a video. It may have refused the scene — try different wording.",
  };
}

/**
 * Fetch the finished MP4.
 *
 * Takes the operation name and re-reads it for the URI rather than accepting a
 * URL from the browser: a download endpoint that fetches whatever address it is
 * handed, with our API key on the request, is an open proxy.
 *
 * Returns the upstream response so the caller can stream it straight through —
 * an 8-second 1080p clip is not worth buffering into memory.
 */
export async function fetchSceneVideo(operationName: string): Promise<Response> {
  const status = await pollSceneVideo(operationName);

  if (status.state === "working") {
    throw new GeminiVideoError("That clip is not finished yet.");
  }

  if (status.state === "failed") {
    throw new GeminiVideoError(status.error);
  }

  let response: Response;
  try {
    response = await fetch(status.uri, {
      headers: { "x-goog-api-key": getGeminiApiKey() },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch (error) {
    throw new GeminiVideoError(
      error instanceof Error && error.name === "TimeoutError"
        ? "The clip took too long to download. Try again."
        : "Could not download the clip.",
    );
  }

  if (!response.ok || !response.body) {
    // Google keeps generated videos for two days; past that the URI is gone
    // while the operation still reports ready.
    throw new GeminiVideoError(
      response.status === 404 || response.status === 403
        ? "That clip has expired. Veo keeps videos for two days — generate it again."
        : `Could not download the clip (${response.status}).`,
    );
  }

  return response;
}
