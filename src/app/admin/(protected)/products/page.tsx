import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { getStorefrontAvailabilityLabel } from "@/lib/product-availability";
import { getProductsWithStock } from "@/lib/product-stock";
import type { Product } from "@/data/products";
import { requirePermission } from "@/lib/staff-auth";

type ProductsPageProps = {
  searchParams: Promise<{ q?: string; saved?: string; error?: string }>;
};

export default async function AdminProductsPage({ searchParams }: ProductsPageProps) {
  await requirePermission("products");
  const { q, saved, error } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  const all = await getProductsWithStock();
  const products = query
    ? all.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.categoryLabel.toLowerCase().includes(query),
      )
    : all;

  // Group by category ("parent name"): Balm, Essential Oil, ...
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const key = product.categoryLabel || "Uncategorised";
    const list = groups.get(key);
    if (list) list.push(product);
    else groups.set(key, [product]);
  }
  const groupList = [...groups.entries()]
    .map(([category, list]) => {
      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
      const trackedList = sorted.filter((p) => typeof p.quantity === "number");
      const totalStock = trackedList.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
      return {
        category,
        products: sorted,
        count: sorted.length,
        trackedCount: trackedList.length,
        totalStock,
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8d7a5c]">
            Catalog
          </p>
          <h2 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
            Products
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#5d574f]">
            Grouped by category. Tap a group to expand or collapse. Stock is the
            tracked quantity — set it in Manage Stock.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-full bg-[#201d17] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2e2a22]"
        >
          + Add Product
        </Link>
      </div>

      {saved ? (
        <p className="mt-6 rounded-[1.25rem] border border-[#8cc8a4] bg-[#e9f7ee] px-4 py-3 text-sm text-[#256542]">
          Product saved. It is live now.
        </p>
      ) : null}
      {error ? (
        <p className="mt-6 rounded-[1.25rem] border border-[#e6b4b4] bg-[#fff0ef] px-4 py-3 text-sm text-[#9b3d32]">
          {error === "missing-slug" ? "Missing product." : error}
        </p>
      ) : null}

      <form method="get" className="mt-6 max-w-sm">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or category"
          className="w-full rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#a07850]"
        />
      </form>

      {groupList.length === 0 ? (
        <p className="mt-6 rounded-[1.25rem] border border-black/8 bg-white px-4 py-8 text-center text-sm text-[#8d7a5c]">
          No products found.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {groupList.map((group) => (
            <details
              key={group.category}
              open
              className="group overflow-hidden rounded-[1.25rem] border border-black/8 bg-white"
            >
              <summary className="flex cursor-pointer select-none flex-wrap items-center justify-between gap-3 bg-[#faf6ef] px-5 py-4 [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-3">
                  <svg
                    className="h-4 w-4 shrink-0 text-[#8d7a5c] transition-transform group-open:rotate-90"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M7 5l6 5-6 5V5z" />
                  </svg>
                  <span className="font-display text-[1.15rem] tracking-[-0.02em] text-[#201d17]">
                    {group.category}
                  </span>
                  <span className="rounded-full bg-[#efe6d9] px-2.5 py-0.5 text-[0.7rem] font-semibold text-[#8d7a5c]">
                    {group.count} {group.count === 1 ? "product" : "products"}
                  </span>
                </div>
                <span className="text-[0.78rem] font-semibold text-[#5d574f]">
                  Total stock:{" "}
                  <span className="text-[#201d17]">{group.totalStock}</span>
                  {group.trackedCount < group.count ? (
                    <span className="ml-1 font-normal text-[#8d7a5c]">
                      ({group.count - group.trackedCount} not tracked)
                    </span>
                  ) : null}
                </span>
              </summary>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-y border-black/8 text-[0.68rem] uppercase tracking-[0.12em] text-[#8d7a5c]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 font-semibold">Price</th>
                      <th className="px-4 py-3 font-semibold">Stock</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.products.map((product) => {
                      const isTracked = typeof product.quantity === "number";
                      return (
                        <tr
                          key={product.slug}
                          className="border-b border-black/5 last:border-0"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Image
                                src={product.image}
                                alt=""
                                width={40}
                                height={40}
                                className="h-10 w-10 shrink-0 rounded-lg object-cover"
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-[#201d17]">
                                  {product.name}
                                </p>
                                <p className="text-xs text-[#8d7a5c]">{product.size}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-[#201d17]">
                            {formatMoney(product.price)}
                          </td>
                          <td className="px-4 py-3">
                            {isTracked ? (
                              <span className="font-semibold text-[#201d17]">
                                {product.quantity}
                              </span>
                            ) : (
                              <span className="text-[#b3a894]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[#5d574f]">
                            {getStorefrontAvailabilityLabel(product)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/admin/products/${encodeURIComponent(product.slug)}/edit`}
                              className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-semibold text-[#201d17] transition hover:bg-[#f7f2ea]"
                            >
                              Edit
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
