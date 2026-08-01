"use client";

import Image from "next/image";
import { useState } from "react";
import { updateProductAction } from "@/app/admin/actions";

const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#a07850] focus:ring-2 focus:ring-[#a07850]/20";

type StockEditModalProps = {
  product: {
    slug: string;
    name: string;
    categoryLabel: string;
    size: string;
    price: number;
    image: string;
    excerpt: string;
    description: string;
  };
  categories: string[];
  /** Where to return after saving (keeps the current Manage Stock filters). */
  returnTo: string;
};

export function StockEditModal({ product, categories, returnTo }: StockEditModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center whitespace-nowrap rounded-full bg-[#201d17] px-3.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#2f2a22]"
      >
        Edit
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${product.name}`}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-h-full w-full max-w-lg overflow-y-auto rounded-[1.5rem] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#f2ece2] text-[#201d17] transition hover:bg-[#e6dccd]"
            >
              ✕
            </button>

            <h2 className="font-display text-[1.6rem] leading-none tracking-[-0.04em] text-[#201d17]">
              Edit Product
            </h2>
            <p className="mt-2 text-sm text-[#5d574f]">{product.name}</p>

            <form
              action={updateProductAction}
              encType="multipart/form-data"
              className="mt-6 space-y-4"
            >
              <input type="hidden" name="slug" value={product.slug} />
              <input type="hidden" name="redirectTo" value={returnTo} />

              <div>
                <label className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
                  Product name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={product.name}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="categoryLabel"
                    defaultValue={product.categoryLabel}
                    className={inputClass}
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    name="newCategoryLabel"
                    placeholder="Or type a new category"
                    className={`mt-2 ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
                    Size <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="size"
                    required
                    defaultValue={product.size}
                    className={inputClass}
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
                  defaultValue={product.price}
                  className={inputClass}
                />
              </div>

              {/*
                The same two fields Add Product has. Without them the copy that
                explains what is in a product could be set once, at creation,
                and never corrected — and for catalog products shipped in code,
                never set from the admin at all.
              */}
              <div>
                <label
                  htmlFor="edit-excerpt"
                  className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]"
                >
                  Short description
                </label>
                <input
                  id="edit-excerpt"
                  type="text"
                  name="excerpt"
                  defaultValue={product.excerpt}
                  placeholder="One line shown on product cards"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-description"
                  className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]"
                >
                  Full description
                </label>
                <textarea
                  id="edit-description"
                  name="description"
                  rows={4}
                  defaultValue={product.description}
                  placeholder="What is in it, how to use it — shown on the product page"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
                  Product photo
                </label>
                <div className="flex items-center gap-3">
                  <Image
                    src={product.image}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <input type="file" name="image" accept="image/*" className={inputClass} />
                </div>
                <p className="mt-1 text-xs text-[#8d7a5c]">
                  Leave empty to keep the current photo.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="rounded-xl bg-[#201d17] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2e2a22]"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-black/10 px-6 py-2.5 text-sm font-semibold text-[#201d17] transition hover:bg-[#f7f2ea]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
