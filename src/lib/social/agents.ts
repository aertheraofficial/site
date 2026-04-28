import { generateText, Output } from "ai";
import { z } from "zod";
import {
  CONTENT_PILLARS,
  SOCIAL_PLATFORMS,
  getSocialBrandContext,
  type BrandProductFact,
  type SocialPlatform,
} from "./brand";
import {
  createSocialId,
  type SocialCampaign,
  type SocialPostDraft,
} from "./store";

type PlatformSpec = {
  label: string;
  primaryFormat: string;
  captionHint: string;
  visualHint: string;
  hashtagCount: number;
};

type SingleAdOptions = {
  productSlug?: string;
  platform?: SocialPlatform;
};

/** When using Vercel AI Gateway (`AI_GATEWAY_API_KEY`), this is used if `SOCIAL_AGENT_MODEL` is unset. */
const DEFAULT_SOCIAL_AGENT_GATEWAY_MODEL = "openai/gpt-5.2";

function resolveSocialAgentModel(): string {
  const explicit = process.env.SOCIAL_AGENT_MODEL?.trim();
  if (explicit) {
    return explicit;
  }

  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return DEFAULT_SOCIAL_AGENT_GATEWAY_MODEL;
  }

  throw new Error(
    "Social agent model is not configured. Set SOCIAL_AGENT_MODEL (e.g. openai/gpt-5.2 for AI Gateway) or set AI_GATEWAY_API_KEY to use the default gateway model.",
  );
}

export const SOCIAL_AGENT_PIPELINE_STAGES = [
  {
    id: "strategy",
    label: "Strategy Agent",
    description:
      "Chooses campaign theme, audience, product focus, and weekly calendar targets.",
    runsIn: "Next.js server action or cron route",
  },
  {
    id: "brand-context",
    label: "Catalog/Brand Agent",
    description:
      "Grounds claims in content/site.json, content/catalog.json, content pillars, and prohibited claim rules.",
    runsIn: "Server-side brand context loader",
  },
  {
    id: "platform-adapter",
    label: "Platform Adapter Agent",
    description:
      "Turns one canonical campaign into Instagram, TikTok, Facebook, and X-specific drafts.",
    runsIn:
      "AI SDK generateText; SOCIAL_AGENT_MODEL or AI_GATEWAY_API_KEY + default model (openai/gpt-5.2)",
  },
  {
    id: "review",
    label: "Brand/Compliance Reviewer",
    description:
      "Flags medical, sustainability, price, availability, and off-brand risk before approval.",
    runsIn: "Server-side reviewer pass",
  },
  {
    id: "approval",
    label: "Human Approval Queue",
    description:
      "Requires an admin to approve, reject, regenerate, export, or mark posts manually published.",
    runsIn: "Protected /admin/social UI",
  },
  {
    id: "publishing",
    label: "Scheduler/Publisher Agent",
    description:
      "Starts as manual export and can later connect Meta, TikTok, or X after API readiness.",
    runsIn: "Protected server action or cron-triggered API route",
  },
  {
    id: "analytics",
    label: "Analyst Agent",
    description:
      "Uses social_post_metrics later to recommend next campaign themes and platform cadence changes.",
    runsIn: "Future scheduled server job using stored metrics",
  },
];

const PLATFORM_SPECS: Record<SocialPlatform, PlatformSpec> = {
  instagram: {
    label: "Instagram",
    primaryFormat: "Reel or carousel",
    captionHint:
      "Polished sensory caption with a clear save/share/shop call to action.",
    visualHint:
      "Use warm macro product shots, hand-in-frame ritual details, linen, water, botanicals, and natural light.",
    hashtagCount: 8,
  },
  tiktok: {
    label: "TikTok",
    primaryFormat: "Vertical video script",
    captionHint:
      "Short hook-first caption that supports a quick ritual demo or behind-the-scenes clip.",
    visualHint:
      "Open with movement in the first second, then show the product, ritual steps, and final mood.",
    hashtagCount: 5,
  },
  facebook: {
    label: "Facebook",
    primaryFormat: "Photo or link post",
    captionHint:
      "Trust-building caption with more context, product education, and a soft link prompt.",
    visualHint:
      "Use a clear product/lifestyle image and include the collection name in the post text.",
    hashtagCount: 4,
  },
  x: {
    label: "X",
    primaryFormat: "Short text or link post",
    captionHint:
      "Concise founder-note or tip that links to the product without over-explaining.",
    visualHint:
      "Optional product image; text should work even without media.",
    hashtagCount: 2,
  },
};

const aiDraftSchema = z.object({
  caption: z.string().min(1),
  visualBrief: z.string().min(1),
  hashtags: z.array(z.string()).max(10),
  complianceNotes: z.array(z.string()).max(8),
});

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toScheduledTime(date: Date, hour: number) {
  const scheduled = new Date(date);
  scheduled.setUTCHours(hour, 0, 0, 0);
  return scheduled.toISOString();
}

function pickProducts(productSlugs?: string[]) {
  const context = getSocialBrandContext();
  if (!productSlugs || productSlugs.length === 0) {
    return context.productFacts.slice(0, 6);
  }

  const slugSet = new Set(productSlugs);
  const selected = context.productFacts.filter((product) => slugSet.has(product.slug));
  return selected.length > 0 ? selected : context.productFacts.slice(0, 6);
}

function normalizeHashtag(value: string) {
  const normalized = value
    .replace(/^#/, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim();

  return normalized ? `#${normalized}` : null;
}

function getPillar(index: number) {
  return CONTENT_PILLARS[index % CONTENT_PILLARS.length];
}

function reviewDraft(caption: string, visualBrief: string) {
  const context = getSocialBrandContext();
  const haystack = `${caption} ${visualBrief}`.toLowerCase();
  const reviewerFlags = context.prohibitedClaims
    .filter((claim) => haystack.includes(claim.toLowerCase()))
    .map((claim) => `Review prohibited or sensitive claim: "${claim}".`);

  const complianceNotes = [
    "Grounded in catalog facts for product, availability, scent notes, and price.",
    "Automated checks must pass before publishing runs.",
  ];

  if (reviewerFlags.length > 0) {
    complianceNotes.push("Blocked from publishing until flagged claims are removed.");
  }

  return { complianceNotes, reviewerFlags };
}

async function generateAiVariant(params: {
  platform: SocialPlatform;
  product: BrandProductFact;
  pillarLabel: string;
  pillarGuardrail: string;
}) {
  const model = resolveSocialAgentModel();
  const context = getSocialBrandContext();
  const spec = PLATFORM_SPECS[params.platform];
  const promptInput = {
    brand: {
      name: context.brandName,
      positioning: context.positioning,
      voice: context.voice,
      claimRules: context.claimRules,
      prohibitedClaims: context.prohibitedClaims,
    },
    platform: params.platform,
    platformRole: spec.captionHint,
    pillar: params.pillarLabel,
    guardrail: params.pillarGuardrail,
    product: params.product,
  };

  const result = await generateText({
    model,
    output: Output.object({ schema: aiDraftSchema }),
    prompt: `Create one approved-review-ready social media draft as JSON from this brief:\n${JSON.stringify(promptInput, null, 2)}`,
  });

  return {
    ...result.output,
    promptInput,
    modelOutput: result.output as Record<string, unknown>,
  };
}

async function buildDraft(params: {
  campaignId: string;
  platform: SocialPlatform;
  product: BrandProductFact;
  scheduledFor: string;
  pillarIndex: number;
}) {
  const pillar = getPillar(params.pillarIndex);
  const spec = PLATFORM_SPECS[params.platform];
  const aiVariant = await generateAiVariant({
    platform: params.platform,
    product: params.product,
    pillarLabel: pillar.label,
    pillarGuardrail: pillar.guardrail,
  });
  const caption = aiVariant.caption;
  const visualBrief = aiVariant.visualBrief;
  const hashtags = aiVariant.hashtags
    .map(normalizeHashtag)
    .filter((hashtag): hashtag is string => Boolean(hashtag))
    .slice(0, spec.hashtagCount);
  const review = reviewDraft(caption, visualBrief);
  const createdAt = new Date().toISOString();

  return {
    id: createSocialId("post"),
    campaignId: params.campaignId,
    platform: params.platform,
    status: "needs_review",
    scheduledFor: params.scheduledFor,
    pillar: pillar.label,
    format: spec.primaryFormat,
    goal: `${spec.label}: ${spec.captionHint}`,
    caption,
    visualBrief,
    hashtags,
    productSlugs: [params.product.slug],
    productUrlPath: params.product.urlPath,
    complianceNotes: [...aiVariant.complianceNotes, ...review.complianceNotes],
    reviewerFlags: review.reviewerFlags,
    approvalNotes: null,
    publishedUrl: null,
    externalPostId: null,
    manualPostedAt: null,
    promptInput: aiVariant.promptInput,
    modelOutput: aiVariant.modelOutput,
    createdAt,
    updatedAt: createdAt,
  } satisfies SocialPostDraft;
}

export async function generateSingleSocialAd(options: SingleAdOptions = {}) {
  const products = pickProducts(options.productSlug ? [options.productSlug] : undefined);
  const product = products[0];
  const scheduledFor = new Date();
  const platform = options.platform ?? "instagram";
  const campaignId = createSocialId("campaign");
  const createdAt = new Date().toISOString();
  const campaign: SocialCampaign = {
    id: campaignId,
    title: `Aerthera single ad - ${toDateInput(scheduledFor)}`,
    theme: `${product.shortName} ${PLATFORM_SPECS[platform].label} ad`,
    objective:
      "Generate one human-approved social ad draft for a focused test before scaling cadence.",
    audience:
      "Wellness-minded shoppers, home fragrance buyers, gift shoppers, and sustainability-conscious customers.",
    startDate: toDateInput(scheduledFor),
    endDate: toDateInput(scheduledFor),
    productSlugs: [product.slug],
    contentPillars: [CONTENT_PILLARS[0].label],
    createdAt,
    updatedAt: createdAt,
  };
  const draft = await buildDraft({
    campaignId,
    platform,
    product,
    scheduledFor: toScheduledTime(scheduledFor, 3),
    pillarIndex: 0,
  });

  return { campaign, drafts: [draft] };
}

export async function regenerateSocialDraftVariant(draft: SocialPostDraft) {
  const products = pickProducts(draft.productSlugs);
  const platform = SOCIAL_PLATFORMS.includes(draft.platform)
    ? draft.platform
    : "instagram";
  const nextDraft = await buildDraft({
    campaignId: draft.campaignId,
    platform,
    product: products[0],
    scheduledFor: draft.scheduledFor,
    pillarIndex: Math.max(
      0,
      CONTENT_PILLARS.findIndex((pillar) => pillar.label === draft.pillar),
    ),
  });

  return {
    ...draft,
    format: nextDraft.format,
    goal: nextDraft.goal,
    caption: nextDraft.caption,
    visualBrief: nextDraft.visualBrief,
    hashtags: nextDraft.hashtags,
    complianceNotes: nextDraft.complianceNotes,
    reviewerFlags: nextDraft.reviewerFlags,
    status: "needs_review",
    approvalNotes: "Regenerated for review.",
    promptInput: nextDraft.promptInput,
    modelOutput: nextDraft.modelOutput,
  } satisfies SocialPostDraft;
}
