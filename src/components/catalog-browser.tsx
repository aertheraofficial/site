"use client";

import { useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/data/products";
import {
  getStorefrontAvailabilityLabel,
  isProductAvailableNow,
} from "@/lib/product-availability";

type CatalogBrowserProps = {
  listingDescription: string;
  products: Product[];
};

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

export function CatalogBrowser({ listingDescription, products }: CatalogBrowserProps) {
  const [searchValue, setSearchValue] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("recommended");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const browserProducts = products;

  const productTypes = [...new Set(browserProducts.map((product) => product.categoryLabel))];
  const availabilities = ["Available", "Pre-order"].filter((availability) =>
    browserProducts.some(
      (product) => getStorefrontAvailabilityLabel(product) === availability,
    ),
  );
  const sizes = [...new Set(browserProducts.map((product) => product.size))];
  const normalizedSearch = searchValue.trim().toLowerCase();

  const visibleProducts = browserProducts.filter((product) => {
    const matchesSearch =
      !normalizedSearch ||
      [
        product.name,
        product.shortName,
        product.categoryLabel,
        product.excerpt,
        ...product.scentNotes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);

    const matchesType =
      selectedTypes.length === 0 || selectedTypes.includes(product.categoryLabel);
    const matchesAvailability =
      selectedAvailability.length === 0 ||
      selectedAvailability.includes(getStorefrontAvailabilityLabel(product));
    const matchesSize = selectedSizes.length === 0 || selectedSizes.includes(product.size);

    return matchesSearch && matchesType && matchesAvailability && matchesSize;
  });

  function sortProducts(list: Product[]) {
    if (sortBy === "price-asc") {
      return [...list].sort((left, right) => left.price - right.price);
    }

    if (sortBy === "price-desc") {
      return [...list].sort((left, right) => right.price - left.price);
    }

    if (sortBy === "name-asc") {
      return [...list].sort((left, right) => left.name.localeCompare(right.name));
    }

    return list;
  }

  const availableProducts = sortProducts(
    visibleProducts.filter((product) => isProductAvailableNow(product)),
  );
  const preOrderProducts = sortProducts(
    visibleProducts.filter((product) => !isProductAvailableNow(product)),
  );
  const productSections = [
    {
      id: "available",
      title: "Available Now",
      note: "Ready inventory",
      products: availableProducts,
    },
    {
      id: "pre-order",
      title: "Pre-Order",
      note: "Made or prepared after purchase",
      products: preOrderProducts,
    },
  ].filter((section) => section.products.length > 0);

  const hasActiveFilters =
    normalizedSearch.length > 0 ||
    selectedTypes.length > 0 ||
    selectedAvailability.length > 0 ||
    selectedSizes.length > 0 ||
    sortBy !== "recommended";
  const activeFilterCount =
    selectedTypes.length +
    selectedAvailability.length +
    selectedSizes.length +
    (normalizedSearch.length > 0 ? 1 : 0);
  const filterPanel = (
    <div className="space-y-8 rounded-[2rem] border border-black/8 bg-white/80 p-6 shadow-[0_20px_50px_rgba(31,28,24,0.05)] backdrop-blur-sm">
      <label className="block">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
          Search
        </span>
        <input
          type="search"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search the catalog"
          className="mt-3 w-full rounded-[1rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#201d17]"
        />
      </label>

      <div className="rounded-[1.5rem] bg-[#f7f2ea] p-5">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
          Collection Note
        </p>
        <p className="mt-3 text-sm leading-7 text-[#5d574f]">{listingDescription}</p>
      </div>

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
            Filter by
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearchValue("");
                setSelectedTypes([]);
                setSelectedAvailability([]);
                setSelectedSizes([]);
                setSortBy("recommended");
              }}
              className="text-xs font-semibold uppercase tracking-[0.16em] text-[#201d17]"
            >
              Reset
            </button>
          ) : null}
        </div>

        <div className="space-y-4 text-sm text-[#51483d]">
          <div className="border-t border-black/8 pt-4">
            <p className="font-semibold text-[#201d17]">Product type</p>
            <div className="mt-3 space-y-2.5">
              {productTypes.map((type) => (
                <label key={type} className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type)}
                    onChange={() => setSelectedTypes((current) => toggleValue(current, type))}
                    className="h-4 w-4 accent-[#201d17]"
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-black/8 pt-4">
            <p className="font-semibold text-[#201d17]">Availability</p>
            <div className="mt-3 space-y-2.5">
              {availabilities.map((availability) => (
                <label key={availability} className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={selectedAvailability.includes(availability)}
                    onChange={() =>
                      setSelectedAvailability((current) =>
                        toggleValue(current, availability),
                      )
                    }
                    className="h-4 w-4 accent-[#201d17]"
                  />
                  <span>{availability}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-black/8 pt-4">
            <p className="font-semibold text-[#201d17]">Size</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sizes.map((size) => {
                const active = selectedSizes.includes(size);

                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSizes((current) => toggleValue(current, size))}
                    className={`rounded-full border px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] transition ${
                      active
                        ? "border-[#201d17] bg-[#201d17] text-white"
                        : "border-black/8 bg-white text-[#51483d] hover:text-[#201d17]"
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  function renderProductGrid(sectionProducts: Product[]) {
    return (
      <div
        className={`grid gap-5 sm:gap-6 ${
          sectionProducts.length > 1 ? "md:grid-cols-2 xl:grid-cols-3" : "max-w-[26rem]"
        }`}
      >
        {sectionProducts.map((product) => (
          <ProductCard
            key={product.slug}
            product={product}
            linkToProduct
            showAddToCart
            singleSurface
          />
        ))}
      </div>
    );
  }

  return (
    <section id="catalog-browser" className="page-frame py-12 sm:py-16">
      <div className="wide-shell grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-10">
        <div className="order-1 space-y-6 lg:order-2 lg:space-y-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
                Catalog View
              </p>
              <p className="text-[1rem] leading-8 text-[#5d574f]">{listingDescription}</p>
              <p className="text-sm text-[#8d7a5c]">
                Showing {visibleProducts.length} of {browserProducts.length} products
              </p>
            </div>

            <label className="w-full space-y-2 sm:w-auto">
              <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#8d7a5c]">
                Sort
              </span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="w-full rounded-full border border-black/8 bg-white px-4 py-2.5 text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-[#51483d] outline-none sm:min-w-[15rem]"
              >
                <option value="recommended">Recommended</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Name: A to Z</option>
              </select>
            </label>
          </div>

          <div className="space-y-4 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((current) => !current)}
              className="inline-flex min-h-11 w-full items-center justify-between rounded-full border border-black/8 bg-white/80 px-5 text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-[#201d17] shadow-[0_14px_30px_rgba(31,28,24,0.05)]"
              aria-expanded={mobileFiltersOpen}
              aria-controls="mobile-filter-panel"
            >
              <span>
                Search & Filters
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </span>
              <span>{mobileFiltersOpen ? "Hide" : "Show"}</span>
            </button>

            {mobileFiltersOpen ? <div id="mobile-filter-panel">{filterPanel}</div> : null}
          </div>

          {visibleProducts.length > 0 ? (
            <div className="space-y-10">
              {productSections.map((section) => (
                <section key={section.id} className="space-y-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
                        {section.note}
                      </p>
                      <h2 className="text-[1.4rem] font-semibold tracking-[-0.03em] text-[#201d17]">
                        {section.title}
                      </h2>
                    </div>
                    <p className="text-sm text-[#8d7a5c]">
                      {section.products.length} product
                      {section.products.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  {renderProductGrid(section.products)}
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-black/12 bg-white/72 p-8 text-center">
              <p className="text-lg font-semibold text-[#201d17]">No matching products</p>
              <p className="mt-3 text-sm leading-7 text-[#6a6258]">
                Adjust your search or clear a few filters to see the full collection again.
              </p>
            </div>
          )}
        </div>

        <aside className="order-2 hidden self-start lg:order-1 lg:block lg:sticky lg:top-24">
          {filterPanel}
        </aside>
      </div>
    </section>
  );
}
