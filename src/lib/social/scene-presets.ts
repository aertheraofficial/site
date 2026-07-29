/**
 * Ready-made settings and models for a product scene.
 *
 * Location and model are written descriptions, not separately generated images.
 * Generating a background and a person on their own and compositing them later
 * gives each one its own lighting, scale and perspective, and the seams show —
 * the product also has to be redrawn to merge it in, which is exactly what
 * garbles the small print on the label. One pass with the real product photo as
 * the only image reference keeps the label intact and takes a third of the time.
 *
 * No "use client" and no server imports: both the picker and the prompt builder
 * read these.
 */

export type ScenePreset = {
  key: string;
  label: string;
  /** Fed to the art director verbatim, so it reads as direction, not a label. */
  prompt: string;
};

export const LOCATION_PRESETS: ScenePreset[] = [
  {
    key: "marble-bathroom",
    label: "Marble bathroom",
    prompt:
      "a bright marble bathroom counter, soft morning light through a window, folded linen towel nearby",
  },
  {
    key: "wooden-table",
    label: "Wooden table",
    prompt:
      "a warm wooden table with fresh pandan and lemongrass leaves, gentle daylight from the side",
  },
  {
    key: "bedside",
    label: "Bedside",
    prompt:
      "a calm bedside table with rumpled cream linen, a small lamp, late evening warmth",
  },
  {
    key: "spa",
    label: "Spa",
    prompt:
      "a serene spa setting with stacked smooth stones, an orchid, water reflections on stone",
  },
  {
    key: "tropical-garden",
    label: "Tropical garden",
    prompt:
      "a shaded tropical garden ledge, banana and monstera leaves, dappled sunlight",
  },
  {
    key: "kitchen-shelf",
    label: "Kitchen shelf",
    prompt:
      "a clean kitchen shelf with ceramic bowls and dried herbs, soft even daylight",
  },
];

/**
 * Every model stands or sits BESIDE the product and never touches it.
 *
 * A hand around a bottle forces the image model to redraw the label underneath
 * the fingers, and the printed text comes back wrong — the one thing a product
 * photo cannot get wrong. Keeping the product on its own surface avoids it.
 */
export const MODEL_PRESETS: ScenePreset[] = [
  {
    key: "none",
    label: "No model",
    prompt: "",
  },
  {
    key: "malay-woman-30s",
    label: "Woman, 30s",
    prompt:
      "a Malaysian woman in her 30s in a cream linen outfit, seated beside the product, relaxed and looking away from the camera, hands resting in her lap",
  },
  {
    key: "malay-woman-20s",
    label: "Woman, 20s",
    prompt:
      "a young Malaysian woman in a soft neutral outfit, standing beside the product, calm and natural, hands at her sides",
  },
  {
    key: "man-30s",
    label: "Man, 30s",
    prompt:
      "a Malaysian man in his 30s in a plain linen shirt, seated beside the product, at ease, hands resting on the table edge",
  },
  {
    key: "hands-only",
    label: "Hands nearby",
    prompt:
      "a pair of hands resting on the surface next to the product, not touching it, soft natural skin tone",
  },
];

export function findPreset(presets: ScenePreset[], key: string): ScenePreset | null {
  return presets.find((preset) => preset.key === key) ?? null;
}

/**
 * Turn the two choices into one line of direction.
 *
 * Free text wins over a preset: someone who typed a setting meant it, and the
 * preset is only ever the quick path.
 */
export function describeScene({
  locationKey,
  locationText,
  modelKey,
  modelText,
}: {
  locationKey: string;
  locationText: string;
  modelKey: string;
  modelText: string;
}) {
  const location =
    locationText.trim() || findPreset(LOCATION_PRESETS, locationKey)?.prompt || "";
  const model = modelText.trim() || findPreset(MODEL_PRESETS, modelKey)?.prompt || "";

  return { location, model };
}
