import "server-only";

import { getSupabaseAdmin, isSupabaseOrderStoreConfigured } from "@/lib/supabase-admin";

/**
 * The link tree — the list of destinations behind the shop's Instagram bio.
 *
 * Ported from the medsoc `LinkService`. `order` is a reserved word in SQL, so
 * the column is `sort_order` here.
 */

export type StudioLink = {
  id: number;
  title: string;
  url: string;
  platform: string;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  clickCount: number;
};

type StudioLinkRow = {
  id: number;
  title: string;
  url: string;
  platform: string;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  click_count: number;
};

function fromRow(row: StudioLinkRow): StudioLink {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    platform: row.platform,
    icon: row.icon,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    clickCount: row.click_count,
  };
}

export function isLinksConfigured() {
  return isSupabaseOrderStoreConfigured();
}

export async function listLinks({ activeOnly = false } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("studio_links").select("*").order("sort_order");
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Unable to read links: ${error.message}`);
  }

  return (data as StudioLinkRow[]).map(fromRow);
}

export async function getLink(id: number) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("studio_links")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load link: ${error.message}`);
  }

  return data ? fromRow(data as StudioLinkRow) : null;
}

export async function createLink(input: {
  title: string;
  url: string;
  platform: string;
  sortOrder?: number;
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("studio_links").insert({
    title: input.title,
    url: input.url,
    platform: input.platform,
    sort_order: input.sortOrder ?? 0,
  });

  if (error) {
    throw new Error(`Unable to create link: ${error.message}`);
  }
}

export async function updateLink(
  id: number,
  patch: { title?: string; url?: string; platform?: string; isActive?: boolean; sortOrder?: number },
) {
  const supabase = getSupabaseAdmin();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.url !== undefined) row.url = patch.url;
  if (patch.platform !== undefined) row.platform = patch.platform;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;

  const { error } = await supabase.from("studio_links").update(row).eq("id", id);
  if (error) {
    throw new Error(`Unable to update link: ${error.message}`);
  }
}

export async function deleteLink(id: number) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("studio_links").delete().eq("id", id);
  if (error) {
    throw new Error(`Unable to delete link: ${error.message}`);
  }
}

/**
 * Bump the counter on the link itself. Kept separate from the analytics row so
 * the number shown next to each link survives any pruning of the event log.
 */
export async function incrementLinkClick(id: number) {
  const supabase = getSupabaseAdmin();
  const link = await getLink(id);
  if (!link) return null;

  const { error } = await supabase
    .from("studio_links")
    .update({ click_count: link.clickCount + 1 })
    .eq("id", id);

  if (error) {
    throw new Error(`Unable to record link click: ${error.message}`);
  }

  return link;
}
