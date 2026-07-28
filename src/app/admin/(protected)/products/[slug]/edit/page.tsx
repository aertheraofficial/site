import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProductAction } from "@/app/admin/actions";
import { requirePermission } from "@/lib/staff-auth";
import { getProductBySlugWithStock, getProductsWithStock } from "@/lib/product-stock";
import { ProductTypeField } from "../../product-type-field";
import { ProductPhotoField } from "../../product-photo-field";

type EditProductPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  "missing-fields": "Please fill in name, category, size, and a valid price.",
};

const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#a07850] focus:ring-2 focus:ring-[#a07850]/20";

export default async function EditProductPage({
  params,
  searchParams,
}: EditProductPageProps) {
  await requirePermission("products");
  const { slug } = await params;
  const { error } = await searchParams;
  const product = await getProductBySlugWithStock(slug);
  if (!product) notFound();

  const message = error ? (ERROR_MESSAGES[error] ?? error) : null;
  const all = await getProductsWithStock();
  const categories = [...new Set(all.map((p) => p.categoryLabel))].sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <div>
      <Link href="/admin/products" className="text-sm text-[#8d7a5c] hover:text-[#201d17]">
        ← Back to products
      </Link>
      <h2 className="mt-3 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
        Edit Product
      </h2>
      <p className="mt-2 text-sm text-[#5d574f]">{product.name}</p>

      {message ? (
        <p className="mt-6 max-w-lg rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-4 py-3 text-sm text-[#8b5e1d]">
          {message}
        </p>
      ) : null}

      <form
        action={updateProductAction}
        encType="multipart/form-data"
        className="mt-8 max-w-lg space-y-4"
      >
        <input type="hidden" name="slug" value={product.slug} />

        <div>
          <label className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
            Product name <span className="text-red-500">*</span>
          </label>
          <input type="text" name="name" required defaultValue={product.name} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ProductTypeField
            categories={categories}
            defaultValue={product.categoryLabel}
          />
          <div>
            <label className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
              Size <span className="text-red-500">*</span>
            </label>
            <input type="text" name="size" required defaultValue={product.size} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
            Price (RM) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="price"
            required
            min={0}
            step="0.01"
            defaultValue={product.price}
            className={inputClass}
          />
        </div>

        <div>
          <ProductPhotoField currentImageUrl={product.image} />
          <p className="mt-1.5 text-xs text-[#8d7a5c]">
            Biarkan kosong untuk kekalkan gambar sekarang.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-xl bg-[#201d17] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2e2a22]"
          >
            Save Changes
          </button>
          <Link
            href="/admin/products"
            className="rounded-xl border border-black/10 px-6 py-2.5 text-sm font-semibold text-[#201d17] transition hover:bg-[#f7f2ea]"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
