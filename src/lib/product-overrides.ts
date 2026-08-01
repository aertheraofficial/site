import type { Product } from "@/data/products";
import { getSupabaseAdmin, isSupabaseOrderStoreConfigured } from "@/lib/supabase-admin";

// Editable catalog fields. Every column is optional — only the ones set in the
// admin edit form override the catalog; the rest fall back to catalog.json.
export type ProductOverride = {
  name?: string | null;
  shortName?: string | null;
  categoryLabel?: string | null;
  size?: string | null;
  price?: number | null;
  imageUrl?: string | null;
  availability?: Product["availability"] | null;
  /** One line on product cards. */
  excerpt?: string | null;
  /** The full copy on the product page — what is in it, how to use it. */
  description?: string | null;
};

type OverrideRow = {
  slug: string;
  name: string | null;
  short_name: string | null;
  category_label: string | null;
  size: string | null;
  price: number | null;
  image_url: string | null;
  availability: Product["availability"] | null;
  excerpt: string | null;
  description: string | null;
};

export async function getProductOverrides(): Promise<Map<string, ProductOverride>> {
  if (!isSupabaseOrderStoreConfigured()) return new Map();

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("product_overrides")
      .select(
        "slug, name, short_name, category_label, size, price, image_url, availability, excerpt, description",
      );
    if (error) return new Map();

    return new Map(
      (data as OverrideRow[]).map((row) => [
        row.slug,
        {
          name: row.name,
          shortName: row.short_name,
          categoryLabel: row.category_label,
          size: row.size,
          price: row.price === null ? null : Number(row.price),
          imageUrl: row.image_url,
          availability: row.availability,
          excerpt: row.excerpt,
          description: row.description,
        },
      ]),
    );
  } catch {
    return new Map();
  }
}

/** Apply an override to a product — only fields that are set (non-null) win. */
export function applyProductOverride(product: Product, override: ProductOverride): Product {
  const next = { ...product };
  if (override.name) next.name = override.name;
  if (override.shortName) next.shortName = override.shortName;
  if (override.categoryLabel) next.categoryLabel = override.categoryLabel;
  if (override.size) next.size = override.size;
  if (typeof override.price === "number") next.price = override.price;
  if (override.availability) next.availability = override.availability;
  if (override.excerpt) next.excerpt = override.excerpt;
  if (override.description) next.description = override.description;
  if (override.imageUrl) {
    next.image = override.imageUrl;
    next.gallery = [override.imageUrl];
  }
  return next;
}

export function applyProductOverrides(
  list: Product[],
  overrides: Map<string, ProductOverride>,
): Product[] {
  if (overrides.size === 0) return list;
  return list.map((product) => {
    const override = overrides.get(product.slug);
    return override ? applyProductOverride(product, override) : product;
  });
}

/** Save (upsert) an admin edit. Only the provided fields are written. */
export async function setProductOverride(slug: string, fields: ProductOverride) {
  if (!isSupabaseOrderStoreConfigured()) {
    throw new Error("Supabase is not configured — cannot save product edits.");
  }

  const row: Record<string, unknown> = { slug, updated_at: new Date().toISOString() };
  if (fields.name !== undefined) row.name = fields.name;
  if (fields.shortName !== undefined) row.short_name = fields.shortName;
  if (fields.categoryLabel !== undefined) row.category_label = fields.categoryLabel;
  if (fields.size !== undefined) row.size = fields.size;
  if (fields.price !== undefined) row.price = fields.price;
  if (fields.imageUrl !== undefined) row.image_url = fields.imageUrl;
  if (fields.availability !== undefined) row.availability = fields.availability;
  if (fields.excerpt !== undefined) row.excerpt = fields.excerpt;
  if (fields.description !== undefined) row.description = fields.description;

  const { error } = await getSupabaseAdmin()
    .from("product_overrides")
    .upsert(row, { onConflict: "slug" });

  if (error) {
    throw new Error(`Unable to save product: ${error.message}`);
  }
}
