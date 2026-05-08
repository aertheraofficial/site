import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { ProductPurchaseControls } from "@/components/product-purchase-controls";
import { siteInfo } from "@/data/site";
import { getProductBySlug, getRelatedProducts, products } from "@/data/products";
import {
  getStorefrontAvailabilityLabel,
  getStorefrontProductDetails,
  isProductAvailableNow,
} from "@/lib/product-availability";
import { formatMoney } from "@/lib/money";
import {
  getProductDetailImageClassName,
  getProductDetailImageSrc,
} from "@/lib/product-images";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return {
      title: "Product Not Found",
    };
  }

  const imageUrl = getProductDetailImageSrc(product);
  const pagePath = `/product-page/${product.slug}`;

  return {
    title: product.name,
    description: product.excerpt,
    alternates: {
      canonical: pagePath,
    },
    openGraph: {
      type: "website",
      siteName: siteInfo.name,
      title: product.name,
      description: product.excerpt,
      url: pagePath,
      images: [{ url: imageUrl, alt: product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description: product.excerpt,
      images: [imageUrl],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = getRelatedProducts(product);
  const heroNote = product.details.find((detail) => detail.label === "Crafted for");
  const heroImageSrc = getProductDetailImageSrc(product);
  const heroImageClassName = getProductDetailImageClassName(product);
  const usesSingleSurfaceHero = true;
  const storefrontDetails = getStorefrontProductDetails(product);
  const storefrontAvailability = getStorefrontAvailabilityLabel(product);
  const isAvailableNow = isProductAvailableNow(product);

  return (
    <div className="bg-[#11110e] text-white">
      <section className="border-b border-white/10 pb-16 pt-5 sm:pb-20">
        <div className="page-frame">
          <div className="wide-shell space-y-8">
            <div className="flex flex-wrap items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white/56">
              <Link href="/" className="hover:text-white">
                Home
              </Link>
              <span>/</span>
              <Link href="/products" className="hover:text-white">
                All Products
              </Link>
              <span>/</span>
              <span className="text-white/76">{product.shortName}</span>
            </div>

            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] xl:gap-14">
              <div className="space-y-5">
                <div
                  className={`relative aspect-[4/4.8] overflow-hidden rounded-[2rem] ${
                    usesSingleSurfaceHero
                      ? "border border-[#e0d1b6]/80 bg-[#efe2cf] shadow-[0_32px_80px_rgba(0,0,0,0.24)]"
                      : "bg-white"
                  }`}
                >
                  <Image
                    src={heroImageSrc}
                    alt={product.name}
                    fill
                    priority
                    sizes="(max-width: 1280px) 100vw, 54vw"
                    className={
                      usesSingleSurfaceHero
                        ? `object-contain px-4 py-5 sm:px-6 sm:py-7 ${heroImageClassName}`
                        : "object-contain p-8 sm:p-10"
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 rounded-[2rem] border border-white/10 bg-white/4 p-5 sm:p-6 xl:grid-cols-4">
                  {storefrontDetails.map((detail) => (
                    <article key={detail.label} className="space-y-1.5">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/46">
                        {detail.label}
                      </p>
                      <p className="text-sm leading-6 text-white/78">{detail.value}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="self-start lg:sticky lg:top-24">
                <div className="rounded-[2rem] border border-white/10 bg-[#171611] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)] sm:p-8">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#d1c5ae]">
                    {product.categoryLabel} Ritual
                  </p>
                  <h1 className="mt-4 font-display text-[2.6rem] leading-[0.92] tracking-[-0.05em] text-white sm:text-[3.7rem]">
                    {product.name}
                  </h1>
                  <p className="mt-4 text-[1rem] leading-8 text-white/74">{product.excerpt}</p>

                  <div className="mt-6 flex flex-wrap items-center gap-3 text-[1rem] text-white">
                    {product.compareAtPrice ? (
                      <span className="text-white/38 line-through">
                        {formatMoney(product.compareAtPrice)}
                      </span>
                    ) : null}
                    <span className="font-semibold">{formatMoney(product.price)}</span>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {product.scentNotes.map((note) => (
                      <span
                        key={note}
                        className="rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white/74"
                      >
                        {note}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 space-y-2 text-sm text-white/68">
                    <p>
                      Availability: <span className="text-white">{storefrontAvailability}</span>
                    </p>
                    {!isAvailableNow && product.leadTime ? (
                      <p>
                        Lead time: <span className="text-white">{product.leadTime}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-8 border-t border-white/10 pt-6">
                    <ProductPurchaseControls productSlug={product.slug} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f7f2ea] py-16 text-[#201d17] sm:py-20">
        <div className="page-frame">
          <div className="wide-shell grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-8">
              <div className="grid gap-6 xl:grid-cols-2">
                <article className="rounded-[2rem] bg-white p-7 shadow-[0_18px_50px_rgba(31,28,24,0.05)]">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
                    About This Product
                  </p>
                  <p className="mt-4 text-[1rem] leading-8 text-[#51483d]">
                    {product.description}
                  </p>
                </article>

                <article className="rounded-[2rem] bg-[#ece3d5] p-7">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
                    Ritual
                  </p>
                  <ol className="mt-4 space-y-4">
                    {product.ritual.map((step, index) => (
                      <li key={step} className="grid grid-cols-[28px_minmax(0,1fr)] gap-4">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#201d17] text-[0.72rem] font-semibold text-white">
                          {index + 1}
                        </span>
                        <span className="text-sm leading-7 text-[#51483d]">{step}</span>
                      </li>
                    ))}
                  </ol>
                </article>
              </div>
            </div>

            <div>
              <article className="rounded-[2rem] bg-[#ece3d5] p-7">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
                  Crafted For
                </p>
                <h2 className="mt-3 font-display text-[2.4rem] leading-[0.98] tracking-[-0.04em] text-[#201d17]">
                  {heroNote?.value ?? product.categoryLabel}
                </h2>
                <p className="mt-4 text-sm leading-7 text-[#51483d]">
                  {product.excerpt} This product sits within the Aerthera collection
                  as a considered ritual object rather than a purely utilitarian format.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      {relatedProducts.length > 0 ? (
        <section className="bg-[#ece4d7] py-16 text-[#201d17] sm:py-20">
          <div className="page-frame">
            <div className="wide-shell space-y-8">
              <div className="space-y-3">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
                  Continue Exploring
                </p>
                <h2 className="font-display text-[3rem] leading-[0.96] tracking-[-0.05em] sm:text-[3.8rem]">
                  Related Rituals
                </h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {relatedProducts.map((relatedProduct) => (
                  <ProductCard
                    key={relatedProduct.slug}
                    product={relatedProduct}
                    singleSurface
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
