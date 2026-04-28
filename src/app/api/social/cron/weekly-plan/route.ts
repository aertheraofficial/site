import { NextResponse } from "next/server";
import { generateSingleSocialAd } from "@/lib/social/agents";
import { saveSocialCampaignWithDrafts } from "@/lib/social/store";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const { campaign, drafts } = await generateSingleSocialAd();
  await saveSocialCampaignWithDrafts(campaign, drafts);

  return NextResponse.json({
    campaignId: campaign.id,
    draftCount: drafts.length,
    status: "created",
  });
}

export async function GET(request: Request) {
  return POST(request);
}
