import { createAdminProductAction } from "@/app/admin/actions";
import { requirePermission } from "@/lib/staff-auth";
import { getProductsWithStock } from "@/lib/product-stock";
import { ProductTypeField } from "../product-type-field";
import { ProductPhotoField } from "../product-photo-field";

type NewProductPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  "missing-fields": "Please fill in name, category, size, and a valid price.",
  "missing-image": "Please choose a product photo.",
};

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  await requirePermission("products");
  const { error } = await searchParams;
  const message = error ? (ERROR_MESSAGES[error] ?? error) : null;

  const products = await getProductsWithStock();
  const categories = [...new Set(products.map((p) => p.categoryLabel))].sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <div>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8d7a5c]">
        Catalog
      </p>
      <h2 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
        Add Product
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#5d574f]">
        Add a new product to the store. It shows up on the site, Manage Stock,
        Counter Sale, and Print Labels right away.
      </p>

      {message ? (
        <p className="mt-6 max-w-lg rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-4 py-3 text-sm leading-6 text-[#8b5e1d]">
          {message}
        </p>
      ) : null}

      <form
        action={createAdminProductAction}
        encType="multipart/form-data"
        className="mt-8 max-w-lg space-y-4"
      >
        <div>
          <label className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
            Product name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            required
            placeholder="e.g. Calm Mousseline Pandan 60ml"
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#a07850] focus:ring-2 focus:ring-[#a07850]/20"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ProductTypeField categories={categories} />

          <div>
            <label className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
              Size <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="size"
              required
              placeholder="e.g. 60ml"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#a07850] focus:ring-2 focus:ring-[#a07850]/20"
            />
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
            placeholder="62.00"
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#a07850] focus:ring-2 focus:ring-[#a07850]/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
            Short description
          </label>
          <input
            type="text"
            name="excerpt"
            placeholder="One line shown on product cards"
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#a07850] focus:ring-2 focus:ring-[#a07850]/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
            Full description
          </label>
          <textarea
            name="description"
            rows={4}
            placeholder="Shown on the product page"
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#a07850] focus:ring-2 focus:ring-[#a07850]/20"
          />
        </div>

        <ProductPhotoField required />

        <button
          type="submit"
          className="w-full rounded-xl bg-[#201d17] py-2.5 text-sm font-semibold text-white transition hover:bg-[#2e2a22]"
        >
          Add Product
        </button>
      </form>
    </div>
  );
}
