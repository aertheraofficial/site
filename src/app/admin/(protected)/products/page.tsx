import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { getStorefrontAvailabilityLabel } from "@/lib/product-availability";
import { getProductsWithStock } from "@/lib/product-stock";

type ProductsPageProps = {
  searchParams: Promise<{ q?: string; saved?: string; error?: string }>;
};

export default async function AdminProductsPage({ searchParams }: ProductsPageProps) {
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
  products.sort(
    (a, b) =>
      a.categoryLabel.localeCompare(b.categoryLabel) || a.name.localeCompare(b.name),
  );

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
            Edit any product&apos;s price, name, category or photo. Changes go live
            immediately — no code deploy needed.
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

      <div className="mt-6 overflow-hidden rounded-[1.25rem] border border-black/8 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/8 bg-[#faf6ef] text-[0.68rem] uppercase tracking-[0.12em] text-[#8d7a5c]">
            <tr>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Price</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.slug} className="border-b border-black/5 last:border-0">
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
                      <p className="truncate font-medium text-[#201d17]">{product.name}</p>
                      <p className="text-xs text-[#8d7a5c]">{product.size}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#5d574f]">{product.categoryLabel}</td>
                <td className="px-4 py-3 font-semibold text-[#201d17]">
                  {formatMoney(product.price)}
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
            ))}
          </tbody>
        </table>
        {products.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#8d7a5c]">No products found.</p>
        ) : null}
      </div>
    </div>
  );
}
