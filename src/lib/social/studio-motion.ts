import "server-only";

import { isGeminiVideoConfigured, startSceneVideo } from "@/lib/social/gemini-video";
import {
  getKimiBriefModel,
  isKimiConfigured,
  kimiChat,
  kimiJson,
} from "@/lib/social/kimi";

/**
 * A reasoning model takes 20-26s to write one of these, and the brief is two
 * calls plus a possible rewrite. That never fitted the 45s caption deadline;
 * it fits now only because rendering moved to its own request.
 */
const BRIEF_TIMEOUT_MS = 110_000;
import type { Orientation } from "@/lib/social/orientation";
import type { ProductAnalysis } from "@/lib/social/studio-scenes";
import type { ShotType, VideoDuration } from "@/lib/social/video-options";

/**
 * Studio: set a finished scene moving.
 *
 * Step 4 of the pipeline, and it splits the same way as the first three — Kimi
 * writes, the Google model draws:
 *
 *   4. Direct the motion — Kimi (text out)
 *   5. Animate it        — Veo (the only one that emits frames)
 *
 * The scene prompt is deliberately NOT reused as the video prompt. It describes
 * what the picture contains, and handing that to an image-to-video model reads
 * as an instruction to build the scene again — the product gets re-rendered and
 * the label goes with it. A motion brief describes only what changes.
 */

export function isStudioVideoConfigured() {
  return isKimiConfigured() && isGeminiVideoConfigured();
}

export function describeStudioVideoSetup() {
  return {
    kimi: isKimiConfigured(),
    veo: isGeminiVideoConfigured(),
  };
}

/**
 * What Kimi finds when it looks at the finished frame.
 *
 * Read out as facts before any motion is written, rather than left implicit in
 * one pass. Naming the state of the frame is what stops the brief inventing
 * around it: a jar recorded as closed cannot later be breathed out of, and an
 * empty `emitters` list is a fact the code itself can hold the brief to.
 */
export type SceneReading = {
  /** Where this looks like, in a few words. */
  setting: string;
  /** The light, and what time of day it reads as. */
  light: string;
  /** Open, closed, or not that kind of product. */
  productState: string;
  /** Who is in shot, how they are posed, where they are looking. */
  people: string;
  /** A window, a fan, an open door — or nothing. */
  airflow: string;
  /** Anything that could genuinely give off steam, mist, smoke or flame. */
  emitters: string[];
  /** What could move, each with the reason it would. */
  couldMove: string[];
  /** What would be a lie if it moved. */
  mustHold: string[];
};

const EMPTY_READING: SceneReading = {
  setting: "",
  light: "",
  productState: "",
  people: "",
  airflow: "",
  emitters: [],
  couldMove: [],
  mustHold: [],
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Step 4a — Kimi reads the frame and says what is actually in it. */
export async function readSceneFrame({
  sceneImage,
  mimeType,
}: {
  sceneImage: Buffer;
  mimeType: string;
}): Promise<SceneReading> {
  try {
    const raw = await kimiJson<Record<string, unknown>>({
      model: getKimiBriefModel(),
      timeoutMs: BRIEF_TIMEOUT_MS,
      system:
        "You read a photograph and report only what is verifiably in it. You never assume, and you are strict about physical plausibility.",
      prompt: `Look at this photograph. It is about to be animated into a short video, so what matters is what could truthfully move in it.

Reply with a JSON object with exactly these fields:
{
  "setting": "where this looks like, a few words",
  "light": "the quality of the light and what time of day it reads as",
  "productState": "is the product open, closed, or not a container at all",
  "people": "who is in shot, how they are posed, and where they are looking",
  "airflow": "an open window, a fan, an open door, or none",
  "emitters": ["only things that could genuinely give off steam, mist, smoke or flame — a lit candle, a running diffuser, hot liquid. A balm, oil, lotion, soap or closed jar at room temperature gives off nothing. Empty array if there are none"],
  "couldMove": ["what could move, each with the reason it would move"],
  "mustHold": ["what would look false if it moved"]
}`,
      image: { data: sceneImage, mimeType },
    });

    return {
      setting: asString(raw.setting),
      light: asString(raw.light),
      productState: asString(raw.productState),
      people: asString(raw.people),
      airflow: asString(raw.airflow),
      emitters: asStringArray(raw.emitters),
      couldMove: asStringArray(raw.couldMove),
      mustHold: asStringArray(raw.mustHold),
    };
  } catch {
    // A shaky read should not sink the run. The brief is written from the image
    // either way — it just loses the checkable facts, so the guard below tightens
    // rather than loosens: no emitters recorded means no emissions allowed.
    return EMPTY_READING;
  }
}

/** Words that only belong in a brief when the frame holds something producing them. */
const EMISSION = /\b(vapou?r|steam|steaming|smoke|smoking|mist|misty|wisp|wisps|fume|fumes)\b/i;

/**
 * The Demo rules, which contradict the ambience ones on purpose.
 *
 * Worked out by generating the shot repeatedly and looking at the frames rather
 * than reasoning about it. Three findings are load-bearing and none of them were
 * obvious:
 *
 *   1. The label is only at risk when it is IN the crop. Once the framing puts it
 *      below the edge, a finger in the product costs nothing.
 *   2. Left to itself the model fills the clip by repeating the action — press,
 *      lift, press again. Naming an end to the arc, and something to hold on
 *      afterwards, is what stops it.
 *   3. The mark left behind is the whole shot. A scoop that leaves the surface
 *      smooth reads as a stock loop; a groove that stays reads as real.
 */
const DEMO_RULES = `- Someone's index finger presses into the product, draws one shallow curved
  scoop, and lifts away carrying a small soft amount of it. This is the point of
  the clip — it must actually happen.
- ONE single action, then stillness. The finger leaves the frame and does not
  come back. Say this plainly, or the model fills the time by repeating the
  scoop and it reads as a loop.
- The mark stays. The groove the finger leaves in the surface holds for the rest
  of the clip, catching the light. This is what tells a viewer the product is
  real, so name it as something that persists, not as a moment.
- The last part of the clip is a held, motionless shot of the marked surface.
- Hands are photoreal: one hand, natural skin, short natural nail, an unhurried
  human speed. No second hand enters.
- The container itself does not move, slide or tip while it is touched.
- If any printed text is visible in this frame, the finger stays clear of it and
  never passes over it. Text under a hand comes back rewritten.
- Camera is a static macro shot on a tripod. No movement, no zoom, no drift.
- Nothing in the background moves.`;

/**
 * The Open rules. Every clause that names the lid contradicts DEMO_RULES, which
 * is why this is a separate mode rather than a paragraph added to that one.
 *
 * The shape is borrowed from the demo findings that still hold — one action that
 * finishes, then a held frame — but the thing that moves is the product, so the
 * two failure modes are different. Left looser, the model returns the lid: it
 * fills the clip by unscrewing and screwing back on. And a lid lifted straight
 * up out of frame reads as a jump cut, so it has to be set down and stay down.
 */
const OPEN_RULES = `- A hand turns the lid anticlockwise and lifts it clear of the jar. This is the
  point of the clip — it must actually happen.
- The lid comes off ONCE and never goes back on. Say this plainly, or the model
  fills the time by closing it again and the clip reads as a loop.
- The lid ends up set down beside the jar, or out of frame low and to one side,
  and stays there. It does not hover, and it does not rise straight up out of
  shot.
- What is left is the open jar with the product surface visible. Name that
  surface as what the last part of the clip holds on.
- The jar body itself stays where it is: it does not slide, tip, lift or rotate
  while the lid is turned. Only the lid and the hand move.
- The last part of the clip is a held, motionless shot of the open jar.
- Hands are photoreal: one hand, natural skin, short natural nail, an unhurried
  human speed. No second hand enters.
- If any printed text is visible in this frame, the hand stays clear of it and
  never passes over it. Text under a hand comes back rewritten.
- Camera is a static shot on a tripod. No movement, no zoom, no drift.
- Nothing in the background moves.`;

/**
 * Step 4 — Kimi turns the still into a shot list of one.
 *
 * The finished scene is attached, not just described. Writing the brief from the
 * art direction alone had Kimi directing things that were not in the frame — it
 * called for vapour rising "from the open balm" over a shot of a closed jar,
 * because the text never said the lid was on. A brief for a shot has to be
 * written by something that has seen the shot.
 */
export async function writeMotionPrompt({
  sceneImage,
  mimeType,
  reading,
  analysis,
  scenePrompt,
  shotType,
  durationSeconds,
  notes,
  correction = "",
}: {
  sceneImage: Buffer;
  mimeType: string;
  reading: SceneReading;
  analysis: ProductAnalysis | string;
  scenePrompt: string;
  shotType: ShotType;
  durationSeconds: VideoDuration;
  notes: string;
  /** Fed back on a second attempt when the first contradicted the reading. */
  correction?: string;
}): Promise<string> {
  const described =
    typeof analysis === "string" ? analysis : JSON.stringify(analysis);
  const printed = typeof analysis === "string" ? "" : analysis.visibleText;

  const modeRules =
    shotType === "demo"
      ? DEMO_RULES
      : shotType === "open"
        ? OPEN_RULES
        : `- Every movement must trace back to something in "couldMove".
- Prefer one small human action with a reason behind it — a breath let out, a
  slow blink, settling back into the chair — over things drifting in general.
  Aimless ambient motion is the main reason a clip reads as generated.
- The product does not move. Nobody picks it up, touches it, or passes a hand
  over it. Its label stays sharp, in focus and readable${
    printed ? `, still reading exactly: ${printed}` : ""
  }.
- Any person moves at micro scale only: a slow blink, quiet breathing, a small
  shift of the head or shoulders, a soft change of expression. No walking, no
  turning around, no reaching, no gesturing across the product.
- One action for the whole clip, not a sequence. ${durationSeconds} seconds is
  a single held moment.
- The camera does not move. Say so plainly: locked tripod, fixed framing, no
  push-in, no pan, no drift. Never give it a percentage — a small allowance is
  read as permission and comes back as a dolly move across the room.
- Nobody changes where they are looking. If the person faces away from camera
  they stay that way for the whole clip; they do not turn toward the lens, and
  their pose at the last frame matches the first. Only the expression may soften.
- Air moves barely or not at all. A gust that lifts hair once and disappears is
  worse than perfect stillness.`;

  /**
   * The one rule an Open shot has to be let out of. "If the container is closed
   * it stays closed" is what keeps every other mode honest — it is also a flat
   * refusal of the only thing this shot does, and Kimi obeys the hard rules over
   * the mode rules when they disagree.
   */
  const closedRule =
    shotType === "open"
      ? "The lid in this frame is the one thing that may change: it comes off. Everything else you direct must already be visible."
      : "If the container is closed it stays closed.";

  /**
   * The reading is the outer limit of what may be directed, and on an Open shot
   * one of its own facts is the obstacle: asked what would look false if it
   * moved, Kimi answers "the lid" — correctly, for every other shot. Left in
   * `mustHold` it outranks the mode rules, and the brief comes back with the lid
   * held still on a clip whose only job is taking it off.
   */
  const LID = /\b(lid|cap|cover|top)\b/i;
  const readingForBrief =
    shotType === "open"
      ? {
          ...reading,
          mustHold: reading.mustHold.filter((entry) => !LID.test(entry)),
        }
      : reading;

  const enters =
    shotType === "demo"
      ? " — the one exception is the hand doing the scoop, which may enter"
      : shotType === "open"
        ? " — the one exception is the hand opening the lid, which may enter, and the lid, which may leave"
        : ". If nobody is holding anything, nothing is picked up";

  return kimiChat({
    model: getKimiBriefModel(),
    timeoutMs: BRIEF_TIMEOUT_MS,
    system:
      shotType === "ambience"
        ? "You are a motion director writing a brief for an image-to-video model. The still already exists and is attached; you only describe what moves in it. You are strict about physical plausibility — a clip that shows something that could not happen is worse than a clip that barely moves."
        : "You are a motion director writing a brief for an image-to-video model. The still already exists and is attached; you describe the single hand action that happens in it and nothing else. You are strict about physical plausibility, and about the action finishing rather than repeating.",
    image: { data: sceneImage, mimeType },
    prompt: `Product details: ${described}
The attached still was made from this art direction: ${scenePrompt}
Clip length: ${durationSeconds} seconds
Additional notes: ${notes || "none"}

You already read this frame. These are the facts you reported, and they are the
outer limit of what you may direct:
${JSON.stringify(readingForBrief, null, 2)}
${correction ? `\n${correction}\n` : ""}
Look at the attached still. Write one motion brief for animating THAT EXACT
FRAME. Describe only what moves. Anything you do not mention holds still, which
is the point.

Hard rules:
- Direct only what you can actually see and what your reading above records.
  ${closedRule} If an object is not in the frame, it cannot enter it${enters}.
- Nothing emits steam, vapour, smoke or mist unless your reading lists something
  under "emitters". An empty list means nothing in this frame gives anything off,
  and scent cannot be seen in any case.
- Everything in "mustHold" stays exactly as it is.
- Never describe the scene again. No setting, no props, no styling, no colours —
  they are already in the frame. Only movement, light and camera.
${modeRules}
- Lighting stays as it is; it may only drift softly.
- End with one short sentence naming what is heard. Veo renders audio with every
  clip whether it is asked for or not, so an unspecified soundtrack is a wasted
  channel, and sound is what puts a viewer in the room. Only what this frame
  could actually make — a lid scraping open, quiet room tone, one slow breath.
  Never music, never a voice-over, never a word of dialogue.
- Write only what happens. Never name something to say it is absent — a video
  model reads "no smoke" as a cue for smoke. If a thing should not be there,
  leave the words for it out of the brief entirely.
- If the notes above ask for something this frame cannot support, leave it out.
  The notes do not override what is physically in the picture.

Under 120 words. Reply with the brief only, no preamble.`,
  });
}

/**
 * Steps 4a-5. Returns as soon as Veo accepts the job — the clip is not made yet.
 *
 * The brief is checked against the reading before it costs a render. A model
 * told not to invent vapour mostly complies, and "mostly" is not good enough
 * when the tell staff complained about is a balm that steams: the check is
 * cheap, and Kimi gets one chance to fix it with the contradiction named.
 */
/**
 * Write the brief, and stop there.
 *
 * Split from the render because the two together no longer fit one request. The
 * brief is up to three Kimi calls — read the frame, write, and rewrite if the
 * writing described vapour the frame cannot produce — and a model strong enough
 * to be worth briefing with takes 20-26s each. Three of those plus starting Veo
 * runs past the 60s a Vercel Hobby function gets, so the request would die with
 * the render never started.
 *
 * Stopping here also puts the brief in front of whoever is paying. A render is
 * RM 2; reading the paragraph that produces it costs nothing, and a brief that
 * misread the frame is obvious on sight.
 */
export async function writeStudioBrief({
  sceneImage,
  mimeType,
  analysis,
  scenePrompt,
  shotType,
  durationSeconds,
  notes,
}: {
  sceneImage: Buffer;
  mimeType: string;
  analysis: ProductAnalysis | string;
  scenePrompt: string;
  shotType: ShotType;
  durationSeconds: VideoDuration;
  notes: string;
}): Promise<{ motionPrompt: string; reading: SceneReading }> {
  const reading = await readSceneFrame({ sceneImage, mimeType });

  const write = (correction?: string) =>
    writeMotionPrompt({
      sceneImage,
      mimeType,
      reading,
      analysis,
      scenePrompt,
      shotType,
      durationSeconds,
      notes,
      correction,
    });

  let motionPrompt = await write();

  // Only enforced when the frame holds nothing that could emit. With a lit
  // candle or a running diffuser in shot, vapour is the honest thing to show.
  if (reading.emitters.length === 0 && EMISSION.test(motionPrompt)) {
    motionPrompt = await write(
      `Your last attempt described "${motionPrompt.match(EMISSION)?.[0]}". Nothing in this frame can produce that — your own reading lists no emitters. Rewrite without it, and without naming it to rule it out.`,
    );

    // Second attempt still wrong: drop the offending sentences rather than pay
    // for a render of the thing that was complained about.
    if (EMISSION.test(motionPrompt)) {
      const kept = motionPrompt
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => !EMISSION.test(sentence))
        .join(" ")
        .trim();

      if (!kept) {
        throw new Error(
          "Kimi kept describing vapour this frame cannot produce. Try again, or reword the notes.",
        );
      }
      motionPrompt = kept;
    }
  }

  return { motionPrompt, reading };
}

/**
 * Render a brief that has already been written — and, by now, seen.
 *
 * Takes the paragraph rather than regenerating it: the whole point of the split
 * is that what was reviewed is what gets rendered, edits included.
 */
export async function renderStudioVideo({
  sceneImage,
  mimeType,
  motionPrompt,
  orientation,
  durationSeconds,
}: {
  sceneImage: Buffer;
  mimeType: string;
  motionPrompt: string;
  orientation: Orientation;
  durationSeconds: VideoDuration;
}): Promise<{ operation: string }> {
  const operation = await startSceneVideo({
    sceneImage,
    mimeType,
    motionPrompt,
    orientation,
    durationSeconds,
  });

  return { operation };
}
