import "server-only";

import { shopDayKey } from "@/lib/datetime";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Click and event tracking for the link tree.
 *
 * The medsoc version grouped rows in SQL with SQLite's `strftime`. That does not
 * translate to Postgres through the Supabase client without a database
 * function, and at a single shop's volume the rows are few, so the last 30 days
 * are fetched and grouped here instead. Days are bucketed by Malaysian date, so
 * an evening click counts as that evening.
 */

export type AnalyticsEvent = {
  platform: string;
  eventType?: string;
  postId?: number | null;
  linkId?: number | null;
  referrer?: string | null;
  userAgent?: string | null;
};

type AnalyticsRow = {
  platform: string;
  event_type: string;
  link_id: number | null;
  created_at: string;
};

export type AnalyticsSummary = {
  total: number;
  byPlatform: Array<{ platform: string; count: number }>;
  byDay: Array<{ date: string; count: number }>;
  topLinks: Array<{ linkId: number; clicks: number }>;
};

const WINDOW_DAYS = 30;

export async function trackEvent(event: AnalyticsEvent) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("studio_analytics").insert({
    platform: event.platform,
    event_type: event.eventType ?? "link_click",
    post_id: event.postId ?? null,
    link_id: event.linkId ?? null,
    referrer: event.referrer ?? null,
    user_agent: event.userAgent ?? null,
  });

  if (error) {
    // Never let a failed metric break the redirect the visitor is waiting on.
    console.error("Unable to record analytics event:", error.message);
  }
}

function countBy<T>(items: T[], key: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("studio_analytics")
    .select("platform, event_type, link_id, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to read analytics: ${error.message}`);
  }

  const rows = (data ?? []) as AnalyticsRow[];

  const byPlatform = [...countBy(rows, (row) => row.platform)]
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);

  const byDay = [...countBy(rows, (row) => shopDayKey(row.created_at))]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const topLinks = [...countBy(rows.filter((row) => row.link_id != null), (row) =>
    String(row.link_id),
  )]
    .map(([linkId, clicks]) => ({ linkId: Number(linkId), clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  return { total: rows.length, byPlatform, byDay, topLinks };
}
