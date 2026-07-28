/**
 * The tone and language choices offered in the composer.
 *
 * Deliberately in their own module with no imports: the composer is a client
 * component and needs these for its dropdowns, while the generator that uses
 * them is `server-only` and holds the Kimi API key. Keeping the lists here is
 * what stops importing a dropdown option from dragging the API client into the
 * browser bundle.
 */

/** Includes the four medsoc offered plus the ones this shop already used. */
export const CAPTION_TONES = [
  "casual",
  "professional",
  "funny",
  "inspirational",
  "warm",
  "playful",
  "informative",
  "premium",
] as const;

export type CaptionTone = (typeof CAPTION_TONES)[number];

export const CAPTION_LANGUAGES = ["English", "Bahasa Malaysia", "Manglish"] as const;

export type CaptionLanguage = (typeof CAPTION_LANGUAGES)[number];
