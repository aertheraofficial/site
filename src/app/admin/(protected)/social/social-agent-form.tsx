"use client";

import { useFormStatus } from "react-dom";
import { generateReviewCreateMetaAdAction } from "@/app/admin/actions";
import type { BrandProductFact } from "@/lib/social/brand";

type SocialAgentFormProps = {
  productOptions: BrandProductFact[];
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      data-testid="social-submit"
      disabled={pending}
      aria-disabled={pending}
      className="mt-5 inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#201d17] px-6 text-[0.76rem] font-semibold uppercase tracking-[0.2em] text-white transition hover:opacity-92 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? (
        <span
          aria-hidden="true"
          className="size-4 rounded-full border-2 border-white/35 border-t-white motion-safe:animate-spin"
        />
      ) : null}
      <span>{pending ? "Creating Ad..." : "Generate Paid Ad"}</span>
    </button>
  );
}

export function SocialAgentForm({ productOptions }: SocialAgentFormProps) {
  return (
    <form
      action={generateReviewCreateMetaAdAction}
      className="rounded-[1.75rem] border border-black/8 bg-[#fcfaf6] p-5 sm:p-6"
      data-testid="social-agent-form"
    >
      <input type="hidden" name="platform" value="instagram" />
      <div className="rounded-[1.15rem] border border-[#d6c2a0] bg-white px-4 py-3 text-sm leading-6 text-[#5d574f]">
        Creates a paused Meta ad with Facebook Feed and Instagram Feed/Explore placements. The ad uses
        a Shop Now button linked to the selected product page and will not spend until activated in Ads
        Manager.
      </div>

      <label className="mt-5 block">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
          Placements
        </span>
        <select
          data-testid="social-platform"
          disabled
          defaultValue="facebook-instagram"
          className="mt-2 w-full rounded-[1.25rem] border border-black/8 bg-white px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59]"
        >
          <option value="facebook-instagram">Facebook + Instagram</option>
        </select>
      </label>

      <label className="mt-5 block">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
          Product
        </span>
        <select
          name="productSlug"
          defaultValue={productOptions[0]?.slug}
          data-testid="social-product"
          className="mt-2 w-full rounded-[1.25rem] border border-black/8 bg-white px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59]"
        >
          {productOptions.map((product) => (
            <option key={product.slug} value={product.slug}>
              {product.shortName} · {product.priceLabel}
            </option>
          ))}
        </select>
      </label>

      <p
        aria-live="polite"
        className="mt-4 min-h-6 text-sm leading-6 text-[#5d574f]"
        data-testid="social-submit-status"
      >
        <SubmitStatusText />
      </p>

      <SubmitButton />
    </form>
  );
}

function SubmitStatusText() {
  const { pending } = useFormStatus();

  return pending
    ? "Generating the ad, checking brand guardrails, and creating a paused Meta ad."
    : "";
}
