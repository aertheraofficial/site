import "server-only";

import { getSocialBrandContext } from "@/lib/social/brand";
import { generateSceneImage, type SceneImage } from "@/lib/social/gemini-image";
import { kimiChat } from "@/lib/social/kimi";
import { ANCHOR_ORDER, STAGE_META, type ShotStage } from "@/lib/social/shot-stages";
import type { ProductAnalysis } from "@/lib/social/studio-scenes";
import type { PlannedShot, ShotList } from "@/lib/social/studio-shotlist";

/**
 * The still for one stage of a sequence.
 *
 * Separate from `studio-scenes` because a sequence shot answers to things a
 * standalone scene does not. It has to match the shots either side of it, it has
 * to leave out whatever the plan said is out of frame, and it has to reuse one
 * cast description rather than inventing a person per call.
 *
 * The first cut of this skipped the art-direction pass and handed the planner's
 * framing straight to the image model. Two of four shots came back unusable: a
 * shot briefed as "no jar in frame" arrived with the jar pasted onto a hand like
 * a marketplace listing, and one briefed as "tight close-up of the face, no
 * product in frame" arrived as a model in a towel holding the jar up to camera.
 * The framing was right; nothing was enforcing it.
 */

export function pickAnchorStage(list: ShotList): ShotStage | null {
  const usable = new Set(
    list.shots.filter((shot) => shot.applies && shot.framing).map((shot) => shot.stage),
  );
  return ANCHOR_ORDER.find((stage) => usable.has(stage)) ?? null;
}

/** Turn the plan's framing into an instruction the image model will actually obey. */
async function writeStageInstruction({
  analysis,
  list,
  shot,
  hasReference,
}: {
  analysis: ProductAnalysis;
  list: ShotList;
  shot: PlannedShot;
  hasReference: boolean;
}): Promise<string> {
  const brand = getSocialBrandContext();
  const meta = STAGE_META[shot.stage];

  return kimiChat({
    system:
      "You are a product photographer and art director writing a brief for an image model. You follow the shot plan you are given exactly and add nothing to it.",
    prompt: `Product details: ${JSON.stringify(analysis)}
Brand: ${brand.brandName}

This is one shot in a sequence. These are fixed for the whole sequence and must
be used as written:
  The person: ${list.cast || "no people in this sequence"}
  The surface and room: ${list.surface || "choose one that suits the product"}

This shot is stage "${shot.stage}" — ${meta.purpose}
Its framing: ${shot.framing}
What happens in it next, once it is animated: ${shot.action}
${
  hasReference
    ? `
A second image is attached alongside the product photo. It is an earlier frame
from this same sequence. Match it: the same hands, the same skin, the same
surface, the same light. It is there so the shots cut together.`
    : ""
}

Write one instruction for producing THIS shot as a photograph.

Hard rules:
- The framing above is the whole shot. Include what it says is in frame and
  nothing else. If it says something is not in frame, that thing does not appear
  anywhere in the picture — not behind, not blurred, not at the edge.
- If a person or their hands appear, they are the person described above, word
  for word. Never a different age, skin tone, build or outfit.
- Nobody holds the product up toward the camera, and nobody presents it. Hands
  are doing something, not displaying.
- The product keeps its exact shape, label design and printed text. Do not
  redesign, relabel, translate or re-word anything on it.
- Where a hand is about to touch the product, crop so no printed text is visible
  at all. Text under a hand comes back rewritten.
- Photorealistic, vertical, shot on a real camera with real depth of field. Not
  a composite, not a catalogue cut-out, not a listing image. Nothing floats.
- No text, captions, logos or watermarks of any kind beyond what is printed on
  the product itself.
${
  meta.medium === "still"
    ? `- This is the closing hero shot. The product is large, centred and straight
  on, the whole label sharp and readable, no hand anywhere near it.`
    : `- This frame is the moment BEFORE the action happens, not during it. Leave
  room for the movement to occur.`
}${
  /*
   * Said twice on purpose — the planner is asked for this too. Cropping the
   * label out of an Open shot took the jar with it: what came back was a hand
   * resting on a black lid standing on the table, and the motion director then
   * correctly reported that nothing in the frame could be opened.
   */
  shot.stage === "open"
    ? `
- The container and its lid are both in frame together, the lid still on the rim
  or barely lifted off it. Keeping the printed panel out of the crop means
  cutting below it — the glass rim and the top of the body stay in shot. A lid
  alone on a surface has nothing left to open.`
    : ""
}

Under 150 words. Reply with the instruction only, no preamble.`,
  });
}

export async function generateStageStill({
  productImage,
  mimeType,
  analysis,
  list,
  shot,
  reference,
}: {
  productImage: Buffer;
  mimeType: string;
  analysis: ProductAnalysis;
  list: ShotList;
  shot: PlannedShot;
  /** An earlier frame from this sequence, for the shots that follow the anchor. */
  reference?: { data: Buffer; mimeType: string };
}): Promise<{ instruction: string; image: SceneImage }> {
  const instruction = await writeStageInstruction({
    analysis,
    list,
    shot,
    hasReference: Boolean(reference),
  });

  const image = await generateSceneImage({
    productImage,
    mimeType,
    scenePrompt: instruction,
    // Sequences are for vertical feeds; a stage shot has no reason to be
    // anything else.
    orientation: "portrait",
    reference,
  });

  return { instruction, image };
}
