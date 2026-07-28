import { NextResponse, type NextRequest } from "next/server";
import { trackEvent } from "@/lib/social/studio-analytics";
import { incrementLinkClick, isLinksConfigured } from "@/lib/social/studio-links";

/**
 * Count a link-tree tap, then send the visitor on.
 *
 * The visitor is waiting, so nothing here is allowed to be slow or fatal: an
 * unknown id or a failed write falls back to /links rather than showing an
 * error page to someone who came from an Instagram bio.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const linkId = Number(id);
  const fallback = new URL("/links", request.url);

  if (!Number.isInteger(linkId) || linkId <= 0 || !isLinksConfigured()) {
    return NextResponse.redirect(fallback);
  }

  try {
    const link = await incrementLinkClick(linkId);
    if (!link) {
      return NextResponse.redirect(fallback);
    }

    await trackEvent({
      platform: link.platform,
      eventType: "link_click",
      linkId: link.id,
      referrer: request.headers.get("referer"),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.redirect(link.url);
  } catch {
    return NextResponse.redirect(fallback);
  }
}
