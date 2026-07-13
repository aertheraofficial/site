import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/data/products";
import { homeContent, siteInfo } from "@/data/site";
import { getProductsWithStock } from "@/lib/product-stock";

const FEATURED_SLUGS = [
  "body-cleanse-shower-gel-lemongrass-malaya-230ml",
  "reed-diffuser-lemongrass-malaya-230ml",
  "calm-mousseline-lemongrass-malaya-60ml",
  "essential-oil-lemongrass-malaya-10ml",
];

/** Order matches `homeContent.services.offerings`: Oils, ESG & CSR, Experiences */
const offeringVisuals = [
  "/assets/brand/service-oils.jpg",
  "/assets/brand/service-esg-csr.jpg",
  "/assets/brand/service-experience.jpg",
];

/** Visual for each "Why Choose Us" card (titles from `homeContent.feature.cards`). */
const whyChooseUsVisualByTitle: Record<string, string> = {
  Quality: "/assets/brand/value-quality.jpg",
  Innovation: "/assets/brand/value-innovation.jpg",
  Community: "/assets/brand/value-community.jpg",
  Sustainability: "/assets/brand/value-sustainability.jpg",
};

export const revalidate = 60;

/** Shared eyebrow label — one consistent treatment across every section. */
function Eyebrow({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "dark" }) {
  return (
    <p
      className={`text-[0.7rem] font-semibold uppercase tracking-[0.3em] ${
        tone === "dark" ? "text-[#b4a993]" : "text-[#8d7a5c]"
      }`}
    >
      {children}
    </p>
  );
}

export default async function Home() {
  const allProducts = await getProductsWithStock();
  const collectionProducts = FEATURED_SLUGS.map((slug) =>
    allProducts.find((product) => product.slug === slug),
  ).filter((product): product is Product => product !== undefined);

  return (
    <div className="pb-24">
      {/* ── Hero ─────────────────────────────────────────────
          Calm editorial split: quiet type on the left, a single
          full-bleed image on the right. No overlay cards, no glow. */}
      <section id="welcome" className="border-b border-[color:var(--line)]">
        <div className="page-frame">
          <div className="wide-shell grid min-h-[calc(100vh-6rem)] grid-cols-1 items-stretch gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:py-20">
            <div className="flex flex-col justify-center gap-8">
              <Eyebrow>{siteInfo.collection}</Eyebrow>
              <h1 className="whitespace-pre-line font-display text-[3.4rem] font-medium leading-[0.98] tracking-[-0.02em] text-[#201d17] sm:text-[4.6rem] lg:text-[5.2rem]">
                {homeContent.hero.title}
              </h1>
              <p className="max-w-md text-[1.05rem] leading-8 text-[#5d574f]">
                Premium wellness rituals — inspired by nature, elevated through design.
              </p>
              <div className="flex flex-wrap items-center gap-5 pt-2">
                <Link
                  href="/products"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#201d17] px-8 text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#2f2a22]"
                >
                  Shop the Range
                </Link>
                <Link
                  href="/#about"
                  className="text-[0.82rem] font-semibold uppercase tracking-[0.16em] text-[#201d17] underline-offset-8 transition hover:underline"
                >
                  Our Mission
                </Link>
              </div>
            </div>

            <div className="relative min-h-[24rem] overflow-hidden rounded-[2rem] lg:min-h-0">
              <Image
                src="/assets/brand/hero-portrait.png"
                alt="Aerthera Lemongrass Malaya"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 52vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured collection ──────────────────────────────
          Light, uncluttered. Reuses the catalog ProductCard so the
          homepage and shop read as one system. */}
      <section id="shop" className="bg-[var(--canvas)] py-20 sm:py-28">
        <div className="page-frame">
          <div className="wide-shell space-y-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-4">
                <Eyebrow>Featured</Eyebrow>
                <h2 className="font-display text-[2.8rem] leading-[1] tracking-[-0.03em] text-[#201d17] sm:text-[3.6rem]">
                  {homeContent.collection.title}
                </h2>
                <p className="text-[1.02rem] leading-8 text-[#5d574f]">
                  {homeContent.collection.description.split("\n")[0]}
                </p>
              </div>
              <Link
                href="/products"
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full border border-[#201d17]/20 px-7 text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:border-[#201d17] hover:bg-[#201d17] hover:text-white"
              >
                {homeContent.collection.buttonLabel}
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {collectionProducts.map((product) => (
                <ProductCard
                  key={product.slug}
                  product={product}
                  singleSurface
                  showAddToCart
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Mission / provenance ─────────────────────────────
          Botanical-heritage storytelling (the real Malaysian field). */}
      <section id="about" className="bg-[var(--canvas-deep)] py-20 sm:py-28">
        <div className="page-frame">
          <div className="wide-shell grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-6">
              <Eyebrow>{homeContent.vision.subtitle}</Eyebrow>
              <h2 className="font-display text-[2.9rem] leading-[1] tracking-[-0.03em] text-[#201d17] sm:text-[3.8rem]">
                {homeContent.vision.title}
              </h2>
              <p className="max-w-xl text-[1.05rem] leading-8 text-[#51483d]">
                {homeContent.vision.description}
              </p>
              <Link
                href="/#feature"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#201d17] px-8 text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#2f2a22]"
              >
                {homeContent.vision.buttonLabel}
              </Link>
            </div>

            <figure className="overflow-hidden rounded-[2rem]">
              <div className="relative aspect-[4/5] w-full">
                <Image
                  src="/assets/brand/lemongrass-field-malaysia.jpg"
                  alt="Lemongrass field in Malaysia"
                  fill
                  sizes="(max-width: 1024px) 100vw, 48vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-5 text-[0.82rem] uppercase tracking-[0.2em] text-[#8d7a5c]">
                {homeContent.handmade.title.split("\n").join(" ")} — {homeContent.handmade.description}
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ── Solutions ────────────────────────────────────────
          Three uniform cards, one grid, no ornament. */}
      <section id="services" className="bg-[var(--canvas)] py-20 sm:py-28">
        <div className="page-frame">
          <div className="wide-shell space-y-12">
            <div className="max-w-2xl space-y-4">
              <Eyebrow>{homeContent.services.subtitle}</Eyebrow>
              <h2 className="font-display text-[2.8rem] leading-[1] tracking-[-0.03em] text-[#201d17] sm:text-[3.6rem]">
                {homeContent.services.title}
              </h2>
              <p className="text-[1.02rem] leading-8 text-[#5d574f]">
                {homeContent.services.description}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {homeContent.services.offerings.map((offering, index) => (
                <article
                  key={offering.title}
                  className="overflow-hidden rounded-[1.75rem] border border-black/8 bg-[var(--panel)]"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <Image
                      src={offeringVisuals[index] ?? offeringVisuals[0]}
                      alt={offering.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 30vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="space-y-2 p-7">
                    <h3 className="font-display text-[1.9rem] leading-[1.05] text-[#201d17]">
                      {offering.title}
                    </h3>
                    <p className="text-[0.95rem] leading-7 text-[#5d574f]">{offering.subtitle}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Workshops + store hours ──────────────────────────── */}
      <section id="opening-hours" className="bg-[var(--canvas-deep)] py-20 sm:py-28">
        <div className="page-frame">
          <div className="wide-shell grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <article className="rounded-[2rem] border border-black/8 bg-[var(--panel)] p-8 sm:p-11">
              <Eyebrow>{homeContent.services.workshopTitle}</Eyebrow>
              <h2 className="mt-5 font-display text-[2.6rem] leading-[1] tracking-[-0.03em] text-[#201d17] sm:text-[3.4rem]">
                {homeContent.services.workshopSubtitle}
              </h2>
              <p className="mt-5 max-w-xl text-[1.02rem] leading-8 text-[#5d574f]">
                Explore workshops and guided sessions designed to connect scent,
                space, and personal ritual through practical discovery.
              </p>
              <Link
                href="/products"
                className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#201d17] px-8 text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#2f2a22]"
              >
                {homeContent.services.workshopButtonLabel}
              </Link>
            </article>

            <article className="rounded-[2rem] border border-black/8 bg-[var(--panel)] p-8 sm:p-11">
              <Eyebrow>{homeContent.hoursTitle}</Eyebrow>
              <div className="mt-7 space-y-5">
                {homeContent.hours.map((hours) => (
                  <div
                    key={hours.label}
                    className="flex items-end justify-between gap-4 border-b border-black/8 pb-4 last:border-b-0 last:pb-0"
                  >
                    <p className="text-[1.02rem] font-semibold text-[#201d17]">{hours.label}</p>
                    <p className="text-[0.95rem] text-[#5d574f]">{hours.value}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ── Why choose us ────────────────────────────────────
          The single restrained dark moment (B&O). Calm, no glow. */}
      <section id="feature" className="bg-[#141310] py-20 text-[#f7f3ea] sm:py-28">
        <div className="page-frame">
          <div className="wide-shell space-y-12">
            <div className="max-w-2xl space-y-4">
              <Eyebrow tone="dark">Why Choose Us</Eyebrow>
              <h2 className="font-display text-[2.9rem] leading-[1] tracking-[-0.03em] sm:text-[3.8rem]">
                {homeContent.feature.title}
              </h2>
              <p className="text-[1.02rem] leading-8 text-white/70">
                {homeContent.feature.description}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {homeContent.feature.cards.map((card, index) => (
                <article
                  key={card.title}
                  className="flex flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03]"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <Image
                      src={whyChooseUsVisualByTitle[card.title] ?? "/assets/brand/value-quality.jpg"}
                      alt={card.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                      className="object-cover"
                      priority={index === 0}
                      loading={index === 0 ? "eager" : "lazy"}
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-7">
                    <h3 className="font-display text-[1.7rem] leading-[1.05] text-white">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-[0.92rem] leading-6 text-white/68">
                      {card.subtitle}
                    </p>
                    {card.buttonLabel && index === homeContent.feature.cards.length - 1 ? (
                      <Link
                        href="/products"
                        className="mt-auto inline-flex min-h-11 items-center justify-center rounded-full bg-[#f7f3ea] px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#141310] transition hover:bg-white"
                      >
                        {card.buttonLabel}
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
