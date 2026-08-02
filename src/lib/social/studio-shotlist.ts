import "server-only";

import { kimiJson } from "@/lib/social/kimi";
import {
  SHOT_STAGES,
  STAGE_META,
  type ShotStage,
} from "@/lib/social/shot-stages";
import type { ProductAnalysis } from "@/lib/social/studio-scenes";

/**
 * Plan a whole sequence from one product, rather than one clip at a time.
 *
 * The seven stages are derived per product, not looked up in a table. The catalog
 * runs to forty-odd products and grows; a hardcoded map would mean a code change
 * every time the shop adds a scent. Step 1 of the scene pipeline already reads
 * the product and reports its type, so the planner works from what is known
 * rather than from what someone remembered to write down.
 *
 * A stage is allowed to come back unused, and that is the point. Nobody touches
 * a reed diffuser — forcing a full set of shots out of one would have the planner
 * invent a hand pressing into it, which is the same failure as vapour off a
 * closed jar, one layer up. A short honest sequence beats a full dishonest one.
 */

export type PlannedShot = {
  stage: ShotStage;
  /** False when this stage has no honest content for this product. */
  applies: boolean;
  /** Why it applies, or why it cannot — shown to staff before anything renders. */
  reason: string;
  /** Art direction for this shot's still. Empty when the stage does not apply. */
  framing: string;
  /** What happens in it, fed to the motion brief as notes. */
  action: string;
  /** What should be heard. Veo renders audio on every clip at no extra cost. */
  sound: string;
};

export type ShotList = {
  shots: PlannedShot[];
  /** One line on how the sequence hangs together, for the staff reading it. */
  through: string;
  /**
   * The one person in the whole sequence, described once.
   *
   * Written here and pasted into every stage verbatim rather than re-invented
   * per shot. Left to itself the image model cast a different person each time —
   * a man's hands opening the jar, a woman's finger in the next shot, a European
   * model in a towel in the third. Nothing in the words connected them because
   * nothing was shared between the calls.
   */
  cast: string;
  /** The surface and room the sequence happens on, likewise shared. */
  surface: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isShotStage(value: unknown): value is ShotStage {
  return SHOT_STAGES.includes(value as ShotStage);
}

const PRINCIPLE = `A scent cannot be filmed. Only what it does can be filmed, and
that is touch, the mark it leaves, and the body's answer to it — in that order.
Before any of that, the film has to say who this is and why they reached for the
jar, or the answer has nothing to answer.

The sequence has seven stages:

${SHOT_STAGES.map(
  (stage) => `- ${stage} (${STAGE_META[stage].label}): ${STAGE_META[stage].purpose}`,
).join("\n")}

Rules that hold for every product:
- Situation, then sensation, then emotion. The world and the need say why the
  product is reached for; the reaction resolves the need that was shown, and it
  comes after the texture, never before. A calm face shown first is acting;
  shown after the tension and the texture it is a result.
- The need is a state of the body, not a mood: a shoulder rolled, a hand at the
  back of the neck, a jaw held. Never a sad or crying face. Tension is something
  a balm can answer; sadness is not, and claiming otherwise is a lie about the
  product.
- The reaction must answer the need specifically. If the need showed a tight
  neck, the reaction shows that same neck let go — same person, same clothes,
  same room, same hour. Two unrelated shots do not make an arc.
- No product in the world or need shots. Those two are the moment before;
  putting the jar in frame there spends the reveal early and turns a situation
  into an advert.
- The world and need stages are the only ones allowed to show the room. If a
  product has no honest need — nobody aches for a reed diffuser — say so and
  drop them, exactly as with any other stage.
- Every shot leaves evidence. A groove in a balm, a sheen on skin, a bruised
  lemongrass stalk. If the world looks the same after the shot as before it, the
  shot is decoration — say so and drop it.
- Nothing gives off steam, vapour or mist unless the product genuinely produces
  it. A spray does. A balm, an oil, a lotion, a soap and a diffuser do not.
- No text anywhere in any shot. Words are added by hand afterwards.
- The product stage is a still photograph, never a moving shot.`;

/**
 * Ask Kimi to lay the sequence out for this product.
 *
 * The product photo goes with it: "reed diffuser" as a phrase does not say
 * whether the reeds are already in the bottle, and the framing for `open`
 * depends entirely on that.
 */
export async function deriveShotList({
  productImage,
  mimeType,
  analysis,
}: {
  productImage: Buffer;
  mimeType: string;
  analysis: ProductAnalysis;
}): Promise<ShotList> {
  const raw = await kimiJson<Record<string, unknown>>({
    system:
      "You are an advertising director planning a short vertical product film. You are strict about physical honesty: you would rather cut a shot than film something that could not happen.",
    prompt: `${PRINCIPLE}

The product: ${JSON.stringify(analysis)}
Its photograph is attached.

Plan the sequence for THIS product. Work out what each stage means for it — what
"opening" is for this container, what there is to touch, what trace it leaves.

Some stages will not fit this product, and you must say so rather than invent
something. Nobody touches a reed diffuser, so it has no touch stage and no trace
on skin; its trace is light through the liquid instead. Judge each stage on
whether it can be filmed honestly for THIS product.

Reply with a JSON object:
{
  "through": "one sentence on how the sequence hangs together for this product",
  "cast": "ONE person, described once for the whole sequence: age, where they are from, skin tone, hands, nails, what they are wearing. Every stage reuses this exact description, so it must be specific enough that two shots made from it look like the same body. Match the product's audience. No swimwear, no towels, no spa robes unless the product is for the bath.",
  "surface": "the surface and room every shot happens on, described once — the material, the light and its direction, the time of day",
  "shots": [
    {
      "stage": "world" | "need" | "open" | "touch" | "trace" | "reaction" | "product",
      "applies": true or false,
      "reason": "why this stage works for this product, or why it cannot",
      "framing": "art direction for the still this shot is animated from — the crop, the angle, what is in frame, and what is NOT in frame. Do not describe the person or the room here; those are in cast and surface and are added automatically. For any shot where a hand touches the product, the framing MUST put the label outside the crop, because a hand across printed text makes the text come back garbled. But cropping the label out must never crop the product out: whatever the hand acts on has to be in frame and recognisable as itself. For a jar, keep the glass rim and the top of the body in shot and put only the printed panel below the bottom edge. For the open stage the lid and the container it comes off must both be in frame together — a frame holding a lid alone has nothing left to open. Empty string when applies is false.",
      "action": "what happens in the shot, one sentence. Empty string when applies is false.",
      "sound": "what is heard — the scrape of a lid, room tone, one slow breath. Only what the frame could actually make: no music, no voice-over. Empty string when applies is false."
    }
  ]
}

Include all seven stages in the array, in order, marking the ones that do not fit
with "applies": false.`,
    image: { data: productImage, mimeType },
  });

  const planned = Array.isArray(raw.shots) ? raw.shots : [];
  const byStage = new Map<ShotStage, PlannedShot>();

  for (const entry of planned) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (!isShotStage(row.stage)) continue;

    byStage.set(row.stage, {
      stage: row.stage,
      applies: row.applies !== false,
      reason: asString(row.reason),
      framing: asString(row.framing),
      action: asString(row.action),
      sound: asString(row.sound),
    });
  }

  // Rebuilt in stage order rather than trusting the order Kimi replied in. The
  // order is the principle — a reaction shot that lands before the texture is
  // the one mistake this whole structure exists to prevent.
  const shots = SHOT_STAGES.map(
    (stage) =>
      byStage.get(stage) ?? {
        stage,
        applies: false,
        reason: "The planner did not cover this stage.",
        framing: "",
        action: "",
        sound: "",
      },
  );

  return {
    shots,
    through: asString(raw.through),
    cast: asString(raw.cast),
    surface: asString(raw.surface),
  };
}

/** The stages that will actually be shot, in order. */
export function usableShots(list: ShotList): PlannedShot[] {
  return list.shots.filter((shot) => shot.applies && shot.framing);
}
