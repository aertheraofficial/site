import { Output, generateText } from "ai";
import { z } from "zod";
import type { StatementLine } from "@/lib/reconciliation";

/**
 * Reads a bank / DuitNow statement screenshot into structured transactions.
 *
 * The output is a *draft* — every caller must put it in front of a person before
 * it touches an order. A vision model misreading RM120.00 as RM720.00 is a
 * plausible failure, and silently marking the wrong order paid is worse than
 * making someone check a short list.
 */

const DEFAULT_GATEWAY_MODEL = "openai/gpt-5.2";

/**
 * Gemini is the fallback because the shop already pays for a GEMINI_API_KEY for
 * Social Studio, so statement reading works without buying a second provider.
 *
 * A concrete model id, not `gemini-flash-latest`: an alias that silently moves
 * to a new model would change how amounts are read without anyone noticing, and
 * this output confirms payments.
 */
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_TIMEOUT_MS = 60_000;

function gatewayModel(): string | null {
  const explicit =
    process.env.STATEMENT_VISION_MODEL?.trim() || process.env.SOCIAL_AGENT_MODEL?.trim();
  // A bare Gemini id belongs to the direct path below, not the gateway.
  if (explicit && explicit.includes("/")) return explicit;
  if (explicit) return null;
  return process.env.AI_GATEWAY_API_KEY?.trim() ? DEFAULT_GATEWAY_MODEL : null;
}

function geminiKey() {
  return process.env.GEMINI_API_KEY?.trim() || "";
}

function geminiModel() {
  const explicit = process.env.STATEMENT_VISION_MODEL?.trim();
  return explicit && !explicit.includes("/") ? explicit : DEFAULT_GEMINI_MODEL;
}

export function isStatementVisionConfigured() {
  return Boolean(gatewayModel() || geminiKey());
}

/** Which provider will actually run, for the settings hint on the page. */
export function describeStatementVision() {
  const gateway = gatewayModel();
  if (gateway) return `AI Gateway (${gateway})`;
  if (geminiKey()) return `Gemini (${geminiModel()})`;
  return null;
}

const extractionSchema = z.object({
  currency: z
    .string()
    .nullish()
    .describe("Currency code shown on the statement, e.g. MYR. Null if not visible."),
  transactions: z
    .array(
      z.object({
        time: z
          .string()
          .nullish()
          .describe("Transaction time exactly as printed, e.g. '14:32'. Null if absent."),
        amountText: z
          .string()
          .describe("The amount exactly as printed, e.g. 'RM 120.00' or '120.00'."),
        amountSen: z
          .number()
          .int()
          .describe("The same amount converted to sen. RM120.00 becomes 12000."),
        reference: z
          .string()
          .nullish()
          .describe("Reference, sender name, or description beside the amount."),
        direction: z
          .enum(["in", "out", "unknown"])
          .describe("Money into the account ('in') or out of it ('out')."),
      }),
    )
    .describe("One entry per transaction row visible in the image."),
  unreadable: z
    .boolean()
    .describe("True if the image is too blurry or cropped to read reliably."),
  notes: z
    .string()
    .nullish()
    .describe("Anything a human should double-check, such as a cut-off row."),
});

export type StatementExtraction = {
  lines: StatementLine[];
  /** Incoming credits only — the figure that should match sales. */
  totalIn: number;
  unreadable: boolean;
  notes: string | null;
  skippedOutgoing: number;
};

const PROMPT = `You are reading a Malaysian bank or DuitNow transaction statement screenshot for a shop's daily cash-up.

Extract EVERY transaction row you can see. Rules:
- Report the amount exactly as printed AND converted to sen (RM 120.00 -> 12000). Never round.
- "in" means money received by the shop (credit, incoming transfer, DuitNow received).
- "out" means money leaving (debit, payment, transfer out, fees).
- If you cannot read a row confidently, still include it and set unreadable to true.
- Do not invent rows. Do not merge two rows. Do not compute a total.
- If the screenshot shows a running balance column, ignore it — it is not a transaction.`;

/**
 * Extracts transactions from one or more screenshots of the same statement.
 * Never throws on a model or parse failure — reconciliation must stay usable by
 * hand when the model is unavailable.
 */
export async function extractStatement(
  images: Array<{ bytes: Uint8Array; mediaType: string }>,
): Promise<StatementExtraction> {
  if (images.length === 0) {
    return { lines: [], totalIn: 0, unreadable: false, notes: null, skippedOutgoing: 0 };
  }

  const gateway = gatewayModel();
  const extraction = gateway
    ? await runGateway(gateway, images)
    : geminiKey()
      ? await runGemini(images)
      : (() => {
          throw new Error(
            "No vision model configured. Set GEMINI_API_KEY or AI_GATEWAY_API_KEY.",
          );
        })();

  return toResult(extraction);
}

type Extraction = z.infer<typeof extractionSchema>;

function toResult(extraction: Extraction): StatementExtraction {
  const incoming = extraction.transactions.filter((row) => row.direction !== "out");
  const sen = (row: Extraction["transactions"][number]) =>
    Math.max(0, Math.round(row.amountSen));

  return {
    lines: incoming.map((row) => ({
      time: row.time ?? null,
      amount: sen(row),
      reference: row.reference ?? null,
      matchedSessionId: null,
    })),
    totalIn: incoming.reduce((sum, row) => sum + sen(row), 0),
    unreadable: extraction.unreadable,
    notes: extraction.notes ?? null,
    skippedOutgoing: extraction.transactions.length - incoming.length,
  };
}

async function runGateway(
  model: string,
  images: Array<{ bytes: Uint8Array; mediaType: string }>,
): Promise<Extraction> {
  const result = await generateText({
    model,
    output: Output.object({ schema: extractionSchema }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          ...images.map((image) => ({
            type: "image" as const,
            image: image.bytes,
            mediaType: image.mediaType,
          })),
        ],
      },
    ],
  });

  return result.output;
}

/** Gemini's own JSON-mode schema — the AI SDK's zod bridge is not in this path. */
const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    currency: { type: "STRING", nullable: true },
    transactions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          time: { type: "STRING", nullable: true },
          amountText: { type: "STRING" },
          amountSen: { type: "INTEGER" },
          reference: { type: "STRING", nullable: true },
          direction: { type: "STRING", enum: ["in", "out", "unknown"] },
        },
        required: ["amountText", "amountSen", "direction"],
      },
    },
    unreadable: { type: "BOOLEAN" },
    notes: { type: "STRING", nullable: true },
  },
  required: ["transactions", "unreadable"],
} as const;

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

async function runGemini(
  images: Array<{ bytes: Uint8Array; mediaType: string }>,
): Promise<Extraction> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${GEMINI_ENDPOINT}/${geminiModel()}:generateContent?key=${encodeURIComponent(geminiKey())}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                ...images.map((image) => ({
                  inline_data: {
                    mime_type: image.mediaType || "image/png",
                    data: toBase64(image.bytes),
                  },
                })),
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: GEMINI_RESPONSE_SCHEMA,
            // Reading digits off a statement is transcription, not writing.
            temperature: 0,
          },
        }),
      },
    );

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error?.message || `Gemini returned ${response.status}`);
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("");

    if (!text) {
      throw new Error("Gemini returned no content — the image may have been rejected.");
    }

    return extractionSchema.parse(JSON.parse(text));
  } finally {
    clearTimeout(timer);
  }
}
