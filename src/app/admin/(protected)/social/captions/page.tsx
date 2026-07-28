import type { Metadata } from "next";
import { requirePermission } from "@/lib/staff-auth";
import { isKimiConfigured } from "@/lib/social/kimi";
import { CaptionStudio } from "./caption-studio";

export const metadata: Metadata = { title: "Caption Generator" };

export default async function CaptionsPage() {
  await requirePermission("social", "/admin/social/captions");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
          Captions
        </p>
        <h3 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
          Caption generator
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5d574f]">
          Write the idea once and get a caption tuned to each network — hook
          length, hashtag count and tone all differ per platform. Use this when
          you already have your own photo; Studio writes captions for images it
          generates itself.
        </p>
      </div>

      {isKimiConfigured() ? (
        <CaptionStudio />
      ) : (
        <div className="rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-5 py-6 text-sm leading-7 text-[#8b5e1d]">
          <p className="font-semibold">Kimi is not connected.</p>
          <p className="mt-2">
            Add <code className="mx-1">MOONSHOT_API_KEY</code> to the environment,
            then restart, and the generator will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
