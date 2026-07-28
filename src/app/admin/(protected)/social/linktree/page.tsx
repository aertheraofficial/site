import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/admin/submit-button";
import { requirePermission } from "@/lib/staff-auth";
import { MigrationNeeded } from "@/components/admin/migration-needed";
import { isMissingStudioTable } from "@/lib/social/studio-errors";
import { isLinksConfigured, listLinks } from "@/lib/social/studio-links";
import { STUDIO_PLATFORMS } from "@/lib/social/studio-posts";
import { createLinkAction, deleteLinkAction, toggleLinkAction } from "./actions";

export const metadata: Metadata = { title: "Link Tree" };

type LinktreePageProps = {
  searchParams: Promise<{
    created?: string;
    saved?: string;
    deleted?: string;
    error?: string;
  }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  "missing-fields": "A link needs a title and a web address.",
  "bad-url": "That web address does not look right. It should start with https://",
  "missing-link": "That link could not be found.",
};

const inputClass =
  "mt-2 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white";
const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]";

export default async function LinktreePage({ searchParams }: LinktreePageProps) {
  await requirePermission("social", "/admin/social/linktree");
  const { created, saved, deleted, error } = await searchParams;

  if (!isLinksConfigured()) {
    return (
      <div className="rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-5 py-6 text-sm leading-7 text-[#8b5e1d]">
        Supabase is not configured, so the link tree is unavailable. The tables
        come from <code className="mx-1">supabase/add_social_studio.sql</code>.
      </div>
    );
  }

  let links;
  try {
    links = await listLinks();
  } catch (readError) {
    if (!isMissingStudioTable(readError)) throw readError;
    return <MigrationNeeded />;
  }

  const message = error ? (ERROR_MESSAGES[error] ?? "Something went wrong.") : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
            Link Tree
          </p>
          <h3 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
            Bio links
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5d574f]">
            The list behind the link in your Instagram bio. Clicks are counted,
            so you can see which destination actually earns its place.
          </p>
        </div>
        <Link
          href="/links"
          target="_blank"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/8 bg-white px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-[#f7f2ea]"
        >
          View public page
        </Link>
      </div>

      {message ? (
        <p className="rounded-[1.25rem] border border-[#e6b4b4] bg-[#fff0ef] px-4 py-3 text-sm leading-6 text-[#9b3d32]">
          {message}
        </p>
      ) : null}
      {created || saved || deleted ? (
        <p className="rounded-[1.25rem] border border-[#8cc8a4] bg-[#e9f7ee] px-4 py-3 text-sm leading-6 text-[#256542]">
          {created ? "Link added." : deleted ? "Link removed." : "Link updated."}
        </p>
      ) : null}

      <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
        <form action={createLinkAction} className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="link-title" className={labelClass}>
              Title
            </label>
            <input
              id="link-title"
              name="title"
              type="text"
              required
              placeholder="Shop the Calm collection"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="link-url" className={labelClass}>
              Web address
            </label>
            <input
              id="link-url"
              name="url"
              type="url"
              required
              placeholder="https://…"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="link-platform" className={labelClass}>
              Platform
            </label>
            <select
              id="link-platform"
              name="platform"
              defaultValue="instagram"
              className={inputClass}
            >
              {STUDIO_PLATFORMS.map((platform) => (
                <option key={platform} value={platform} className="capitalize">
                  {platform}
                </option>
              ))}
              <option value="website">website</option>
              <option value="shopee">shopee</option>
              <option value="whatsapp">whatsapp</option>
            </select>
          </div>
          <div>
            <label htmlFor="link-order" className={labelClass}>
              Position
            </label>
            <input
              id="link-order"
              name="sortOrder"
              type="number"
              defaultValue={links.length}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Adding…">Add Link</SubmitButton>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        {links.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-black/10 bg-[#f7f2ea] px-6 py-10 text-center text-sm leading-7 text-[#5d574f]">
            No links yet.
          </div>
        ) : (
          links.map((link) => (
            <article
              key={link.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-black/8 bg-white p-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-semibold text-[#201d17]">{link.title}</p>
                  <span className="rounded-full border border-black/8 bg-[#f7f2ea] px-3 py-0.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#6a6258]">
                    {link.platform}
                  </span>
                  {!link.isActive ? (
                    <span className="rounded-full border border-[#d6c2a0] bg-[#f8f1e4] px-3 py-0.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#8b5e1d]">
                      hidden
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-[#8d7a5c]">{link.url}</p>
                <p className="mt-1 text-xs text-[#8d7a5c]">
                  {link.clickCount} {link.clickCount === 1 ? "click" : "clicks"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <form action={toggleLinkAction}>
                  <input type="hidden" name="id" value={link.id} />
                  <input
                    type="hidden"
                    name="isActive"
                    value={link.isActive ? "false" : "true"}
                  />
                  <SubmitButton variant="outline" pendingLabel="Saving…">
                    {link.isActive ? "Hide" : "Show"}
                  </SubmitButton>
                </form>
                <form action={deleteLinkAction}>
                  <input type="hidden" name="id" value={link.id} />
                  <SubmitButton variant="danger" pendingLabel="Removing…">
                    Delete
                  </SubmitButton>
                </form>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
