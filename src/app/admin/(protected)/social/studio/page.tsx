import type { Metadata } from "next";
import { requirePermission } from "@/lib/staff-auth";
import { describeStudioSetup } from "@/lib/social/studio-scenes";
import { getProductsWithStock } from "@/lib/product-stock";
import { SceneComposer } from "./scene-composer";

export const metadata: Metadata = { title: "Social Studio" };

export default async function SocialStudioPage() {
  await requirePermission("social", "/admin/social/studio");
  const setup = describeStudioSetup();

  // The catalog, so staff can compose from a product the shop already sells
  // instead of hunting for the photo on their phone.
  const products = (await getProductsWithStock())
    .filter((product) => product.image)
    .map((product) => ({
      slug: product.slug,
      name: product.name,
      size: product.size,
      image: product.image,
    }));

  // Both halves are needed and they fail for different reasons, so say which
  // one is missing rather than a single unhelpful "not configured".
  const missing = [
    setup.kimi ? null : "Kimi (MOONSHOT_API_KEY) reads the product and writes the art direction",
    setup.gemini ? null : "Gemini (GEMINI_API_KEY) draws the scene",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
          Studio
        </p>
        <h3 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
          Product scenes
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5d574f]">
          Pick a product you already sell — or upload a plain photo — and get a
          styled shot back. Kimi reads the label and writes the art direction;
          Gemini composites the product into the scene, keeping its shape and
          printed text unchanged.
        </p>
      </div>

      {missing.length > 0 ? (
        <div className="rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-5 py-4 text-sm leading-7 text-[#8b5e1d]">
          <p className="font-semibold">Studio is not connected yet.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <SceneComposer products={products} />
      )}
    </div>
  );
}
