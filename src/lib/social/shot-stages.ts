import type { ShotType, VideoDuration } from "@/lib/social/video-options";

/**
 * The seven stages of a scent ad, in order.
 *
 * A scent cannot be filmed. What can be filmed is what it does — touch, the mark
 * it leaves, the body's answer — and for a while those, plus the resolve, were
 * the whole list. That was five shots of a product and none of a person, which
 * is why the sequences came back handsome and hollow: nothing established why
 * anyone reached for the jar, so "calm" had nothing to be calm *from*.
 *
 * `world` and `need` fix that, and they are deliberately NOT a softening of the
 * rule below. The rule forbids performed *emotion*; a room at dusk and a hand at
 * the back of a neck are *situation*. Conflating the two is what removed the
 * reason along with the acting.
 *
 * The order is the load-bearing part. A calm face BEFORE the viewer has seen the
 * texture is acting; the same face AFTER the tension and the texture is a
 * result, and the feeling carries onto the product in the final shot. Reversing
 * these is the difference between an ad that reads as honest and one that reads
 * as staged.
 *
 * Its own module with no server imports, for the reason `orientation` gives: the
 * composer needs this list while the modules that consume it hold API keys.
 */

export type ShotStage =
  | "world"
  | "need"
  | "open"
  | "touch"
  | "trace"
  | "reaction"
  | "product";

export const SHOT_STAGES: ShotStage[] = [
  "world",
  "need",
  "open",
  "touch",
  "trace",
  "reaction",
  "product",
];

/**
 * Which stage anchors the look, and therefore gets shot first.
 *
 * `touch` where it exists: it is the most reliable frame the pipeline makes — a
 * macro with no label, no face and one hand — so it is the safest thing for the
 * rest of the sequence to be matched against. The others fall back in order of
 * how much they constrain.
 */
export const ANCHOR_ORDER: ShotStage[] = [
  "touch",
  "open",
  "trace",
  "product",
  // The three that carry a person come last: a room and a face constrain far
  // more than a macro of one hand, so they are the worst things to match the
  // rest of the sequence against.
  "world",
  "need",
  "reaction",
];

export const STAGE_META: Record<
  ShotStage,
  {
    label: string;
    /** What this shot has to show, in the words used to judge a draft. */
    purpose: string;
    /**
     * The resolve is a still, not a clip. Veo drifts the camera on every render,
     * and a held frame gives full control of the one shot where the label has to
     * be readable — for a third of the price.
     */
    medium: "video" | "still";
    shotType: ShotType;
    seconds: VideoDuration;
  }
> = {
  world: {
    label: "World",
    purpose:
      "Where this is happening and what came just before it — the light, the hour, a bag set down, a door closed. No product in frame. This is the shot that gives every shot after it a reason.",
    medium: "video",
    shotType: "ambience",
    seconds: "4",
  },
  need: {
    label: "Need",
    purpose:
      "The physical thing that is not right yet: a shoulder rolled, a hand pressed to the back of the neck, a jaw held. A state of the body, never a sad face — the product answers tension, not sadness. Still no product in frame.",
    medium: "video",
    shotType: "ambience",
    seconds: "4",
  },
  open: {
    label: "Open",
    purpose:
      "The container is opened. Scent starts when something is opened, and the sound of it carries the whole shot.",
    medium: "video",
    // Not `demo`: those rules forbid the container moving, which is the entire
    // action here. See the note on SHOT_TYPES.
    shotType: "open",
    seconds: "4",
  },
  touch: {
    label: "Touch",
    purpose:
      "The material gives under pressure. Texture is what triggers a memory of smell — this is the strongest shot in the sequence.",
    medium: "video",
    shotType: "demo",
    seconds: "4",
  },
  trace: {
    label: "Trace",
    purpose:
      "What the product left behind — a sheen on skin, a mark in the surface. Proof it is real and that it did something.",
    medium: "video",
    shotType: "demo",
    seconds: "4",
  },
  reaction: {
    label: "Reaction",
    purpose:
      "The need, answered. Whatever was held in the need shot lets go — the same shoulder drops, the same neck softens, one slow breath. Same person, same room, same clothes. It must come after the texture, never before.",
    medium: "video",
    shotType: "ambience",
    seconds: "4",
  },
  product: {
    label: "Product",
    purpose:
      "Static, silent, label readable, no hand. The feeling from the shot before transfers onto the thing.",
    medium: "still",
    shotType: "ambience",
    seconds: "4",
  },
};
