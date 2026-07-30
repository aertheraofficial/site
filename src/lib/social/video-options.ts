import type { Orientation } from "@/lib/social/orientation";

/**
 * Clip options offered in Studio.
 *
 * Its own module for the reason `orientation` gives: the composer is a client
 * component and needs these lists, while the Veo client that consumes them is
 * `server-only` and holds the API key.
 */

/**
 * Veo takes a fixed set of lengths, not a free number — 5 seconds is not on
 * offer, so the picker shows what the model will actually accept rather than a
 * slider that fails at the API.
 */
export const VIDEO_DURATIONS = ["4", "6", "8"] as const;

export type VideoDuration = (typeof VIDEO_DURATIONS)[number];

/** Longest clip: more room for a hook before the viewer scrolls. */
export const DEFAULT_VIDEO_DURATION: VideoDuration = "8";

export function isVideoDuration(value: unknown): value is VideoDuration {
  return VIDEO_DURATIONS.includes(value as VideoDuration);
}

/**
 * Veo only frames 16:9 and 9:16. A square scene has no matching video shape, so
 * it goes out vertical — that is where these clips are posted anyway, and the
 * composer says so before staff spend a generation finding out.
 */
export const VIDEO_ASPECT_RATIO: Record<Orientation, "16:9" | "9:16"> = {
  portrait: "9:16",
  landscape: "16:9",
  square: "9:16",
};

/**
 * What the clip is for, which decides how much is allowed to happen in it.
 *
 * The two need opposite rules. An ambience clip protects the label by keeping
 * every hand away from the product — and a shot where nothing touches the
 * product cannot demonstrate it. A demo needs the opposite: fingers in the balm,
 * a scoop, a mark left behind. That is safe only when the label is outside the
 * crop, because a hand across printed text is what garbles it.
 */
export const SHOT_TYPES = ["ambience", "demo"] as const;

export type ShotType = (typeof SHOT_TYPES)[number];

export const DEFAULT_SHOT_TYPE: ShotType = "ambience";

export function isShotType(value: unknown): value is ShotType {
  return SHOT_TYPES.includes(value as ShotType);
}

export const SHOT_TYPE_META: Record<
  ShotType,
  { label: string; blurb: string; hint: string }
> = {
  ambience: {
    label: "Ambience",
    blurb: "Nobody touches the product",
    hint: "For a lifestyle scene with the label showing. Small human movement, the product held still and readable. Good as a background layer under text.",
  },
  demo: {
    label: "Demo",
    blurb: "A finger scoops the product",
    hint: "For a close macro shot with the label out of frame. A finger presses in, scoops, and lifts away leaving a mark. Do not use it on a shot where the label is readable — a hand across printed text comes back garbled.",
  },
};
