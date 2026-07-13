import Link from "next/link";
import {
  markProductPreorderAction,
  quickDecrementStockAction,
  setProductQuantityAction,
} from "@/app/admin/actions";
import { getProductsWithStock } from "@/lib/product-stock";
import type { Product } from "@/data/products";

type StockPageProps = {
  searchParams: Promise<{ q?: string; status?: string; saved?: string; error?: string }>;
};

const LOW_STOCK_THRESHOLD = 5;

type StockState = "sold-out" | "low-stock" | "in-stock" | "pre-order";

const STATUS_FILTERS: { value: "all" | StockState; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low-stock", label: "Low Stock" },
  { value: "sold-out", label: "Sold Out" },
  { value: "in-stock", label: "In Stock" },
  { value: "pre-order", label: "Pre-order" },
];

function getStockState(product: Product): StockState {
  const isTracked = typeof product.quantity === "number";

  if (isTracked) {
    const quantity = product.quantity ?? 0;
    if (quantity <= 0) return "sold-out";
    if (quantity <= LOW_STOCK_THRESHOLD) return "low-stock";
    return "in-stock";
  }

  return product.availability === "Pre-order" ? "pre-order" : "in-stock";
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

function buildStockHref(status: string, query: string) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (query) params.set("q", query);
  const suffix = params.toString();
  return suffix ? `/admin/stock?${suffix}` : "/admin/stock";
}

export default async function ManageStockPage({ searchParams }: StockPageProps) {
  const { q, status, saved, error } = await searchParams;
  const query = q?.trim() ?? "";
  const normalizedQuery = query.toLowerCase();
  const activeStatus = STATUS_FILTERS.some((f) => f.value === status)
    ? (status as StockState | "all")
    : "all";

  const products = await getProductsWithStock();
  const withState = products.map((product) => ({
    product,
    state: getStockState(product),
  }));

  const totalCount = withState.length;
  const lowStockCount = withState.filter((p) => p.state === "low-stock").length;
  const soldOutCount = withState.filter((p) => p.state === "sold-out").length;
  const preorderCount = withState.filter((p) => p.state === "pre-order").length;

  const filtered = withState.filter(({ product, state }) => {
    if (activeStatus !== "all" && state !== activeStatus) return false;
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

  return (
    <div className="space-y-8">
      {/* Page header + search */}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-[#8d7a5c]">
            Catalog
          </p>
          <h2 className="font-display text-[2.6rem] leading-[0.95] tracking-[-0.04em] text-[#201d17]">
            Manage Stock
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-[#5d574f]">
            Set exact quantities so the site auto-shows &quot;Sold Out&quot; and blocks
            purchase at zero. Every paid online order decrements stock automatically. Use{" "}
            <strong className="font-semibold text-[#201d17]">Sold 1</strong> right after an
            in-person sale to keep it in sync. Sorted lowest stock first.
          </p>
        </div>

        <form className="flex w-full items-center gap-2 xl:w-auto">
          {activeStatus !== "all" ? (
            <input type="hidden" name="status" value={activeStatus} />
          ) : null}
          <label className="relative block w-full xl:w-80">
            <span className="sr-only">Search products</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search by name, slug, or SKU"
              className="w-full rounded-full border border-black/8 bg-white px-5 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59]"
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#201d17] px-5 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#2f2a22]"
          >
            Search
          </button>
          {query ? (
            <Link
              href={buildStockHref(activeStatus, "")}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-black/8 px-5 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#201d17] transition hover:bg-black/4"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      {/* Summary cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2.5">
        {STATUS_FILTERS.map((filter) => {
          const isActive = filter.value === activeStatus;
          return (
            <Link
              key={filter.value}
              href={buildStockHref(filter.value, query)}
              className={`inline-flex min-h-10 items-center justify-center rounded-full border px-4 text-[0.72rem] font-semibold uppercase tracking-[0.16em] transition ${
                isActive
                  ? "border-[#201d17] bg-[#201d17] text-white"
                  : "border-black/8 bg-white text-[#201d17] hover:border-black/20"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

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
          <p className="text-[0.72rem] font-medium text-[#8d7a5c]">
            {sorted.length} shown
          </p>
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
                          <form action={quickDecrementStockAction}>
                            <input type="hidden" name="slug" value={product.slug} />
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
  );
}
