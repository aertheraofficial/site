import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import { getSocialStoragePath } from "@/lib/store-config";
import {
  getSupabaseAdmin,
  isSupabaseOrderStoreConfigured,
} from "@/lib/supabase-admin";
import type { SocialPlatform } from "./brand";

export type SocialPostStatus =
  | "needs_review"
  | "approved"
  | "scheduled"
  | "published"
  | "manual_posted"
  | "rejected"
  | "failed";

export type SocialCampaign = {
  id: string;
  title: string;
  theme: string;
  objective: string;
  audience: string;
  startDate: string;
  endDate: string;
  productSlugs: string[];
  contentPillars: string[];
  createdAt: string;
  updatedAt: string;
};

export type SocialPostDraft = {
  id: string;
  campaignId: string;
  platform: SocialPlatform;
  status: SocialPostStatus;
  scheduledFor: string;
  pillar: string;
  format: string;
  goal: string;
  caption: string;
  visualBrief: string;
  hashtags: string[];
  productSlugs: string[];
  productUrlPath: string | null;
  complianceNotes: string[];
  reviewerFlags: string[];
  approvalNotes: string | null;
  publishedUrl: string | null;
  externalPostId: string | null;
  manualPostedAt: string | null;
  promptInput: Record<string, unknown> | null;
  modelOutput: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type SocialPublishingAccount = {
  id: string;
  platform: SocialPlatform;
  handle: string;
  status: "manual" | "connected" | "needs_setup" | "disabled";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SocialPublishingJob = {
  id: string;
  postId: string;
  platform: SocialPlatform;
  status: "queued" | "blocked" | "sent" | "failed";
  runAfter: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type SocialPostMetric = {
  id: string;
  postId: string;
  platform: SocialPlatform;
  capturedAt: string;
  impressions: number | null;
  engagements: number | null;
  clicks: number | null;
  saves: number | null;
  shares: number | null;
  comments: number | null;
  raw: Record<string, unknown> | null;
};

export type SocialContentStore = {
  campaigns: SocialCampaign[];
  drafts: SocialPostDraft[];
  publishingAccounts: SocialPublishingAccount[];
  publishingJobs: SocialPublishingJob[];
  metrics: SocialPostMetric[];
};

type SocialCampaignRow = {
  id: string;
  title: string;
  theme: string;
  objective: string;
  audience: string;
  start_date: string;
  end_date: string;
  product_slugs: string[];
  content_pillars: string[];
  created_at: string;
  updated_at: string;
  social_posts?: SocialPostRow[] | null;
};

type SocialPostRow = {
  id: string;
  campaign_id: string;
  platform: SocialPlatform;
  status: SocialPostStatus;
  scheduled_for: string;
  pillar: string;
  format: string;
  goal: string;
  caption: string;
  visual_brief: string;
  hashtags: string[];
  product_slugs: string[];
  product_url_path: string | null;
  compliance_notes: string[];
  reviewer_flags: string[];
  approval_notes: string | null;
  published_url: string | null;
  external_post_id: string | null;
  manual_posted_at: string | null;
  prompt_input: Record<string, unknown> | null;
  model_output: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const EMPTY_STORE: SocialContentStore = {
  campaigns: [],
  drafts: [],
  publishingAccounts: [],
  publishingJobs: [],
  metrics: [],
};

function resolveSocialFilePath() {
  return path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    getSocialStoragePath(),
  );
}

function sortCampaigns(campaigns: SocialCampaign[]) {
  return [...campaigns].sort((left, right) =>
    right.startDate.localeCompare(left.startDate),
  );
}

function sortDrafts(drafts: SocialPostDraft[]) {
  return [...drafts].sort((left, right) =>
    left.scheduledFor.localeCompare(right.scheduledFor),
  );
}

async function ensureSocialFile() {
  const filePath = resolveSocialFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify(EMPTY_STORE, null, 2)}\n`, "utf8");
  }

  return filePath;
}

async function readSocialStoreFromFile(): Promise<SocialContentStore> {
  const filePath = await ensureSocialFile();
  const raw = await fs.readFile(filePath, "utf8");

  try {
    const parsed = JSON.parse(raw) as Partial<SocialContentStore>;
    return {
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
      publishingAccounts: Array.isArray(parsed.publishingAccounts)
        ? parsed.publishingAccounts
        : [],
      publishingJobs: Array.isArray(parsed.publishingJobs)
        ? parsed.publishingJobs
        : [],
      metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
    };
  } catch {
    return EMPTY_STORE;
  }
}

async function writeSocialStoreToFile(store: SocialContentStore) {
  const filePath = await ensureSocialFile();
  await fs.writeFile(filePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function fromCampaignRow(row: SocialCampaignRow): SocialCampaign {
  return {
    id: row.id,
    title: row.title,
    theme: row.theme,
    objective: row.objective,
    audience: row.audience,
    startDate: row.start_date,
    endDate: row.end_date,
    productSlugs: row.product_slugs ?? [],
    contentPillars: row.content_pillars ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCampaignRow(campaign: SocialCampaign): Omit<SocialCampaignRow, "social_posts"> {
  return {
    id: campaign.id,
    title: campaign.title,
    theme: campaign.theme,
    objective: campaign.objective,
    audience: campaign.audience,
    start_date: campaign.startDate,
    end_date: campaign.endDate,
    product_slugs: campaign.productSlugs,
    content_pillars: campaign.contentPillars,
    created_at: campaign.createdAt,
    updated_at: campaign.updatedAt,
  };
}

function fromPostRow(row: SocialPostRow): SocialPostDraft {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    platform: row.platform,
    status: row.status,
    scheduledFor: row.scheduled_for,
    pillar: row.pillar,
    format: row.format,
    goal: row.goal,
    caption: row.caption,
    visualBrief: row.visual_brief,
    hashtags: row.hashtags ?? [],
    productSlugs: row.product_slugs ?? [],
    productUrlPath: row.product_url_path,
    complianceNotes: row.compliance_notes ?? [],
    reviewerFlags: row.reviewer_flags ?? [],
    approvalNotes: row.approval_notes,
    publishedUrl: row.published_url,
    externalPostId: row.external_post_id,
    manualPostedAt: row.manual_posted_at,
    promptInput: row.prompt_input,
    modelOutput: row.model_output,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPostRow(post: SocialPostDraft): SocialPostRow {
  return {
    id: post.id,
    campaign_id: post.campaignId,
    platform: post.platform,
    status: post.status,
    scheduled_for: post.scheduledFor,
    pillar: post.pillar,
    format: post.format,
    goal: post.goal,
    caption: post.caption,
    visual_brief: post.visualBrief,
    hashtags: post.hashtags,
    product_slugs: post.productSlugs,
    product_url_path: post.productUrlPath,
    compliance_notes: post.complianceNotes,
    reviewer_flags: post.reviewerFlags,
    approval_notes: post.approvalNotes,
    published_url: post.publishedUrl,
    external_post_id: post.externalPostId,
    manual_posted_at: post.manualPostedAt,
    prompt_input: post.promptInput,
    model_output: post.modelOutput,
    created_at: post.createdAt,
    updated_at: post.updatedAt,
  };
}

async function readSocialStoreFromSupabase(): Promise<SocialContentStore> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("social_campaigns")
    .select("*, social_posts(*)")
    .order("start_date", { ascending: false });

  if (error) {
    throw new Error(`Unable to read social content from Supabase: ${error.message}`);
  }

  const rows = (data ?? []) as SocialCampaignRow[];
  return {
    ...EMPTY_STORE,
    campaigns: rows.map(fromCampaignRow),
    drafts: sortDrafts(rows.flatMap((row) => row.social_posts ?? []).map(fromPostRow)),
  };
}

async function upsertCampaignToSupabase(
  campaign: SocialCampaign,
  drafts: SocialPostDraft[],
) {
  const supabase = getSupabaseAdmin();
  const { error: campaignError } = await supabase
    .from("social_campaigns")
    .upsert(toCampaignRow(campaign), { onConflict: "id" });

  if (campaignError) {
    throw new Error(`Unable to store social campaign: ${campaignError.message}`);
  }

  const rows = drafts.map(toPostRow);
  if (rows.length > 0) {
    const { error: postError } = await supabase
      .from("social_posts")
      .upsert(rows, { onConflict: "id" });

    if (postError) {
      throw new Error(`Unable to store social drafts: ${postError.message}`);
    }
  }
}

async function updateDraftInSupabase(id: string, patch: Partial<SocialPostDraft>) {
  const supabase = getSupabaseAdmin();
  const rowPatch: Partial<SocialPostRow> = {};

  if (patch.status !== undefined) rowPatch.status = patch.status;
  if (patch.scheduledFor !== undefined) rowPatch.scheduled_for = patch.scheduledFor;
  if (patch.pillar !== undefined) rowPatch.pillar = patch.pillar;
  if (patch.format !== undefined) rowPatch.format = patch.format;
  if (patch.goal !== undefined) rowPatch.goal = patch.goal;
  if (patch.caption !== undefined) rowPatch.caption = patch.caption;
  if (patch.visualBrief !== undefined) rowPatch.visual_brief = patch.visualBrief;
  if (patch.hashtags !== undefined) rowPatch.hashtags = patch.hashtags;
  if (patch.productSlugs !== undefined) rowPatch.product_slugs = patch.productSlugs;
  if (patch.productUrlPath !== undefined) rowPatch.product_url_path = patch.productUrlPath;
  if (patch.complianceNotes !== undefined) rowPatch.compliance_notes = patch.complianceNotes;
  if (patch.reviewerFlags !== undefined) rowPatch.reviewer_flags = patch.reviewerFlags;
  if (patch.approvalNotes !== undefined) rowPatch.approval_notes = patch.approvalNotes;
  if (patch.publishedUrl !== undefined) rowPatch.published_url = patch.publishedUrl;
  if (patch.externalPostId !== undefined) rowPatch.external_post_id = patch.externalPostId;
  if (patch.manualPostedAt !== undefined) rowPatch.manual_posted_at = patch.manualPostedAt;
  if (patch.promptInput !== undefined) rowPatch.prompt_input = patch.promptInput;
  if (patch.modelOutput !== undefined) rowPatch.model_output = patch.modelOutput;

  rowPatch.updated_at = new Date().toISOString();

  const { error } = await supabase.from("social_posts").update(rowPatch).eq("id", id);
  if (error) {
    throw new Error(`Unable to update social draft: ${error.message}`);
  }
}

export async function readSocialContent() {
  if (isSupabaseOrderStoreConfigured()) {
    try {
      return await readSocialStoreFromSupabase();
    } catch {
      return readSocialStoreFromFile();
    }
  }

  return readSocialStoreFromFile();
}

export async function saveSocialCampaignWithDrafts(
  campaign: SocialCampaign,
  drafts: SocialPostDraft[],
) {
  const updatedCampaign = {
    ...campaign,
    updatedAt: new Date().toISOString(),
  };
  const updatedDrafts = drafts.map((draft) => ({
    ...draft,
    updatedAt: new Date().toISOString(),
  }));

  if (isSupabaseOrderStoreConfigured()) {
    try {
      await upsertCampaignToSupabase(updatedCampaign, updatedDrafts);
    } catch {
      // Keep the admin workflow usable until the social Supabase schema is applied.
    }
  }

  const store = await readSocialStoreFromFile();
  const campaignIndex = store.campaigns.findIndex(
    (entry) => entry.id === updatedCampaign.id,
  );

  if (campaignIndex >= 0) {
    store.campaigns[campaignIndex] = updatedCampaign;
  } else {
    store.campaigns.unshift(updatedCampaign);
  }

  const draftMap = new Map(store.drafts.map((draft) => [draft.id, draft]));
  for (const draft of updatedDrafts) {
    draftMap.set(draft.id, draft);
  }
  store.campaigns = sortCampaigns(store.campaigns);
  store.drafts = sortDrafts([...draftMap.values()]);
  await writeSocialStoreToFile(store);
}

export async function getSocialDraftById(id: string) {
  const store = await readSocialContent();
  return store.drafts.find((draft) => draft.id === id) ?? null;
}

export async function updateSocialDraft(
  id: string,
  patch: Partial<SocialPostDraft>,
) {
  const store = await readSocialStoreFromFile();
  const draftIndex = store.drafts.findIndex((draft) => draft.id === id);

  if (draftIndex < 0) {
    throw new Error("Social draft not found.");
  }

  const nextDraft = {
    ...store.drafts[draftIndex],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store.drafts[draftIndex] = nextDraft;
  await writeSocialStoreToFile(store);

  if (isSupabaseOrderStoreConfigured()) {
    try {
      await updateDraftInSupabase(id, nextDraft);
    } catch {
      // Local fallback remains the source for the current admin request.
    }
  }

  return nextDraft;
}

export function createSocialId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}
