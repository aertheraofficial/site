import { NextResponse } from "next/server";
import { actorHasPermission, getActor } from "@/lib/staff-auth";
import { isOperationName, pollSceneVideo } from "@/lib/social/gemini-video";
import { isOrientation } from "@/lib/social/orientation";
import {
  isStudioVideoConfigured,
  renderStudioVideo,
  writeStudioBrief,
} from "@/lib/social/studio-motion";
import type { ProductAnalysis } from "@/lib/social/studio-scenes";
import { isShotType, isVideoDuration } from "@/lib/social/video-options";

/**
 * Start and track a scene animation.
 *
 * A route handler rather than a server action, for two reasons. The scene image
 * has to travel back to the server to be animated and server actions cap the
 * request body at 1 MB — a 1080p PNG is several times that. And Veo is a
 * long-running operation, so the client polls; an action that sat open for two
 * minutes would time out on most hosts.
 *
 * It lives under /admin rather than /api because both session cookies are
 * scoped to `path: "/admin"` — the same handler under /api would never see a
 * logged-in user.
 */

export const runtime = "nodejs";

/**
 * Writing the brief is up to three calls to a reasoning model, so it needs the
 * whole budget a function is allowed. Hobby caps this at 60s regardless of what
 * is asked for; the split into two requests is what makes it fit.
 */
export const maxDuration = 60;

/** Our own PNG output, not a phone upload, so the ceiling is generous. */
const MAX_SCENE_BYTES = 12 * 1024 * 1024;

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

async function requireSocialActor() {
  const actor = await getActor();
  if (!actor) {
    return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  }
  if (!actorHasPermission(actor, "social")) {
    return NextResponse.json(
      { error: "You do not have access to Social." },
      { status: 403 },
    );
  }
  return null;
}

export async function POST(request: Request) {
  const denied = await requireSocialActor();
  if (denied) return denied;

  if (!isStudioVideoConfigured()) {
    return NextResponse.json(
      { error: "Video needs both MOONSHOT_API_KEY and GEMINI_API_KEY." },
      { status: 400 },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Could not read that request." }, { status: 400 });
  }

  const file = formData.get("sceneImage");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Generate a scene first." }, { status: 400 });
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "That is not an image we can animate." }, { status: 400 });
  }
  if (file.size > MAX_SCENE_BYTES) {
    return NextResponse.json({ error: "That scene image is too large." }, { status: 400 });
  }

  const scenePrompt = String(formData.get("scenePrompt") ?? "").trim();
  if (!scenePrompt) {
    return NextResponse.json({ error: "Generate a scene first." }, { status: 400 });
  }

  const orientation = String(formData.get("orientation") ?? "");
  if (!isOrientation(orientation)) {
    return NextResponse.json({ error: "Unknown scene shape." }, { status: 400 });
  }

  const duration = String(formData.get("duration") ?? "");
  if (!isVideoDuration(duration)) {
    return NextResponse.json({ error: "Pick a clip length Veo offers." }, { status: 400 });
  }

  const shotType = String(formData.get("shotType") ?? "");
  if (!isShotType(shotType)) {
    return NextResponse.json({ error: "Pick what the clip is for." }, { status: 400 });
  }

  // Sent back from the client rather than re-read from the image: the vision
  // pass already ran when the scene was made, and repeating it would cost a
  // second call for an answer we have.
  const rawAnalysis = String(formData.get("analysis") ?? "").trim();
  let analysis: ProductAnalysis | string = rawAnalysis;
  try {
    if (rawAnalysis.startsWith("{")) {
      analysis = JSON.parse(rawAnalysis) as ProductAnalysis;
    }
  } catch {
    // A malformed blob is still usable as description text for the brief.
  }

  // Two steps, and which one this is depends on whether a brief came with the
  // request. Sending an approved brief back skips straight to the render, so
  // what was read on screen is what Veo is handed — edits included.
  const approvedBrief = String(formData.get("motionPrompt") ?? "").trim();

  try {
    if (approvedBrief) {
      const { operation } = await renderStudioVideo({
        sceneImage: Buffer.from(await file.arrayBuffer()),
        mimeType: file.type,
        motionPrompt: approvedBrief,
        orientation,
        durationSeconds: duration,
      });

      return NextResponse.json({ operation, motionPrompt: approvedBrief });
    }

    const { motionPrompt, reading } = await writeStudioBrief({
      sceneImage: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      analysis,
      scenePrompt,
      shotType,
      durationSeconds: duration,
      notes: String(formData.get("notes") ?? "").trim(),
    });

    // No `operation`: nothing has been rendered and nothing has been charged.
    return NextResponse.json({ motionPrompt, reading });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not start the clip.",
      },
      { status: 502 },
    );
  }
}

/** Where the job has got to. The client calls this on a timer. */
export async function GET(request: Request) {
  const denied = await requireSocialActor();
  if (denied) return denied;

  const operation = new URL(request.url).searchParams.get("operation")?.trim() ?? "";
  if (!isOperationName(operation)) {
    return NextResponse.json({ error: "That is not a job we started." }, { status: 400 });
  }

  try {
    const status = await pollSceneVideo(operation);
    // The download URI is not passed on: the file route re-reads it server-side
    // so no browser ever holds an address we will fetch with the API key.
    return NextResponse.json(
      status.state === "ready"
        ? { state: "ready" }
        : status.state === "failed"
          ? { state: "failed", error: status.error }
          : { state: "working" },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not check the clip." },
      { status: 502 },
    );
  }
}
