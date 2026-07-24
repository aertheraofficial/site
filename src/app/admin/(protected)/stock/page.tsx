import Link from "next/link";
import {
  markProductPreorderAction,
  quickDecrementStockAction,
  setProductQuantityAction,
} from "@/app/admin/actions";
import {
  ALL_LOCATIONS,
  ONLINE_LOCATION,
  getProductsWithStockAtLocation,
  isLocationId,
} from "@/lib/product-stock";
import type { Product } from "@/data/products";
import { PREORDER_THRESHOLD } from "@/lib/product-availability";

type StockPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string | string[];
    location?: string;
    type?: string | string[];
    saved?: string;
    error?: string;
  }>;
};

// Shared with the storefront so "Low Stock" in admin matches "Pre-order" for
// customers: more than this is In stock, 1..this is Low/Pre-order, 0 is Sold Out.
const LOW_STOCK_THRESHOLD = PREORDER_THRESHOLD;

type StockState = "sold-out" | "low-stock" | "in-stock" | "pre-order";

const STATUS_OPTIONS: { value: StockState; label: string }[] = [
  { value: "low-stock", label: "Low Stock" },
  { value: "sold-out", label: "Sold Out" },
  { value: "in-stock", label: "In Stock" },
  { value: "pre-order", label: "Pre-order" },
];

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getStockState(product: Product): StockState {
  const isTracked = typeof product.quantity === "number";

  if (isTracked) {
    const quantity = product.quantity ?? 0;
    if (quantity <= 0) return "sold-out";
    if (quantity <= LOW_STOCK_THRESHOLD) return "low-stock";
    return "in-stock";
  }

  // Untracked (no quantity set yet): mirror the storefront — Pre-order by
  // default, never "In stock", unless it's been explicitly marked Sold Out.
  // See getStorefrontAvailabilityLabel in product-availability.ts.
  return product.availability === "Sold Out" ? "sold-out" : "pre-order";
}

function getStateBadgeClasses(state: StockState) {
  switch (state) {
    case "sold-out":
      return "border-[#e6b4b4] bg-[#fff0ef] text-[#9b3d32]";
    case "low-stock":
      return "border-[#d4b16c] bg-[#faf1df] text-[#8b5e1d]";
    case "pre-order":
      return "border-[#d4b16c] bg-[#faf1df] text-[#8b5e1d]";
    default:
      return "border-[#8cc8a4] bg-[#e9f7ee] text-[#256542]";
  }
}

function getStateLabel(product: Product, state: StockState) {
  if (state === "sold-out") return "Sold Out";
  if (state === "low-stock") return `Low — ${product.quantity} left`;
  if (state === "pre-order") return "Pre-order";
  return typeof product.quantity === "number" ? `${product.quantity} in stock` : "In stock";
}

function buildLocationHref(
  location: string,
  query: string,
  statuses: string[],
  types: string[],
) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  for (const s of statuses) params.append("status", s);
  for (const t of types) params.append("type", t);
  if (location !== ONLINE_LOCATION) params.set("location", location);
  const suffix = params.toString();
  return suffix ? `/admin/stock?${suffix}` : "/admin/stock";
}

export default async function ManageStockPage({ searchParams }: StockPageProps) {
  const { q, status, location, type, saved, error } = await searchParams;
  const query = q?.trim() ?? "";
  const normalizedQuery = query.toLowerCase();
  const activeLocation = isLocationId(location) ? location : ONLINE_LOCATION;

  const activeStatuses = toArray(status).filter((s) =>
    STATUS_OPTIONS.some((opt) => opt.value === s),
  );

  const products = await getProductsWithStockAtLocation(activeLocation);
  const allTypes = [...new Set(products.map((p) => p.categoryLabel))].sort((a, b) =>
    a.localeCompare(b),
  );
  const activeTypes = toArray(type).filter((t) => allTypes.includes(t));

  const withState = products.map((product) => ({
    product,
    state: getStockState(product),
  }));

  const totalCount = withState.length;
  const lowStockCount = withState.filter((p) => p.state === "low-stock").length;
  const soldOutCount = withState.filter((p) => p.state === "sold-out").length;
  const preorderCount = withState.filter((p) => p.state === "pre-order").length;

  const filtered = withState.filter(({ product, state }) => {
    if (activeStatuses.length > 0 && !activeStatuses.includes(state)) return false;
    if (activeTypes.length > 0 && !activeTypes.includes(product.categoryLabel)) return false;
    if (!normalizedQuery) return true;
    return (
      product.name.toLowerCase().includes(normalizedQuery) ||
      product.slug.toLowerCase().includes(normalizedQuery) ||
      (product.sku ?? "").toLowerCase().includes(normalizedQuery)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const aKey = typeof a.product.quantity === "number" ? a.product.quantity : Infinity;
    const bKey = typeof b.product.quantity === "number" ? b.product.quantity : Infinity;
    return aKey - bKey || a.product.name.localeCompare(b.product.name);
  });

  const summaryCards = [
    {
      label: "Products",
      value: totalCount,
      caption: "Total products in the catalog.",
      tone: "neutral" as const,
    },
    {
      label: `Low Stock (≤ ${LOW_STOCK_THRESHOLD})`,
      value: lowStockCount,
      caption: "Reorder or restock soon.",
      tone: "amber" as const,
    },
    {
      label: "Sold Out",
      value: soldOutCount,
      caption: "Blocked from purchase right now.",
      tone: "red" as const,
    },
    {
      label: "Pre-order",
      value: preorderCount,
      caption: "Not tracked by exact quantity.",
      tone: "neutral" as const,
    },
  ];

  const cardToneClasses: Record<"neutral" | "amber" | "red", string> = {
    neutral: "border-black/8 bg-white text-[#201d17]",
    amber: "border-[#e7d3a8] bg-[#fbf4e6] text-[#8b5e1d]",
    red: "border-[#eec4c1] bg-[#fdf1f0] text-[#9b3d32]",
  };

  const hasActiveFilters = query.length > 0 || activeStatuses.length > 0 || activeTypes.length > 0;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="space-y-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-[#8d7a5c]">
          Catalog
        </p>
        <h2 className="font-display text-[2.6rem] leading-[0.95] tracking-[-0.04em] text-[#201d17]">
          Manage Stock
        </h2>
        <p className="max-w-2xl text-sm leading-7 text-[#5d574f]">
          Each location (online, and each shop) keeps its own stock count.
          Set exact quantities so the site auto-shows &quot;Sold Out&quot; and
          blocks purchase at zero. Online orders decrement the online pool
          automatically; use <strong className="font-semibold text-[#201d17]">Sold 1</strong>{" "}
          at a shop right after an in-person sale to keep it in sync.
        </p>
      </div>

      {/* Location tabs */}
      <div className="flex flex-wrap gap-2.5 border-b border-black/8 pb-5">
        {ALL_LOCATIONS.map((loc) => {
          const isActive = loc.id === activeLocation;
          return (
            <Link
              key={loc.id}
              href={buildLocationHref(loc.id, query, activeStatuses, activeTypes)}
              className={`inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-[0.76rem] font-semibold uppercase tracking-[0.16em] transition ${
                isActive
                  ? "border-[#201d17] bg-[#201d17] text-white"
                  : "border-black/8 bg-white text-[#201d17] hover:border-black/20"
              }`}
            >
              {loc.name}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        {/* Filter sidebar */}
        <aside className="h-fit space-y-6 rounded-[1.75rem] border border-black/8 bg-white/80 p-6 shadow-[0_20px_50px_rgba(31,28,24,0.05)]">
          <form className="space-y-6">
            {activeLocation !== ONLINE_LOCATION ? (
              <input type="hidden" name="location" value={activeLocation} />
            ) : null}

            <label className="block">
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
                Search
              </span>
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Name, slug, or SKU"
                className="mt-3 w-full rounded-[1rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#201d17]"
              />
            </label>

            <div className="flex items-center justify-between">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
                Filter by
              </p>
              {hasActiveFilters ? (
                <Link
                  href={buildLocationHref(activeLocation, "", [], [])}
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-[#201d17]"
                >
                  Reset
                </Link>
              ) : null}
            </div>

            <div className="space-y-4 text-sm text-[#51483d]">
              <div className="border-t border-black/8 pt-4">
                <p className="font-semibold text-[#201d17]">Product type</p>
                <div className="mt-3 space-y-2.5">
                  {allTypes.map((t) => (
                    <label key={t} className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        name="type"
                        value={t}
                        defaultChecked={activeTypes.includes(t)}
                        className="h-4 w-4 accent-[#201d17]"
                      />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-black/8 pt-4">
                <p className="font-semibold text-[#201d17]">Status</p>
                <div className="mt-3 space-y-2.5">
                  {STATUS_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        name="status"
                        value={opt.value}
                        defaultChecked={activeStatuses.includes(opt.value)}
                        className="h-4 w-4 accent-[#201d17]"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#201d17] px-5 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#2f2a22]"
            >
              Apply Filters
            </button>
          </form>
        </aside>

        {/* Main content */}
        <div className="space-y-8">
          {/* Summary cards */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <article
                key={card.label}
                className={`rounded-[1.5rem] border p-6 ${cardToneClasses[card.tone]}`}
              >
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] opacity-80">
                  {card.label}
                </p>
                <p className="mt-3 font-display text-[2.7rem] leading-none tracking-[-0.05em]">
                  {card.value}
                </p>
                <p className="mt-2 text-sm leading-6 opacity-80">{card.caption}</p>
              </article>
            ))}
          </section>

          {saved ? (
            <p className="rounded-[1.25rem] border border-[#8cc8a4] bg-[#e9f7ee] px-4 py-3 text-sm leading-6 text-[#256542]">
              Stock updated.
            </p>
          ) : null}

          {error ? (
            <p className="rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-4 py-3 text-sm leading-6 text-[#8b5e1d]">
              {error}
            </p>
          ) : null}

          {/* Table */}
          <section className="overflow-hidden rounded-[1.75rem] border border-black/8 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-black/6 px-6 py-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c]">
                Products
              </p>
              <div className="flex items-center gap-4">
                <p className="text-[0.72rem] font-medium text-[#8d7a5c]">
                  {sorted.length} shown
                </p>
                <Link
                  href="/admin/products/new"
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-[#201d17] px-4 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#2f2a22]"
                >
                  + Add Product
                </Link>
              </div>
            </div>

            {sorted.length === 0 ? (
              <div className="px-6 py-14 text-center text-sm leading-7 text-[#5d574f]">
                No products match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-black/8 text-left text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#8d7a5c]">
                      <th className="px-6 py-4">Product</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Set Quantity</th>
                      <th className="px-6 py-4">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(({ product, state }) => {
                      const isTracked = typeof product.quantity === "number";
                      const isSoldOut = state === "sold-out";
                      const isPreorder = state === "pre-order";

                      return (
                        <tr
                          key={product.slug}
                          className="border-b border-black/6 transition last:border-b-0 hover:bg-[#faf7f1]"
                        >
                          <td className="px-6 py-4">
                            <p className="font-semibold text-[#201d17]">{product.name}</p>
                            <p className="mt-0.5 text-xs text-[#8d7a5c]">{product.size}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.14em] ${getStateBadgeClasses(state)}`}
                            >
                              {getStateLabel(product, state)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <form action={setProductQuantityAction} className="flex gap-2">
                              <input type="hidden" name="slug" value={product.slug} />
                              <input type="hidden" name="location" value={activeLocation} />
                              <input
                                type="number"
                                name="quantity"
                                min={0}
                                defaultValue={isTracked ? (product.quantity ?? 0) : undefined}
                                placeholder="Qty"
                                className="w-20 rounded-full border border-black/8 bg-[#f7f2ea] px-3 py-1.5 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
                              />
                              <button
                                type="submit"
                                className="shrink-0 rounded-full bg-[#201d17] px-4 py-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#2f2a22]"
                              >
                                Set
                              </button>
                            </form>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <Link
                                href={`/admin/products/${product.slug}/edit`}
                                className="inline-flex h-9 items-center whitespace-nowrap rounded-full bg-[#201d17] px-3.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#2f2a22]"
                              >
                                Edit
                              </Link>
                              <form action={quickDecrementStockAction}>
                                <input type="hidden" name="slug" value={product.slug} />
                                <input type="hidden" name="location" value={activeLocation} />
                                <button
                                  type="submit"
                                  disabled={!isTracked || isSoldOut}
                                  className="h-9 whitespace-nowrap rounded-full border border-black/8 bg-white px-3.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#201d17] transition hover:bg-black/4 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Sold 1
                                </button>
                              </form>
                              <form action={markProductPreorderAction}>
                                <input type="hidden" name="slug" value={product.slug} />
                                <input type="hidden" name="location" value={activeLocation} />
                                <button
                                  type="submit"
                                  disabled={isPreorder}
                                  className="h-9 whitespace-nowrap rounded-full border border-black/8 bg-white px-3.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#201d17] transition hover:bg-black/4 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Pre-order
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
