import { NextResponse } from "next/server";
import { actorHasPermission, getActor } from "@/lib/staff-auth";
import { isGeminiImageConfigured } from "@/lib/social/gemini-image";
import { isKimiConfigured } from "@/lib/social/kimi";
import { SHOT_STAGES, type ShotStage } from "@/lib/social/shot-stages";
import type { ProductAnalysis } from "@/lib/social/studio-scenes";
import { generateStageStill } from "@/lib/social/studio-sequence";
import type { ShotList } from "@/lib/social/studio-shotlist";

/**
 * One stage's still.
 *
 * Per stage rather than a single call that renders the whole sequence: five
 * images in one request runs for minutes and dies on any host with a request
 * timeout. The caller generates the anchor first and passes it back as the
 * reference for the rest, which also lets staff redo one shot without paying to
 * regenerate the four they were happy with.
 */

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function POST(request: Request) {
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

  if (!isKimiConfigured() || !isGeminiImageConfigured()) {
    return NextResponse.json(
      { error: "Needs both MOONSHOT_API_KEY and GEMINI_API_KEY." },
      { status: 400 },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Could not read that request." }, { status: 400 });
  }

  const file = formData.get("productImage");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a product photo." }, { status: 400 });
  }
  if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Use a PNG, JPEG or WebP under 12 MB." }, { status: 400 });
  }

  const stage = String(formData.get("stage") ?? "");
  if (!SHOT_STAGES.includes(stage as ShotStage)) {
    return NextResponse.json({ error: "Unknown stage." }, { status: 400 });
  }

  let analysis: ProductAnalysis;
  let list: ShotList;
  try {
    analysis = JSON.parse(String(formData.get("analysis") ?? "")) as ProductAnalysis;
    list = JSON.parse(String(formData.get("shotList") ?? "")) as ShotList;
  } catch {
    return NextResponse.json({ error: "Plan the sequence first." }, { status: 400 });
  }

  const shot = list?.shots?.find((entry) => entry.stage === stage);
  if (!shot?.applies || !shot.framing) {
    return NextResponse.json(
      { error: "That stage is not part of this sequence." },
      { status: 400 },
    );
  }

  const referenceFile = formData.get("reference");
  const reference =
    referenceFile instanceof File &&
    referenceFile.size > 0 &&
    referenceFile.size <= MAX_BYTES &&
    ACCEPTED_TYPES.includes(referenceFile.type)
      ? {
          data: Buffer.from(await referenceFile.arrayBuffer()),
          mimeType: referenceFile.type,
        }
      : undefined;

  try {
    const { instruction, image } = await generateStageStill({
      productImage: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      analysis,
      list,
      shot,
      reference,
    });

    return NextResponse.json({
      stage,
      instruction,
      imageUrl: `data:${image.mimeType};base64,${image.data}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not make that shot." },
      { status: 502 },
    );
  }
}
