/**
 * Image shapes offered in Studio.
 *
 * Its own module with no imports, for the same reason as `caption-options`: the
 * composer is a client component and needs this list, while the Gemini client
 * that consumes it is `server-only` and holds the API key.
 */

export type Orientation = "portrait" | "landscape" | "square";

export const ORIENTATIONS: Orientation[] = ["portrait", "landscape", "square"];

/** How each shape maps to what the shop actually posts. */
export const ASPECT_RATIO: Record<Orientation, string> = {
  portrait: "9:16",
  landscape: "16:9",
  square: "1:1",
};

export function isOrientation(value: unknown): value is Orientation {
  return ORIENTATIONS.includes(value as Orientation);
}
