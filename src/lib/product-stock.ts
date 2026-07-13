import { products, type Product } from "@/data/products";
import { getSupabaseAdmin, isSupabaseOrderStoreConfigured } from "@/lib/supabase-admin";

type StockRow = {
  slug: string;
  availability: Product["availability"];
  quantity: number | null;
};

type StockOverride = {
  availability: Product["availability"];
  quantity: number | null;
};

async function getStockOverrides(): Promise<Map<string, StockOverride>> {
  if (!isSupabaseOrderStoreConfigured()) {
    return new Map();
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("product_stock")
      .select("slug, availability, quantity");

    if (error) {
      return new Map();
    }

    return new Map(
      (data as StockRow[]).map((row) => [
        row.slug,
        { availability: row.availability, quantity: row.quantity },
      ]),
    );
  } catch {
    return new Map();
  }
}

function withOverride(product: Product, override: StockOverride): Product {
  // The "Inventory" detail (e.g. "SAMPLE QUANTITY") takes priority over the
  // `availability` flag in the actual storefront logic (see product-availability.ts).
  // Clear it so an explicit stock override here isn't silently ignored.
  const details = product.details.map((detail) =>
    detail.label.trim().toLowerCase() === "inventory"
      ? { ...detail, value: "" }
      : detail,
  );

  return {
    ...product,
    availability: override.availability,
    quantity: override.quantity,
    details,
  };
}

function applyOverrides(list: Product[], overrides: Map<string, StockOverride>) {
  return list.map((product) => {
    const override = overrides.get(product.slug);
    return override ? withOverride(product, override) : product;
  });
}

export async function getProductsWithStock(): Promise<Product[]> {
  const overrides = await getStockOverrides();
  return applyOverrides(products, overrides);
}

export async function getProductBySlugWithStock(slug: string): Promise<Product | null> {
  const product = products.find((entry) => entry.slug === slug);
  if (!product) return null;

  const overrides = await getStockOverrides();
  const override = overrides.get(slug);
  return override ? withOverride(product, override) : product;
}

/** For checkout: current tracked quantity per slug. Null = not tracked (unlimited/pre-order). */
export async function getQuantitiesForSlugs(
  slugs: string[],
): Promise<Map<string, number | null>> {
  const overrides = await getStockOverrides();
  const result = new Map<string, number | null>();
  for (const slug of slugs) {
    result.set(slug, overrides.get(slug)?.quantity ?? null);
  }
  return result;
}

/** Sets an exact tracked quantity. quantity > 0 -> "In stock", 0 -> "Sold Out". */
export async function setProductQuantity(slug: string, quantity: number) {
  if (!isSupabaseOrderStoreConfigured()) {
    throw new Error("Supabase is not configured — cannot save stock changes.");
  }

  const safeQuantity = Math.max(0, Math.floor(quantity));
  const availability: Product["availability"] = safeQuantity > 0 ? "In stock" : "Sold Out";

  const { error } = await getSupabaseAdmin()
    .from("product_stock")
    .upsert(
      {
        slug,
        availability,
        quantity: safeQuantity,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    );

  if (error) {
    throw new Error(`Unable to update stock: ${error.message}`);
  }
}

/** Marks a product as pre-order — purchasable, but not tracked by quantity. */
export async function markProductPreorder(slug: string) {
  if (!isSupabaseOrderStoreConfigured()) {
    throw new Error("Supabase is not configured — cannot save stock changes.");
  }

  const { error } = await getSupabaseAdmin()
    .from("product_stock")
    .upsert(
      {
        slug,
        availability: "Pre-order",
        quantity: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    );

  if (error) {
    throw new Error(`Unable to update stock: ${error.message}`);
  }
}

/** Fast mall-counter decrement — atomic, never goes below 0. Amount defaults to 1 ("Sold 1"). */
export async function quickDecrementStock(slug: string, amount = 1) {
  if (!isSupabaseOrderStoreConfigured()) {
    throw new Error("Supabase is not configured — cannot update stock.");
  }

  const { error } = await getSupabaseAdmin().rpc("decrement_product_stock", {
    p_slug: slug,
    p_amount: amount,
  });

  if (error) {
    throw new Error(`Unable to update stock: ${error.message}`);
  }
}

/** Called after a paid order to decrement stock for every tracked line item. Never throws — logs and continues. */
export async function decrementStockForOrderLines(
  lines: Array<{ slug: string | null; quantity: number }>,
) {
  if (!isSupabaseOrderStoreConfigured()) {
    return;
  }

  const supabase = getSupabaseAdmin();

  for (const line of lines) {
    if (!line.slug || line.quantity <= 0) continue;

    try {
      const { error } = await supabase.rpc("decrement_product_stock", {
        p_slug: line.slug,
        p_amount: line.quantity,
      });

      if (error) {
        console.error(`Stock decrement failed for ${line.slug}:`, error.message);
      }
    } catch (error) {
      console.error(`Stock decrement failed for ${line.slug}:`, error);
    }
  }
}
