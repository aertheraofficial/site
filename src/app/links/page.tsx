import type { Metadata } from "next";
import { siteInfo } from "@/data/site";
import { isLinksConfigured, listLinks } from "@/lib/social/studio-links";

export const metadata: Metadata = {
  title: `${siteInfo.name} — Links`,
  description: `Where to find ${siteInfo.name}.`,
};

/**
 * The public link tree, for the URL in the Instagram bio.
 *
 * Every link goes out through /links/go/[id] rather than straight to its
 * destination, so a tap is counted. Recomputed on each request: staff expect a
 * link they just hid to be gone the moment they check.
 */
export const dynamic = "force-dynamic";

/**
 * Never throws. This page is what someone lands on from an Instagram bio, so a
 * missing table or a Supabase outage has to look like "nothing here yet", not
 * an error page.
 */
async function readLinks() {
  if (!isLinksConfigured()) return [];
  try {
    return await listLinks({ activeOnly: true });
  } catch (error) {
    console.error("Public link tree could not be read:", error);
    return [];
  }
}

export default async function PublicLinksPage() {
  const links = await readLinks();

  return (
    <main className="page-frame flex min-h-screen items-center py-14">
      <div className="mx-auto w-full max-w-md">
        <header className="text-center">
          <p className="font-display text-[2.4rem] leading-none tracking-[-0.05em] text-[#201d17]">
            {siteInfo.name}
          </p>
          <p className="mt-3 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8d7a5c]">
            {siteInfo.collection}
          </p>
        </header>

        <nav aria-label="Our links" className="mt-10 space-y-3">
          {links.map((link) => (
            <a
              key={link.id}
              href={`/links/go/${link.id}`}
              className="flex min-h-14 items-center justify-center rounded-full border border-black/8 bg-white px-6 text-center text-sm font-semibold text-[#201d17] shadow-[0_10px_30px_rgba(32,29,23,0.05)] transition hover:border-black/20 hover:bg-[#f7f2ea]"
            >
              {link.title}
            </a>
          ))}
        </nav>

        {links.length === 0 ? (
          <p className="mt-10 text-center text-sm text-[#8d7a5c]">
            Nothing here yet — check back soon.
          </p>
        ) : null}
      </div>
    </main>
  );
}
