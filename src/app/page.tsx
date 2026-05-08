import Image from "next/image";
import Link from "next/link";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { getProductsBySlugs } from "@/data/products";
import { getStorefrontAvailabilityLabel } from "@/lib/product-availability";
import { homeContent, siteInfo } from "@/data/site";
import { getCatalogCardImageSrc } from "@/lib/product-images";
import { formatMoney } from "@/lib/money";

const collectionProducts = getProductsBySlugs([
  "body-cleanse-shower-gel-lemongrass-malaya-230ml",
  "reed-diffuser-lemongrass-malaya-230ml",
  "calm-mousseline-lemongrass-malaya-60ml",
  "essential-oil-lemongrass-malaya-10ml",
]);

/** Order matches `homeContent.services.offerings`: Oils, ESG & CSR, Experiences */
const offeringVisuals = [
  "/assets/brand/service-oils.jpg",
  "/assets/brand/service-esg-csr.jpg",
  "/assets/brand/service-experience.jpg",
];

/** Order matches `homeContent.feature.cards`: Quality, Innovation, Community, Sustainability */
const whyChooseUsVisuals = [
  "/assets/brand/value-quality.jpg",
  "/assets/brand/value-innovation.jpg",
  "/assets/brand/value-community.jpg",
  "/assets/brand/value-sustainability.jpg",
];

const collectionCardShells = [
  "rounded-[2.4rem_1.55rem_2.1rem_1.7rem]",
  "rounded-[1.8rem_2.35rem_1.7rem_2.15rem]",
  "rounded-[2.2rem_1.7rem_2.45rem_1.45rem]",
  "rounded-[1.7rem_2.2rem_1.95rem_2.35rem]",
];

const featuredCardTreatments = [
  {
    surface: "linear-gradient(180deg,#fbf5e2 0%,#efe2cf 100%)",
    artwork:
      "radial-gradient(circle at 24% 18%,rgba(255,223,126,0.74),transparent 32%),linear-gradient(110deg,transparent 0 56%,rgba(150,167,118,0.16) 56% 57%,transparent 57% 100%),linear-gradient(110deg,transparent 0 68%,rgba(150,167,118,0.12) 68% 69%,transparent 69% 100%),linear-gradient(110deg,transparent 0 82%,rgba(150,167,118,0.09) 82% 83%,transparent 83% 100%),radial-gradient(ellipse at 35% 92%,rgba(244,220,170,0.38),transparent 40%)",
  },
  {
    surface: "linear-gradient(180deg,#fbefda 0%,#efdfc3 100%)",
    artwork:
      "radial-gradient(circle at 76% 20%,rgba(248,198,96,0.66),transparent 30%),linear-gradient(166deg,transparent 0 60%,rgba(120,96,59,0.16) 60% 61%,transparent 61% 100%),linear-gradient(164deg,transparent 0 69%,rgba(120,96,59,0.12) 69% 70%,transparent 70% 100%),linear-gradient(162deg,transparent 0 79%,rgba(120,96,59,0.09) 79% 80%,transparent 80% 100%),radial-gradient(ellipse at 22% 90%,rgba(255,238,190,0.32),transparent 38%)",
  },
  {
    surface: "linear-gradient(180deg,#fbf2e1 0%,#eee2d3 100%)",
    artwork:
      "radial-gradient(circle at 50% 16%,rgba(255,223,140,0.76),transparent 30%),linear-gradient(179deg,transparent 0 61%,rgba(202,180,147,0.24) 61% 62%,transparent 62% 100%),linear-gradient(179deg,transparent 0 73%,rgba(202,180,147,0.18) 73% 74%,transparent 74% 100%),linear-gradient(179deg,transparent 0 85%,rgba(202,180,147,0.14) 85% 86%,transparent 86% 100%),radial-gradient(circle at 22% 84%,rgba(255,255,255,0.54),transparent 22%),radial-gradient(circle at 78% 84%,rgba(224,204,176,0.3),transparent 24%),radial-gradient(ellipse at 50% 88%,rgba(245,228,205,0.52),transparent 36%)",
  },
  {
    surface: "linear-gradient(180deg,#faf4e2 0%,#efe5d8 100%)",
    artwork:
      "radial-gradient(circle at 72% 18%,rgba(225,239,187,0.66),transparent 30%),radial-gradient(circle at 24% 18%,rgba(255,224,144,0.5),transparent 34%),radial-gradient(circle at 82% 78%,rgba(216,201,161,0.18),transparent 22%),radial-gradient(ellipse at 58% 82%,transparent 68%,rgba(145,167,132,0.14) 69% 71%,transparent 72%),radial-gradient(ellipse at 50% 84%,transparent 74%,rgba(145,167,132,0.11) 75% 77%,transparent 78%),radial-gradient(ellipse at 42% 86%,transparent 80%,rgba(145,167,132,0.08) 81% 83%,transparent 84%)",
  },
] as const;

export default function Home() {
  return (
    <div className="pb-24">
      <section id="welcome" className="border-b border-[color:var(--line)] py-4 sm:py-6">
        <div className="page-frame">
          <div className="wide-shell relative overflow-hidden rounded-[2rem] border border-black/8 bg-[#f7f2ea] shadow-[0_30px_80px_rgba(31,28,24,0.06)] sm:rounded-[2.5rem]">
            {/* Mobile / tablet: full-bleed hero photo behind headline + cards */}
            <div className="pointer-events-none absolute inset-0 z-0 lg:hidden">
              <Image
                src="/assets/brand/hero-portrait.png"
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[rgba(12,10,8,0.72)] via-[rgba(12,10,8,0.38)] to-[rgba(12,10,8,0.82)]" />
            </div>

            <div className="relative z-10 grid min-h-[min(88vh,780px)] grid-cols-1 lg:min-h-[calc(100vh-8rem)] lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
              <div className="flex items-center bg-transparent px-5 py-12 sm:px-9 sm:py-14 lg:bg-[#f7f2ea] lg:px-14 xl:px-16">
                <div className="w-full max-w-xl space-y-8 lg:space-y-10">
                  <div className="space-y-4">
                    <p className="font-display text-[1.35rem] italic text-[#f0e6d4] lg:text-[#7a6851]">
                      {siteInfo.collection}
                    </p>
                    <h1 className="whitespace-pre-line text-[3rem] font-black leading-[0.88] tracking-[-0.08em] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.35)] sm:text-[4.5rem] lg:text-[4.9rem] lg:text-[#201d17] lg:drop-shadow-none">
                      {homeContent.hero.title}
                    </h1>
                    <p className="max-w-lg text-[1rem] leading-8 text-white/90 sm:text-[1.05rem] lg:text-[#5d574f]">
                      {homeContent.vision.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/category/all-products"
                      className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#201d17] px-6 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                    >
                      Shop the Range
                    </Link>
                    <Link
                      href="/#about"
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/45 bg-white/10 px-6 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm lg:border-black/10 lg:bg-transparent lg:text-[#201d17] lg:backdrop-blur-none"
                    >
                      Our Mission
                    </Link>
                  </div>
                </div>
              </div>

              <div className="relative flex min-h-0 flex-col lg:min-h-full lg:border-l lg:border-black/8 lg:bg-[#e8dccb]">
                <div className="relative hidden min-h-[28rem] flex-1 overflow-hidden lg:block lg:min-h-0">
                  <Image
                    src="/assets/brand/hero-portrait.png"
                    alt="Aerthera hero visual"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 52vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(22,17,12,0.45)] via-transparent to-transparent" />
                </div>

                <div className="relative mt-6 px-4 pb-10 pt-2 sm:px-6 lg:absolute lg:inset-x-6 lg:bottom-6 lg:mt-0 lg:px-0 lg:pb-0 lg:pt-0">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
                    <article className="rounded-[1.75rem] border border-white/15 bg-[rgba(17,17,14,0.5)] p-6 text-white backdrop-blur-md lg:border-transparent lg:bg-[rgba(17,17,14,0.68)] lg:backdrop-blur-xl">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#e8dcc8] lg:text-[#d1c5ae]">
                        Explore the Collection
                      </p>
                      <p className="mt-3 max-w-sm text-sm leading-7 text-white/90 lg:text-white/80">
                        {homeContent.collection.description.split("\n").join(" ")}
                      </p>
                    </article>

                    <article className="rounded-[1.75rem] border border-white/10 bg-[#fff1b8]/92 p-6 text-[#171717] shadow-[0_16px_40px_rgba(31,28,24,0.14)] backdrop-blur-sm lg:border-transparent lg:bg-[#fff1b8] lg:backdrop-blur-none">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d6d3f]">
                        Handmade with Love
                      </p>
                      <p className="mt-3 font-display text-[1.9rem] leading-[1.02]">
                        {homeContent.handmade.description}
                      </p>
                    </article>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="shop" className="relative overflow-hidden bg-[#11110e] py-20 text-[#f7f3ea] sm:py-24">
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="/assets/video/poster.jpg"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.74] saturate-[1.18] brightness-[0.9]"
          aria-hidden="true"
        >
          <source src="/assets/video/atelier.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,17,14,0.58),rgba(17,17,14,0.38)_30%,rgba(17,17,14,0.5)_62%,rgba(17,17,14,0.72))]" />
        <div className="absolute inset-y-0 left-[-12rem] w-[26rem] rounded-full bg-[#fff2b6]/10 blur-3xl" />
        <div className="page-frame">
          <div className="wide-shell relative space-y-12">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10">
              <div className="space-y-4">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[#b4a993]">
                  Featured Shop
                </p>
                <h2 className="font-display text-[2.85rem] leading-[0.92] tracking-[-0.05em] sm:text-[4.4rem]">
                  {homeContent.collection.title}
                </h2>
              </div>
              <div className="space-y-5 lg:pl-10">
                <p className="max-w-2xl text-[1rem] leading-8 text-[#d6d1c8]">
                  {homeContent.collection.description.split("\n").join(" ")}
                </p>
                <Link
                  href="/category/all-products"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ffe9a8]/70 bg-[#fff2b6] px-6 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[#171717] shadow-[0_18px_32px_rgba(255,242,182,0.18)] transition-colors duration-300 hover:bg-[#ffe99f]"
                >
                  {homeContent.collection.buttonLabel}
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 md:hidden">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#d8cdb9]">
                  Swipe to explore more
                </p>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#d8cdb9]">
                  {collectionProducts.length} featured products
                </span>
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-[linear-gradient(270deg,rgba(17,17,14,0.92),rgba(17,17,14,0))] md:hidden" />
                <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 pr-10 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:grid md:overflow-visible md:pb-0 md:pr-0 md:[scrollbar-width:auto] md:[-ms-overflow-style:auto] md:grid-cols-2 xl:grid-cols-4">
                  {collectionProducts.map((product, index) => {
                    const availabilityLabel = getStorefrontAvailabilityLabel(product);
                    const isAvailableNow = availabilityLabel === "Available";
                    const treatment =
                      featuredCardTreatments[index % featuredCardTreatments.length];

                    return (
                      <article
                        data-hover-preview="false"
                        key={product.slug}
                        className={`${collectionCardShells[index % collectionCardShells.length]} group relative flex min-w-[74vw] snap-start flex-col overflow-hidden border border-[#e0d1b6]/80 p-5 shadow-[0_26px_80px_rgba(0,0,0,0.22)] sm:min-w-[62vw] md:min-w-0`}
                        style={{
                          backgroundImage: treatment.surface,
                        }}
                      >
                        <div
                          className="pointer-events-none absolute inset-0"
                          style={{
                            backgroundImage: treatment.artwork,
                          }}
                        />
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.38),rgba(255,255,255,0.05)_28%,rgba(74,56,27,0.06)_100%)] transition duration-500 group-hover:opacity-90 group-data-[hover-preview=true]:opacity-90" />

                        <Link href={`/product-page/${product.slug}`} className="relative block">
                          <div className="relative h-[18rem] sm:h-[19rem]">
                            <Image
                              src={getCatalogCardImageSrc(product)}
                              alt={product.name}
                              fill
                              sizes="(max-width: 640px) 74vw, (max-width: 768px) 62vw, (max-width: 1024px) 50vw, 25vw"
                              className="object-contain px-2 py-1 transition-transform duration-500 group-hover:scale-[1.03] sm:px-3"
                            />
                          </div>
                        </Link>

                        <div className="relative mt-1 flex flex-1 flex-col space-y-3 px-1 pb-1">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#826d4b]">
                              {product.categoryLabel}
                            </span>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${
                                isAvailableNow
                                  ? "border-[#b9d3ba] bg-[#edf7ed] text-[#33563a]"
                                  : "border-[#e1cfb2] bg-[#f3e7d6] text-[#7b5e35]"
                              }`}
                            >
                              {availabilityLabel}
                            </span>
                          </div>
                          <Link
                            href={`/product-page/${product.slug}`}
                            className="block text-[1.08rem] font-semibold leading-6 text-[#241d14]"
                          >
                            {product.name}
                          </Link>
                          <p className="text-sm leading-6 text-[#655846]">{product.excerpt}</p>
                          <div className="flex items-center justify-between gap-3 pt-1">
                            <p className="text-sm font-medium text-[#31261a]">
                              {product.compareAtPrice ? (
                                <span className="mr-2 text-[#8f816b] line-through">
                                  {formatMoney(product.compareAtPrice)}
                                </span>
                              ) : null}
                              <span>{formatMoney(product.price)}</span>
                            </p>
                            {product.badge ? (
                              <span className="rounded-full border border-[#a38a59]/20 bg-[#c4b062]/12 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#7d663c]">
                                {product.badge}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="relative mt-6">
                          <AddToCartButton
                            productSlug={product.slug}
                            label={isAvailableNow ? "Add to Cart" : "Pre-Order"}
                            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[#231b13] bg-[#231b13] px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#f8f0de] shadow-[0_18px_32px_rgba(35,27,19,0.16)] transition-colors duration-300 hover:bg-[#17120d]"
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="about"
        className="relative overflow-hidden bg-[linear-gradient(180deg,#f3ecdf,#f7f2ea_42%,#f6efe4)] py-20 sm:py-24"
      >
        <div className="absolute inset-y-0 right-[-10rem] w-[26rem] rounded-full bg-[#d8c7a2]/20 blur-3xl" />
        <div className="page-frame">
          <div className="wide-shell relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.92fr)] lg:items-stretch lg:gap-10">
            <div className="flex h-full flex-col gap-8 lg:pr-8">
              <div className="space-y-4">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[#8d7a5c]">
                  {homeContent.vision.title}
                </p>
                <h2 className="font-display text-[3.2rem] leading-[0.95] tracking-[-0.05em] text-[#201d17] sm:text-[4rem]">
                  {homeContent.vision.subtitle}
                </h2>
                <p className="max-w-2xl text-[1.06rem] leading-8 text-[#51483d]">
                  {homeContent.vision.description}
                </p>
              </div>

              <p className="max-w-2xl text-[0.98rem] leading-8 text-[#6a6258]">
                {homeContent.vision.body}
              </p>

              <Link
                href="/#feature"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#201d17] px-6 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-white"
              >
                {homeContent.vision.buttonLabel}
              </Link>
            </div>

            <div className="flex h-full">
              <article className="flex h-full w-full flex-col overflow-hidden rounded-[2rem] border border-black/8 bg-[#fffdf9] shadow-[0_20px_40px_rgba(31,28,24,0.05)]">
                <div className="relative h-56 overflow-hidden sm:h-72 lg:min-h-0 lg:flex-1 lg:h-auto">
                  <Image
                    src="/assets/brand/lemongrass-field-malaysia.jpg"
                    alt="Lemongrass field in Malaysia"
                    fill
                    sizes="(max-width: 1024px) 100vw, 38vw"
                    className="object-cover"
                  />
                </div>
                <div className="space-y-4 p-5 sm:p-6 lg:shrink-0">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c]">
                    {homeContent.handmade.title.split("\n").join(" ")}
                  </p>
                  <p className="font-display text-[1.8rem] leading-[1.02] text-[#201d17] sm:text-[2rem]">
                    {homeContent.handmade.description}
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="bg-[#ebe4d7] py-20 sm:py-24">
        <div className="page-frame">
          <div className="wide-shell space-y-10">
            <div className="max-w-4xl space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[#8d7a5c]">
                {homeContent.services.title}
              </p>
              <h2 className="font-display text-[3rem] leading-[0.96] tracking-[-0.05em] text-[#201d17] sm:text-[3.8rem]">
                {homeContent.services.subtitle}
              </h2>
              <p className="max-w-3xl text-[1rem] leading-8 text-[#5d574f]">
                {homeContent.services.description}
              </p>
            </div>

            <div className="grid gap-5 sm:gap-6 lg:grid-cols-3">
              {homeContent.services.offerings.map((offering, index) => (
                <article
                  key={offering.title}
                  className="overflow-hidden rounded-[1.75rem] border border-black/8 bg-[#fffdf9] shadow-[0_20px_40px_rgba(31,28,24,0.05)] sm:rounded-[2rem]"
                >
                  <div className="relative h-44 overflow-hidden sm:h-56">
                    <Image
                      src={offeringVisuals[index] ?? offeringVisuals[0]}
                      alt={offering.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 30vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="space-y-4 p-5 sm:p-6">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c]">
                      Offering
                    </p>
                    <h3 className="font-display text-[2rem] leading-[0.96] text-[#201d17]">
                      {offering.title}
                    </h3>
                    <p className="text-sm leading-7 text-[#5d574f]">{offering.subtitle}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="opening-hours" className="py-20 sm:py-24">
        <div className="page-frame">
          <div className="wide-shell grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <article className="rounded-[2rem] bg-[#fffdf9] p-7 shadow-[0_24px_60px_rgba(31,28,24,0.06)] sm:p-10">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[#8d7a5c]">
                {homeContent.services.workshopTitle}
              </p>
              <h2 className="mt-4 font-display text-[3rem] leading-[0.96] tracking-[-0.05em] text-[#201d17] sm:text-[3.8rem]">
                {homeContent.services.workshopSubtitle}
              </h2>
              <p className="mt-4 max-w-2xl text-[1rem] leading-8 text-[#5d574f]">
                Explore workshops and guided sessions designed to connect scent,
                space, and personal ritual through practical discovery.
              </p>
              <Link
                href="/category/all-products"
                className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-[#201d17] px-6 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-white"
              >
                {homeContent.services.workshopButtonLabel}
              </Link>
            </article>

            <article className="rounded-[2rem] border border-black/8 bg-[#ece3d5] p-7 sm:p-10">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[#8d7a5c]">
                {homeContent.hoursTitle}
              </p>
              <div className="mt-6 space-y-5">
                {homeContent.hours.map((hours) => (
                  <div
                    key={hours.label}
                    className="flex items-end justify-between gap-4 border-b border-black/8 pb-4 last:border-b-0 last:pb-0"
                  >
                    <p className="text-[1.05rem] font-semibold text-[#201d17]">
                      {hours.label}
                    </p>
                    <p className="text-sm text-[#5d574f]">{hours.value}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="feature" className="bg-[#11110e] py-20 text-[#f7f3ea] sm:py-24">
        <div className="page-frame">
          <div className="wide-shell space-y-10">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[#b4a993]">
                Why Choose Us
              </p>
              <h2 className="font-display text-[3.2rem] leading-[0.95] tracking-[-0.05em] sm:text-[4rem]">
                {homeContent.feature.title}
              </h2>
              <p className="max-w-3xl text-[1rem] leading-8 text-white/72">
                {homeContent.feature.description}
              </p>
            </div>

            <div className="grid gap-5 sm:gap-6 md:grid-cols-2 xl:grid-cols-4">
              {homeContent.feature.cards.map((card, index) => (
                <article
                  key={card.title}
                  className="flex flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] shadow-[0_20px_48px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:rounded-[2rem]"
                >
                  <div className="relative h-44 overflow-hidden sm:h-56 lg:h-60">
                    <Image
                      src={whyChooseUsVisuals[index] ?? whyChooseUsVisuals[0]}
                      alt={card.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col space-y-2 p-5 sm:p-6">
                    <h3 className="text-[1.25rem] font-semibold leading-tight tracking-[-0.03em] text-white">
                      {card.title}
                    </h3>
                    <p className="text-sm font-medium text-[#d1c5ae]">{card.subtitle}</p>
                    <p className="mt-3 flex-1 text-sm leading-7 text-white/72">{card.description}</p>
                    {card.buttonLabel && index === homeContent.feature.cards.length - 1 ? (
                      <Link
                        href="/category/all-products"
                        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#fff2b6] px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#171717]"
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
