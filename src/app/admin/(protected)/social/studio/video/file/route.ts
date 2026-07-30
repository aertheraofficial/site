import { NextResponse } from "next/server";
import { actorHasPermission, getActor } from "@/lib/staff-auth";
import { fetchSceneVideo, isOperationName } from "@/lib/social/gemini-video";

/**
 * Serve the finished MP4.
 *
 * Its own route because the clip is fetched with our API key attached, and that
 * request must never be steerable from the browser. The client sends only the
 * operation name; the download address is looked up server-side each time.
 */

export const runtime = "nodejs";

function safeFileName(value: string) {
  const slug =
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "scene";
  return `${slug}.mp4`;
}

export async function GET(request: Request) {
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

  const params = new URL(request.url).searchParams;
  const operation = params.get("operation")?.trim() ?? "";
  if (!isOperationName(operation)) {
    return NextResponse.json({ error: "That is not a job we started." }, { status: 400 });
  }

  try {
    const upstream = await fetchSceneVideo(operation);

    // Streamed straight through rather than buffered: an 8-second 1080p clip is
    // tens of megabytes and holding it in memory buys nothing.
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
        "Content-Disposition": `attachment; filename="${safeFileName(
          params.get("name") ?? "scene",
        )}"`,
        // Nothing is stored our side and Google drops the file after two days,
        // so a cached copy would outlive what it points at.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not fetch the clip." },
      { status: 502 },
    );
  }
}
