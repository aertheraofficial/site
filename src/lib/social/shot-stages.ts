import type { ShotType, VideoDuration } from "@/lib/social/video-options";

/**
 * The five stages of a scent ad, in order.
 *
 * A scent cannot be filmed. What can be filmed is what it does, and these are
 * the four things it does plus the resolve — touch, the mark left behind, the
 * body's answer, then the product itself.
 *
 * The order is the load-bearing part. A calm face BEFORE the viewer has seen the
 * texture is acting; the same face AFTER it is a result, and the feeling carries
 * onto the product in the final shot. Reversing these two is the difference
 * between an ad that reads as honest and one that reads as staged.
 *
 * Its own module with no server imports, for the reason `orientation` gives: the
 * composer needs this list while the modules that consume it hold API keys.
 */

export type ShotStage = "open" | "touch" | "trace" | "reaction" | "product";

export const SHOT_STAGES: ShotStage[] = [
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
      "The body answers: eyes closing, one slow breath. The only shot with a face, and it must come after the texture, never before.",
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
