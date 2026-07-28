import type { Metadata } from "next";
import { SubmitButton } from "@/components/admin/submit-button";
import { formatShopDateTime } from "@/lib/datetime";
import { requirePermission } from "@/lib/staff-auth";
import {
  STUDIO_PLATFORMS,
  isStudioConfigured,
  listStudioPosts,
  type StudioPost,
  type StudioPostStatus,
} from "@/lib/social/studio-posts";
import {
  createStudioPostAction,
  deleteStudioPostAction,
  setStudioPostStatusAction,
} from "./actions";

export const metadata: Metadata = { title: "Social Posts" };

type PostsPageProps = {
  searchParams: Promise<{
    created?: string;
    deleted?: string;
    saved?: string;
    error?: string;
  }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  "missing-fields": "Give the post a title and some content before saving.",
  "no-platform": "Pick at least one channel to post to.",
  "bad-schedule": "That schedule date could not be read. Pick the date and time again.",
  "missing-post": "That post could not be found. It may have already been deleted.",
  "bad-status": "That is not a status a post can be in.",
};

const STATUS_CLASSES: Record<StudioPostStatus, string> = {
  draft: "border-[#d7c7aa] bg-[#f8f1e4] text-[#8b5e1d]",
  scheduled: "border-[#a5bfd8] bg-[#eef5fb] text-[#285b7d]",
  published: "border-[#8cc8a4] bg-[#e9f7ee] text-[#256542]",
  failed: "border-[#e6b4b4] bg-[#fff0ef] text-[#9b3d32]",
};

const inputClass =
  "mt-2 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white";
const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]";

export default async function SocialPostsPage({ searchParams }: PostsPageProps) {
  await requirePermission("social", "/admin/social/posts");
  const { created, deleted, saved, error } = await searchParams;

  if (!isStudioConfigured()) {
    return (
      <div className="rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-5 py-6 text-sm leading-7 text-[#8b5e1d]">
        Supabase is not configured, so the post scheduler is unavailable. Ask
        your developer to finish the setup — the tables come from
        <code className="mx-1">supabase/add_social_studio.sql</code>.
      </div>
    );
  }

  const posts = await listStudioPosts();
  const scheduled = posts.filter((post) => post.status === "scheduled");
  const published = posts.filter((post) => post.status === "published");
  const message = error ? (ERROR_MESSAGES[error] ?? "Something went wrong.") : null;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Posts" value={posts.length} caption="Everything written so far." />
        <SummaryCard
          label="Scheduled"
          value={scheduled.length}
          caption="Queued and waiting to go out."
        />
        <SummaryCard
          label="Published"
          value={published.length}
          caption="Already sent to your channels."
        />
      </section>

      {message ? (
        <p className="rounded-[1.25rem] border border-[#e6b4b4] bg-[#fff0ef] px-4 py-3 text-sm leading-6 text-[#9b3d32]">
          {message}
        </p>
      ) : null}
      {created ? <Notice>Post saved.</Notice> : null}
      {deleted ? <Notice>Post deleted.</Notice> : null}
      {saved ? <Notice>Post updated.</Notice> : null}

      <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
        {/*
          A disclosure rather than a toggle button: the composer opens and
          closes without JavaScript, so a shaky counter connection cannot leave
          staff with a form they can't reach.
        */}
        <details className="group">
          <summary className="flex cursor-pointer select-none flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
                Composer
              </p>
              <h3 className="mt-2 font-display text-[1.6rem] leading-none tracking-[-0.04em] text-[#201d17]">
                Write a post
              </h3>
            </div>
            <span className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/8 bg-[#f7f2ea] px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#201d17]">
              <span className="group-open:hidden">+ New Post</span>
              <span className="hidden group-open:inline">Close</span>
            </span>
          </summary>

          <form action={createStudioPostAction} className="mt-6 space-y-5">
            <div>
              <label htmlFor="post-title" className={labelClass}>
                Title
              </label>
              <input
                id="post-title"
                name="title"
                type="text"
                required
                placeholder="What is this post about?"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="post-content" className={labelClass}>
                Content / brief
              </label>
              <textarea
                id="post-content"
                name="content"
                required
                rows={4}
                placeholder="The idea, the product, the angle…"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="post-caption" className={labelClass}>
                Caption
              </label>
              <textarea
                id="post-caption"
                name="caption"
                rows={3}
                placeholder="The words that go out with the post."
                className={inputClass}
              />
            </div>

            <fieldset>
              <legend className={labelClass}>Channels</legend>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {STUDIO_PLATFORMS.map((platform) => (
                  <label
                    key={platform}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border border-black/8 bg-[#f7f2ea] px-4 text-sm capitalize text-[#201d17] transition hover:bg-white"
                  >
                    <input
                      type="checkbox"
                      name="platforms"
                      value={platform}
                      defaultChecked={platform === "instagram"}
                      className="h-4 w-4 accent-[#201d17]"
                    />
                    {platform}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="post-schedule" className={labelClass}>
                  Schedule (optional)
                </label>
                <input
                  id="post-schedule"
                  name="scheduledAt"
                  type="datetime-local"
                  className={inputClass}
                />
                <p className="mt-2 text-xs leading-5 text-[#8d7a5c]">
                  Malaysian time. Leave it empty to keep the post as a draft.
                </p>
              </div>
              <div>
                <label htmlFor="post-niche" className={labelClass}>
                  Niche (optional)
                </label>
                <input
                  id="post-niche"
                  name="niche"
                  type="text"
                  placeholder="e.g. wellness, gifting"
                  className={inputClass}
                />
              </div>
            </div>

            <SubmitButton pendingLabel="Saving…">Save Post</SubmitButton>
          </form>
        </details>
      </section>

      <section className="space-y-4">
        {posts.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-black/10 bg-[#f7f2ea] px-6 py-10 text-center text-sm leading-7 text-[#5d574f]">
            No posts yet. Write your first one above.
          </div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </section>
    </div>
  );
}

function PostCard({ post }: { post: StudioPost }) {
  return (
    <article className="rounded-[1.75rem] border border-black/8 bg-white p-5 shadow-[0_16px_48px_rgba(32,29,23,0.04)] sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${STATUS_CLASSES[post.status]}`}
        >
          {post.status}
        </span>
        {post.platforms.map((platform) => (
          <span
            key={platform}
            className="rounded-full border border-black/8 bg-[#f7f2ea] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a6258]"
          >
            {platform}
          </span>
        ))}
        {post.niche ? (
          <span className="text-xs text-[#8d7a5c]">{post.niche}</span>
        ) : null}
      </div>

      <h3 className="mt-4 text-lg font-semibold text-[#201d17]">{post.title}</h3>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-[#5d574f]">
        {post.caption || post.content}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#8d7a5c]">
        {post.scheduledAt ? (
          <span>Scheduled {formatShopDateTime(post.scheduledAt)}</span>
        ) : null}
        {post.publishedAt ? (
          <span>Published {formatShopDateTime(post.publishedAt)}</span>
        ) : null}
        <span>Written {formatShopDateTime(post.createdAt)}</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-3 border-t border-black/8 pt-5">
        {post.status === "scheduled" || post.status === "failed" ? (
          <form action={setStudioPostStatusAction}>
            <input type="hidden" name="id" value={post.id} />
            <input type="hidden" name="status" value="draft" />
            <SubmitButton variant="outline" pendingLabel="Moving…">
              Back to Draft
            </SubmitButton>
          </form>
        ) : null}

        {post.status !== "published" ? (
          <form action={setStudioPostStatusAction}>
            <input type="hidden" name="id" value={post.id} />
            <input type="hidden" name="status" value="published" />
            <SubmitButton variant="outline" pendingLabel="Marking…">
              Mark Posted
            </SubmitButton>
          </form>
        ) : null}

        <form action={deleteStudioPostAction}>
          <input type="hidden" name="id" value={post.id} />
          <SubmitButton variant="danger" pendingLabel="Deleting…">
            Delete
          </SubmitButton>
        </form>
      </div>
    </article>
  );
}

function SummaryCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: number;
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

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[1.25rem] border border-[#8cc8a4] bg-[#e9f7ee] px-4 py-3 text-sm leading-6 text-[#256542]">
      {children}
    </p>
  );
}
