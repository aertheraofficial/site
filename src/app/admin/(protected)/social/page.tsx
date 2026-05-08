import { getSocialBrandContext } from "@/lib/social/brand";
import { readSocialContent, type SocialPostStatus } from "@/lib/social/store";
import { SocialAgentForm } from "./social-agent-form";

type SocialPageProps = {
  searchParams: Promise<{
    published?: string;
    adCreated?: string;
    error?: string;
  }>;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusClasses(status: SocialPostStatus) {
  switch (status) {
    case "approved":
    case "published":
    case "manual_posted":
      return "border-[#8cc8a4] bg-[#e9f7ee] text-[#256542]";
    case "scheduled":
      return "border-[#a5bfd8] bg-[#eef5fb] text-[#285b7d]";
    case "rejected":
    case "failed":
      return "border-[#e6b4b4] bg-[#fff0ef] text-[#9b3d32]";
    default:
      return "border-[#d7c7aa] bg-[#f8f1e4] text-[#8b5e1d]";
  }
}

export default async function AdminSocialPage({ searchParams }: SocialPageProps) {
  const { published, adCreated, error } = await searchParams;
  const [store, brandContext] = await Promise.all([
    readSocialContent(),
    Promise.resolve(getSocialBrandContext()),
  ]);
  const postedCount = store.drafts.filter(
    (draft) => draft.status === "manual_posted" || draft.status === "published",
  ).length;
  const productOptions = brandContext.productFacts;
  const latestDraft =
    [...store.drafts].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    )[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)]">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c]">
            Attempts
          </p>
          <p className="mt-3 font-display text-[2.6rem] leading-none tracking-[-0.05em] text-[#201d17]">
            {store.drafts.length}
          </p>
          <p className="mt-2 text-sm text-[#5d574f]">
            Each attempt generates, reviews, and creates a paused paid ad.
          </p>
        </article>

        <article className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)]">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c]">
            Posted
          </p>
          <p className="mt-3 font-display text-[2.6rem] leading-none tracking-[-0.05em] text-[#201d17]">
            {postedCount}
          </p>
          <p className="mt-2 text-sm text-[#5d574f]">Published or marked manually posted.</p>
        </article>
      </section>

      <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
              Social Agent
            </p>
            <h2 className="mt-3 font-display text-[2.5rem] leading-[0.95] tracking-[-0.05em] text-[#201d17]">
              Generate, review, create ads
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5d574f]">
              Pick one product. The agent writes the paid ad, checks brand guardrails, creates the
              campaign/ad set/creative/ad in Meta for Facebook and Instagram, and leaves everything
              paused so it cannot spend until you activate it.
            </p>
          </div>

          <SocialAgentForm productOptions={productOptions} />
        </div>

        {published ? (
          <p
            data-testid="social-feedback-success"
            className="mt-6 rounded-[1.25rem] border border-[#8cc8a4] bg-[#e9f7ee] px-4 py-3 text-sm leading-6 text-[#256542]"
          >
            Ad generated, reviewed, and published through Meta.
          </p>
        ) : null}
        {adCreated ? (
          <p
            data-testid="social-feedback-success"
            className="mt-6 rounded-[1.25rem] border border-[#8cc8a4] bg-[#e9f7ee] px-4 py-3 text-sm leading-6 text-[#256542]"
          >
            Paid ad generated, reviewed, and created in Meta as paused.
          </p>
        ) : null}
        {error ? (
          <p
            data-testid="social-feedback-error"
            className="mt-6 rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-4 py-3 text-sm leading-6 text-[#8b5e1d]"
          >
            {error === "meta-token-expired"
              ? "Your Meta Page access token has expired or was revoked. In Meta (Graph API Explorer or Business settings), generate a new Page access token with the right permissions, set META_PAGE_ACCESS_TOKEN in the Vercel project (Production), then try again. Long‑lived Page tokens last about 60 days; set a calendar reminder to refresh."
              : error === "review-blocked"
              ? "AI generated an ad, but review blocked publishing. See the latest result below."
              : error === "unsupported-platform"
              ? "Immediate publishing is only connected for Facebook and Instagram right now."
              : error === "meta-billing-missing"
              ? "Meta ad account billing is not ready. Add a valid payment method in Meta Billing and Payment Center for this ad account, then try again. See the latest result below for details."
              : error === "meta-ad-failed"
              ? "Meta ad creation failed. See the latest result below for details."
              : error === "meta-publish-failed"
              ? "Meta publishing failed. See the latest result below for details."
              : error}
          </p>
        ) : null}
      </section>

      <section
        data-testid="social-latest-result"
        className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7"
      >
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
          Latest Result
        </p>
        <h2 className="mt-3 font-display text-[2.5rem] leading-[0.95] tracking-[-0.05em] text-[#201d17]">
          Last generated ad
        </h2>

        <div className="mt-8">
          {!latestDraft ? (
            <div
              data-testid="social-latest-empty"
              className="rounded-[1.75rem] border border-dashed border-black/10 bg-[#f7f2ea] px-6 py-10 text-center text-sm leading-7 text-[#5d574f]"
            >
              No ad has been generated yet.
            </div>
          ) : (
            <article className="rounded-[1.75rem] border border-black/8 bg-[#fcfaf6] p-5 shadow-[0_16px_48px_rgba(32,29,23,0.04)] sm:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${getStatusClasses(latestDraft.status)}`}>
                  {latestDraft.status.replace("_", " ")}
                </span>
                <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a6258]">
                  {latestDraft.platform}
                </span>
                <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a6258]">
                  {formatDateTime(latestDraft.createdAt)}
                </span>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                    Caption
                  </p>
                  <textarea
                    readOnly
                    value={`${latestDraft.caption}\n\n${latestDraft.hashtags.join(" ")}`}
                    className="mt-2 min-h-40 w-full rounded-[1.25rem] border border-black/8 bg-white px-4 py-3 text-sm leading-7 text-[#201d17] outline-none"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                      Visual Brief
                    </p>
                    <p className="mt-2 rounded-[1.25rem] border border-black/8 bg-white px-4 py-3 text-sm leading-7 text-[#5d574f]">
                      {latestDraft.visualBrief}
                    </p>
                  </div>

                </div>
              </div>

              {latestDraft.reviewerFlags.length > 0 ? (
                <div className="mt-5 rounded-[1.25rem] border border-[#e6b4b4] bg-[#fff0ef] px-4 py-3 text-sm leading-6 text-[#9b3d32]">
                  {latestDraft.reviewerFlags.join(" ")}
                </div>
              ) : (
                <div className="mt-5 rounded-[1.25rem] border border-[#8cc8a4] bg-[#e9f7ee] px-4 py-3 text-sm leading-6 text-[#256542]">
                  {latestDraft.complianceNotes.join(" ")}
                </div>
              )}

              {latestDraft.publishedUrl || latestDraft.approvalNotes ? (
                <div className="mt-5 rounded-[1.25rem] border border-black/8 bg-white px-4 py-3 text-sm leading-6 text-[#5d574f]">
                  {latestDraft.approvalNotes ? <p>{latestDraft.approvalNotes}</p> : null}
                  {latestDraft.publishedUrl ? (
                    <a
                      href={latestDraft.publishedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex font-semibold text-[#201d17] underline underline-offset-4"
                    >
                      {latestDraft.modelOutput?.metaAdIds ? "Open in Ads Manager" : "Open published post"}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
