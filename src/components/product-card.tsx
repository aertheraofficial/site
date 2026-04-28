import Image from "next/image";
import Link from "next/link";
import { AddToCartButton } from "@/components/add-to-cart-button";
import type { Product } from "@/data/products";
import { getProductHoverBackgroundSrc } from "@/lib/product-hover-backgrounds";
import { getStorefrontAvailabilityLabel } from "@/lib/product-availability";
import {
  getCatalogCardImageClassName,
  getCatalogCardImageSrc,
} from "@/lib/product-images";
import { formatMoney } from "@/lib/money";

type ProductCardProps = {
  product: Product;
  linkToProduct?: boolean;
  showAddToCart?: boolean;
  imageSrcOverride?: string;
  singleSurface?: boolean;
};

export function ProductCard({
  product,
  linkToProduct = true,
  showAddToCart = false,
  imageSrcOverride,
  singleSurface = false,
}: ProductCardProps) {
  const cardMotionClasses = linkToProduct
    ? "transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_rgba(31,28,24,0.11)]"
    : "";
  const resolvedImageSrc = imageSrcOverride ?? getCatalogCardImageSrc(product);
  const imageClassOverride = getCatalogCardImageClassName(product);
  const usesSingleSurfaceCard = singleSurface;
  const hoverBackgroundSrc = getProductHoverBackgroundSrc(product);
  const availabilityLabel = getStorefrontAvailabilityLabel(product);
  const isAvailableNow = availabilityLabel === "Available";
  const availabilityChipClasses = isAvailableNow
    ? "border-[#b9d3ba] bg-[#edf7ed] text-[#33563a]"
    : "border-[#e1cfb2] bg-[#f3e7d6] text-[#7b5e35]";

  return (
    <article
      data-hover-preview="false"
      className={`group relative overflow-hidden rounded-[1.75rem] ${
        usesSingleSurfaceCard
          ? "flex h-full min-h-[34.5rem] flex-col border border-[#e7dccd] bg-[#f5eee3] p-3 shadow-[0_22px_54px_rgba(31,28,24,0.07)]"
          : "border border-black/8 bg-[#fffdf9] p-3.5 shadow-[0_24px_60px_rgba(31,28,24,0.06)] sm:p-4"
      } sm:rounded-[2rem] ${cardMotionClasses}`}
    >
      {usesSingleSurfaceCard ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 scale-[1.04] opacity-0 transition duration-500 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 group-data-[hover-preview=true]:scale-100 group-data-[hover-preview=true]:opacity-100"
            style={{
              backgroundImage: `url(${hoverBackgroundSrc})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(245,238,227,0.28),rgba(245,238,227,0.04)_36%,rgba(245,238,227,0.34)_100%)] opacity-0 transition duration-500 group-hover:opacity-100 group-focus-within:opacity-100 group-data-[hover-preview=true]:opacity-100" />
        </>
      ) : null}

      {product.badge ? (
        <div
          className={`absolute left-4 top-4 z-10 rounded-full px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${
            usesSingleSurfaceCard
              ? "bg-[#231b13] text-[#f8f0de]"
              : "bg-[#f7ef9a] text-[#171717]"
          }`}
        >
          {product.badge}
        </div>
      ) : null}

      {linkToProduct ? (
        <Link href={`/product-page/${product.slug}`} className="block">
          <div
            className={`relative overflow-hidden ${
              usesSingleSurfaceCard
                ? "h-[17.25rem] shrink-0 sm:h-[18.25rem]"
                : "aspect-[4/3.4] rounded-[1.4rem] bg-[radial-gradient(circle_at_top,#f4ecdf,white_68%)] sm:aspect-[4/5] sm:rounded-[1.5rem]"
            }`}
          >
            <Image
              src={resolvedImageSrc}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 22vw"
              className={`object-contain transition duration-300 group-hover:scale-[1.03] ${
                usesSingleSurfaceCard ? "px-1 py-1 sm:px-2" : "p-4 sm:p-5"
              } ${imageClassOverride}`}
            />
          </div>
        </Link>
      ) : (
        <div
          className={`relative overflow-hidden ${
            usesSingleSurfaceCard
              ? "h-[16rem] shrink-0 sm:h-[17rem]"
              : "aspect-[4/3.4] rounded-[1.4rem] bg-[radial-gradient(circle_at_top,#f4ecdf,white_68%)] sm:aspect-[4/5] sm:rounded-[1.5rem]"
          }`}
        >
          <Image
            src={resolvedImageSrc}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 22vw"
            className={`object-contain ${
              usesSingleSurfaceCard ? "px-2 py-2 sm:px-3" : "p-4 sm:p-5"
            } ${imageClassOverride}`}
          />
        </div>
      )}

      <div
        className={`relative ${usesSingleSurfaceCard ? "mt-0 flex flex-1 flex-col pt-0.5" : "mt-5 space-y-3"}`}
      >
        {usesSingleSurfaceCard ? (
          <>
            {linkToProduct ? (
              <Link href={`/product-page/${product.slug}`} className="block space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#826d4b]">
                    {product.categoryLabel}
                  </p>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${availabilityChipClasses}`}
                  >
                    {availabilityLabel}
                  </span>
                </div>
                <p className="h-[3rem] overflow-hidden text-[1.12rem] font-semibold leading-6 text-[#241d14] transition hover:text-[#4d3d2b]">
                  {product.name}
                </p>
                <p className="h-[4.05rem] overflow-hidden text-sm leading-[1.45rem] text-[#665947]">
                  {product.excerpt}
                </p>
                <div className="flex items-start justify-between gap-3 pt-px text-sm text-[#2c2218]">
                  <div className="flex flex-wrap items-center gap-2">
                    {product.compareAtPrice ? (
                      <span className="text-[#96856b] line-through">
                        {formatMoney(product.compareAtPrice)}
                      </span>
                    ) : null}
                    <span className="font-semibold">{formatMoney(product.price)}</span>
                  </div>
                  <span className="shrink-0 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#6a5d4b]">
                    {product.size}
                  </span>
                </div>
              </Link>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#826d4b]">
                    {product.categoryLabel}
                  </p>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${availabilityChipClasses}`}
                  >
                    {availabilityLabel}
                  </span>
                </div>
                <p className="h-[3rem] overflow-hidden text-[1.12rem] font-semibold leading-6 text-[#241d14]">
                  {product.name}
                </p>
                <p className="h-[4.05rem] overflow-hidden text-sm leading-[1.45rem] text-[#665947]">
                  {product.excerpt}
                </p>
                <div className="flex items-start justify-between gap-3 pt-px text-sm text-[#2c2218]">
                  <div className="flex flex-wrap items-center gap-2">
                    {product.compareAtPrice ? (
                      <span className="text-[#96856b] line-through">
                        {formatMoney(product.compareAtPrice)}
                      </span>
                    ) : null}
                    <span className="font-semibold">{formatMoney(product.price)}</span>
                  </div>
                  <span className="shrink-0 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#6a5d4b]">
                    {product.size}
                  </span>
                </div>
              </div>
            )}

            {showAddToCart ? (
              <div className="mt-auto pt-3">
                <AddToCartButton
                  productSlug={product.slug}
                  label={isAvailableNow ? "Add to Cart" : "Pre-Order"}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#231b13] px-5 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#f8f0de] transition hover:bg-[#17120d]"
                />
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
                {product.categoryLabel}
              </p>
              <span
                className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${availabilityChipClasses}`}
              >
                {availabilityLabel}
              </span>
            </div>
            {linkToProduct ? (
              <Link
                href={`/product-page/${product.slug}`}
                className="block text-[1.12rem] font-semibold leading-6 text-[#201d17] transition hover:text-[#6a6258]"
              >
                {product.name}
              </Link>
            ) : (
              <p className="text-[1.12rem] font-semibold leading-6 text-[#201d17]">
                {product.name}
              </p>
            )}
            <p className="text-sm leading-6 text-[#6a6258]">{product.excerpt}</p>

            <div className="flex flex-wrap items-center gap-2 text-sm text-[#201d17]">
              {product.compareAtPrice ? (
                <span className="text-[#8f867a] line-through">
                  {formatMoney(product.compareAtPrice)}
                </span>
              ) : null}
              <span className="font-semibold">{formatMoney(product.price)}</span>
            </div>

            <div className="flex flex-col gap-3 border-t border-black/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="rounded-full border border-black/8 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#6a6258]">
                {product.size}
              </span>
              {linkToProduct ? (
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#8d7a5c]">
                  View Product
                </span>
              ) : null}
            </div>

            {showAddToCart ? (
              <AddToCartButton
                productSlug={product.slug}
                label={isAvailableNow ? "Add to Cart" : "Pre-Order"}
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#201d17] px-5 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:opacity-92"
              />
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}
