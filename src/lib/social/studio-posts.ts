import "server-only";

import { getSupabaseAdmin, isSupabaseOrderStoreConfigured } from "@/lib/supabase-admin";

/**
 * Organic social posts — the scheduler side of the Social tab.
 *
 * Ported from the aertheramedsoc NestJS `PostService`, which held these in its
 * own SQLite file behind a separate login. Same shape, but the store is
 * Supabase and access is the site's `social` permission.
 *
 * Kept apart from `@/lib/social/store` on purpose: that module owns the paid-ad
 * drafts, which carry reviewer flags, compliance notes and Meta ad objects. An
 * organic post has none of that and must not inherit its approval rules.
 */

export const STUDIO_PLATFORMS = [
  "instagram",
  "facebook",
  "tiktok",
  "threads",
] as const;

export type StudioPlatform = (typeof STUDIO_PLATFORMS)[number];

export const STUDIO_POST_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "failed",
] as const;

export type StudioPostStatus = (typeof STUDIO_POST_STATUSES)[number];

export type StudioPost = {
  id: number;
  title: string;
  content: string;
  caption: string | null;
  platforms: StudioPlatform[];
  status: StudioPostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  mediaUrls: string[];
  niche: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudioPostInput = {
  title: string;
  content: string;
  caption?: string | null;
  platforms: StudioPlatform[];
  niche?: string | null;
  /** ISO instant, already resolved from shop time. Null keeps the post a draft. */
  scheduledAt?: string | null;
  mediaUrls?: string[];
  createdBy?: string | null;
};

type StudioPostRow = {
  id: number;
  title: string;
  content: string;
  caption: string | null;
  platforms: string[] | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  media_urls: string[] | null;
  niche: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function isStudioPlatform(value: unknown): value is StudioPlatform {
  return STUDIO_PLATFORMS.includes(value as StudioPlatform);
}

export function isStudioPostStatus(value: unknown): value is StudioPostStatus {
  return STUDIO_POST_STATUSES.includes(value as StudioPostStatus);
}

export function isStudioConfigured() {
  return isSupabaseOrderStoreConfigured();
}

function fromRow(row: StudioPostRow): StudioPost {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    caption: row.caption,
    platforms: (row.platforms ?? []).filter(isStudioPlatform),
    status: isStudioPostStatus(row.status) ? row.status : "draft",
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    mediaUrls: row.media_urls ?? [],
    niche: row.niche,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listStudioPosts(status?: StudioPostStatus) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("studio_posts").select("*");

  // Matches the old service: a filtered list is a work queue ordered by when
  // each post is due, while the unfiltered list is a history, newest first.
  query = status
    ? query.eq("status", status).order("scheduled_at", { ascending: true })
    : query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    throw new Error(`Unable to read social posts: ${error.message}`);
  }

  return (data as StudioPostRow[]).map(fromRow);
}

export async function getStudioPost(id: number) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("studio_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load social post: ${error.message}`);
  }

  return data ? fromRow(data as StudioPostRow) : null;
}

export async function createStudioPost(input: StudioPostInput) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("studio_posts")
    .insert({
      title: input.title,
      content: input.content,
      caption: input.caption ?? null,
      platforms: input.platforms,
      niche: input.niche ?? null,
      scheduled_at: input.scheduledAt ?? null,
      media_urls: input.mediaUrls ?? [],
      created_by: input.createdBy ?? null,
      // Giving it a time is what schedules it — the old service did the same,
      // so there is no way to arm a post without saying when.
      status: input.scheduledAt ? "scheduled" : "draft",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Unable to create social post: ${error.message}`);
  }

  return fromRow(data as StudioPostRow);
}

export async function updateStudioPost(
  id: number,
  patch: Partial<StudioPostInput> & { status?: StudioPostStatus },
) {
  const supabase = getSupabaseAdmin();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.title !== undefined) row.title = patch.title;
  if (patch.content !== undefined) row.content = patch.content;
  if (patch.caption !== undefined) row.caption = patch.caption;
  if (patch.platforms !== undefined) row.platforms = patch.platforms;
  if (patch.niche !== undefined) row.niche = patch.niche;
  if (patch.mediaUrls !== undefined) row.media_urls = patch.mediaUrls;
  if (patch.scheduledAt !== undefined) row.scheduled_at = patch.scheduledAt;
  if (patch.status !== undefined) row.status = patch.status;

  const { error } = await supabase.from("studio_posts").update(row).eq("id", id);
  if (error) {
    throw new Error(`Unable to update social post: ${error.message}`);
  }
}

export async function deleteStudioPost(id: number) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("studio_posts").delete().eq("id", id);
  if (error) {
    throw new Error(`Unable to delete social post: ${error.message}`);
  }
}

/**
 * Posts whose scheduled time has arrived.
 *
 * The old service published these itself from an in-process
 * `@Cron(EVERY_MINUTE)`. Nothing calls this yet: a serverless deployment has no
 * such loop, and auto-publishing also needs the medsoc `social-media` module
 * (Instagram/TikTok/Threads) which is not ported. Until both land, staff move a
 * post on with "Mark Posted" and this stays the query a scheduled job will use.
 */
export async function listDueStudioPosts(now: Date = new Date()) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("studio_posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) {
    throw new Error(`Unable to read due social posts: ${error.message}`);
  }

  return (data as StudioPostRow[]).map(fromRow);
}

export async function markStudioPostPublished(id: number, publishedAt = new Date()) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("studio_posts")
    .update({
      status: "published",
      published_at: publishedAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Unable to mark social post published: ${error.message}`);
  }
}

export async function markStudioPostFailed(id: number) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("studio_posts")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(`Unable to mark social post failed: ${error.message}`);
  }
}
