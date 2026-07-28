import type { Metadata } from "next";
import { MigrationNeeded } from "@/components/admin/migration-needed";
import { requirePermission } from "@/lib/staff-auth";
import { isMissingStudioTable } from "@/lib/social/studio-errors";
import { getAnalyticsSummary } from "@/lib/social/studio-analytics";
import { isLinksConfigured, listLinks } from "@/lib/social/studio-links";
import { listStudioPosts } from "@/lib/social/studio-posts";

export const metadata: Metadata = { title: "Social Analytics" };

export default async function SocialAnalyticsPage() {
  await requirePermission("social", "/admin/social/analytics");

  if (!isLinksConfigured()) {
    return (
      <div className="rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-5 py-6 text-sm leading-7 text-[#8b5e1d]">
        Supabase is not configured, so there is nothing to measure yet. The
        tables come from{" "}
        <code className="mx-1">supabase/add_social_studio.sql</code>.
      </div>
    );
  }

  let summary, links, posts;
  try {
    [summary, links, posts] = await Promise.all([
      getAnalyticsSummary(),
      listLinks(),
      listStudioPosts(),
    ]);
  } catch (readError) {
    if (!isMissingStudioTable(readError)) throw readError;
    return <MigrationNeeded />;
  }

  const titleById = new Map(links.map((link) => [link.id, link.title]));
  const busiestDay = Math.max(1, ...summary.byDay.map((day) => day.count));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
          Analytics
        </p>
        <h3 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
          Last 30 days
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5d574f]">
          Taps on your bio links, grouped by Malaysian date.
        </p>
      </div>

      {summary.total === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-black/10 bg-[#f7f2ea] px-6 py-12 text-center text-sm leading-7 text-[#5d574f]">
          No clicks recorded yet. Share your{" "}
          <code className="mx-1">/links</code> page and they will show up here.
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card label="Clicks" value={String(summary.total)} caption="Across all links." />
            <Card
              label="Links"
              value={String(links.filter((link) => link.isActive).length)}
              caption={`${links.length} in total.`}
            />
            <Card
              label="Posts"
              value={String(posts.length)}
              caption={`${posts.filter((p) => p.status === "published").length} published.`}
            />
            <Card
              label="Platforms"
              value={String(summary.byPlatform.length)}
              caption={summary.byPlatform[0]?.platform ?? "—"}
            />
          </section>

          <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
              Most tapped
            </p>
            <ul className="mt-5 space-y-3">
              {summary.topLinks.map((entry) => {
                const share = Math.round((entry.clicks / summary.total) * 100);
                return (
                  <li key={entry.linkId}>
                    <div className="flex items-baseline justify-between gap-4 text-sm">
                      <span className="min-w-0 truncate text-[#201d17]">
                        {titleById.get(entry.linkId) ?? `Link ${entry.linkId}`}
                      </span>
                      <span className="shrink-0 text-[#5d574f]">
                        {entry.clicks} · {share}%
                      </span>
                    </div>
                    {/* A bar rather than a chart library: one measure, one axis. */}
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f0e9dd]">
                      <div
                        className="h-full rounded-full bg-[#201d17]"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </li>
                );
              })}
              {summary.topLinks.length === 0 ? (
                <li className="text-sm text-[#8d7a5c]">No link taps yet.</li>
              ) : null}
            </ul>
          </section>

          <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
              By day
            </p>
            <ul className="mt-5 space-y-2">
              {summary.byDay.slice(0, 14).map((day) => (
                <li key={day.date} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-[#8d7a5c]">{day.date}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f0e9dd]">
                    <div
                      className="h-full rounded-full bg-[#b38a59]"
                      style={{ width: `${(day.count / busiestDay) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[#201d17]">
                    {day.count}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <article className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)]">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c]">
        {label}
      </p>
      <p className="mt-3 font-display text-[2.6rem] leading-none tracking-[-0.05em] text-[#201d17]">
        {value}
      </p>
      <p className="mt-2 text-sm text-[#5d574f]">{caption}</p>
    </article>
  );
}
