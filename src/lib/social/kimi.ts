import "server-only";

/**
 * Kimi (Moonshot AI) — the copywriter for the Social tab.
 *
 * Kimi's API is OpenAI-compatible, so a plain fetch is enough and saves pulling
 * in another SDK. Endpoint, headers and model ids are from
 * platform.kimi.ai/docs/api/chat.
 *
 * Text only, deliberately: every Kimi model takes images as *input* but only
 * ever returns text. Image generation in Studio stays on Gemini — see
 * `studio-scenes` — because compositing a product into a scene needs a model
 * that emits pixels.
 */

const KIMI_ENDPOINT = "https://api.moonshot.ai/v1/chat/completions";

/** Costs less than k3 and is more than good enough for captions. */
const DEFAULT_KIMI_MODEL = "kimi-k2.6";

/** A slow model must not hold a server action open indefinitely. */
const KIMI_TIMEOUT_MS = 45_000;

function getKimiApiKey() {
  // MOONSHOT_API_KEY is the name in Kimi's own docs; KIMI_API_KEY is accepted
  // too because that is what the platform calls itself now.
  return (
    process.env.MOONSHOT_API_KEY?.trim() || process.env.KIMI_API_KEY?.trim() || ""
  );
}

export function isKimiConfigured() {
  return Boolean(getKimiApiKey());
}

export function getKimiModel() {
  return process.env.KIMI_MODEL?.trim() || DEFAULT_KIMI_MODEL;
}

/**
 * The model that writes a brief for an image or video model, which is worth
 * paying more for than a caption is.
 *
 * Measured on the video path: a stronger model adds about 13 sen to a clip that
 * costs RM 2 to render, so the whole upgrade is 6% of the bill — and a single
 * clip saved from being rebriefed pays for fifteen of them. Kimi is not where
 * the money goes; Veo is.
 *
 * Separate from KIMI_MODEL because captions run far more often, are short, and
 * are read before they are posted — the fast model is the right answer there.
 */
export function getKimiBriefModel() {
  return process.env.KIMI_BRIEF_MODEL?.trim() || getKimiModel();
}

export class KimiError extends Error {}

/**
 * Content is either a plain string or, when an image is attached, the array
 * form. Kimi's docs are explicit that the array must be sent as real JSON — a
 * stringified array is accepted but silently skips the image.
 */
type KimiContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

type KimiMessage = { role: "system" | "user" | "assistant"; content: KimiContent };

export type KimiImage = {
  /** Raw image bytes; encoded to base64 here. */
  data: Buffer;
  mimeType: string;
};

type KimiChatOptions = {
  system?: string;
  prompt: string;
  /** Attach an image for the model to read. Vision is input only. */
  image?: KimiImage;
  /**
   * Ask for a JSON object back. Kimi requires the shape to be described in the
   * prompt as well — `response_format` alone does not tell it what fields to
   * emit.
   */
  json?: boolean;
  /**
   * Override the model for this call. Left unset, the account-wide KIMI_MODEL
   * applies.
   */
  model?: string;
  /**
   * Override the abort deadline. A brief written by a reasoning model takes
   * far longer than a caption, and 45s is not enough for it.
   */
  timeoutMs?: number;
};

type KimiResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export async function kimiChat({
  system,
  prompt,
  image,
  json = false,
  model,
  timeoutMs,
}: KimiChatOptions): Promise<string> {
  const apiKey = getKimiApiKey();
  if (!apiKey) {
    throw new KimiError("Kimi API key is not set.");
  }

  const messages: KimiMessage[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({
    role: "user",
    content: image
      ? [
          {
            type: "image_url",
            image_url: {
              url: `data:${image.mimeType};base64,${image.data.toString("base64")}`,
            },
          },
          { type: "text", text: prompt },
        ]
      : prompt,
  });

  let response: Response;
  try {
    response = await fetch(KIMI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || getKimiModel(),
        messages,
        // No `temperature`. kimi-k2.6 rejects anything but 1 outright
        // ("invalid temperature: only 1 is allowed for this model"), and the
        // allowed range differs between Kimi models. Omitting it takes each
        // model's own default and keeps this working if KIMI_MODEL changes.
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs ?? KIMI_TIMEOUT_MS),
    });
  } catch (error) {
    // Timeouts and network faults both land here; neither should surface as an
    // unhandled crash on an admin screen.
    throw new KimiError(
      error instanceof Error && error.name === "TimeoutError"
        ? "Kimi took too long to answer. Try again."
        : "Could not reach Kimi.",
    );
  }

  const payload = (await response.json().catch(() => null)) as KimiResponse | null;

  if (!response.ok) {
    // Kimi returns the reason in the body; the status alone ("400") tells staff
    // nothing about a bad key versus an exhausted quota.
    throw new KimiError(
      payload?.error?.message ?? `Kimi rejected the request (${response.status}).`,
    );
  }

  const content = payload?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new KimiError("Kimi returned an empty response.");
  }

  return content;
}

/**
 * Same call, parsed as JSON. Models still fence their output in ```json blocks
 * now and then even in JSON mode, so strip that before parsing.
 */
export async function kimiJson<T>(options: Omit<KimiChatOptions, "json">): Promise<T> {
  const raw = await kimiChat({ ...options, json: true });
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new KimiError("Kimi did not return readable JSON.");
  }
}
