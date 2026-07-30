import { NextResponse } from "next/server";
import { actorHasPermission, getActor } from "@/lib/staff-auth";
import { isKimiConfigured } from "@/lib/social/kimi";
import { deriveShotList } from "@/lib/social/studio-shotlist";
import { analyseProduct } from "@/lib/social/studio-scenes";

/**
 * Plan a sequence for one product.
 *
 * Text only and no render, so it is cheap enough to run before staff commit to
 * anything — the whole point is that the plan can be read, argued with and
 * trimmed before a single second of video is paid for.
 *
 * Under /admin rather than /api because both session cookies are scoped to
 * `path: "/admin"`.
 */

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

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

  if (!isKimiConfigured()) {
    return NextResponse.json(
      { error: "Kimi is not connected. Add MOONSHOT_API_KEY." },
      { status: 400 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("productImage");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a product photo." }, { status: 400 });
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Use a PNG, JPEG or WebP photo." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That photo is over 8 MB." }, { status: 400 });
  }

  try {
    const productImage = Buffer.from(await file.arrayBuffer());
    const analysis = await analyseProduct(productImage, file.type);
    const shotList = await deriveShotList({
      productImage,
      mimeType: file.type,
      analysis,
    });

    return NextResponse.json({ analysis, shotList });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not plan the sequence." },
      { status: 502 },
    );
  }
}
