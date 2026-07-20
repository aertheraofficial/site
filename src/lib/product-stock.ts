import { products, type Product } from "@/data/products";
import { getAdminProductBySlug, getAdminProducts } from "@/lib/admin-products";
import {
  applyProductOverride,
  applyProductOverrides,
  getProductOverrides,
} from "@/lib/product-overrides";
import { getSupabaseAdmin, isSupabaseOrderStoreConfigured } from "@/lib/supabase-admin";

export const ONLINE_LOCATION = "online";

export const SHOP_LOCATIONS = [
  { id: "destina-putrajaya", name: "Destina Putrajaya" },
  { id: "merdeka-tower-118", name: "Merdeka Tower 118" },
] as const;

export const ALL_LOCATIONS = [
  { id: ONLINE_LOCATION, name: "Online / Warehouse" },
  ...SHOP_LOCATIONS,
] as const;

export type LocationId = (typeof ALL_LOCATIONS)[number]["id"];

export function isLocationId(value: unknown): value is LocationId {
  return ALL_LOCATIONS.some((loc) => loc.id === value);
}

export function getLocationName(id: string) {
  return ALL_LOCATIONS.find((loc) => loc.id === id)?.name ?? id;
}

type StockRow = {
  slug: string;
  availability: Product["availability"];
  quantity: number | null;
};

type StockOverride = {
  availability: Product["availability"];
  quantity: number | null;
};

async function getStockOverrides(location: string): Promise<Map<string, StockOverride>> {
  if (!isSupabaseOrderStoreConfigured()) {
    return new Map();
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("product_stock")
      .select("slug, availability, quantity")
      .eq("location", location);

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

/** Customer-facing / catalog use — always the online pool. */
export async function getProductsWithStock(): Promise<Product[]> {
  const [overrides, adminProducts, productOverrides] = await Promise.all([
    getStockOverrides(ONLINE_LOCATION),
    getAdminProducts(),
    getProductOverrides(),
  ]);
  // Admin field edits (price/name/…) first, then stock (quantity/availability) wins.
  const edited = applyProductOverrides([...products, ...adminProducts], productOverrides);
  return applyOverrides(edited, overrides);
}

export async function getProductBySlugWithStock(slug: string): Promise<Product | null> {
  const base =
    products.find((entry) => entry.slug === slug) ?? (await getAdminProductBySlug(slug));
  if (!base) return null;

  const [overrides, productOverrides] = await Promise.all([
    getStockOverrides(ONLINE_LOCATION),
    getProductOverrides(),
  ]);
  const edit = productOverrides.get(slug);
  const product = edit ? applyProductOverride(base, edit) : base;
  const override = overrides.get(slug);
  return override ? withOverride(product, override) : product;
}

/** Admin use — stock for a specific shop/warehouse location. */
export async function getProductsWithStockAtLocation(location: string): Promise<Product[]> {
  const [overrides, adminProducts, productOverrides] = await Promise.all([
    getStockOverrides(location),
    getAdminProducts(),
    getProductOverrides(),
  ]);
  const edited = applyProductOverrides([...products, ...adminProducts], productOverrides);
  return applyOverrides(edited, overrides);
}

/** For checkout: current tracked quantity per slug in the online pool. Null = not tracked. */
export async function getQuantitiesForSlugs(
  slugs: string[],
  location: string = ONLINE_LOCATION,
): Promise<Map<string, number | null>> {
  const overrides = await getStockOverrides(location);
  const result = new Map<string, number | null>();
  for (const slug of slugs) {
    result.set(slug, overrides.get(slug)?.quantity ?? null);
  }
  return result;
}

/** Sets an exact tracked quantity for a location. quantity > 0 -> "In stock", 0 -> "Sold Out". */
export async function setProductQuantity(slug: string, quantity: number, location: string) {
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
        location,
        availability,
        quantity: safeQuantity,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug,location" },
    );

  if (error) {
    throw new Error(`Unable to update stock: ${error.message}`);
  }
}

/** Marks a product as pre-order at a location — purchasable, but not tracked by quantity. */
export async function markProductPreorder(slug: string, location: string) {
  if (!isSupabaseOrderStoreConfigured()) {
    throw new Error("Supabase is not configured — cannot save stock changes.");
  }

  const { error } = await getSupabaseAdmin()
    .from("product_stock")
    .upsert(
      {
        slug,
        location,
        availability: "Pre-order",
        quantity: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug,location" },
    );

  if (error) {
    throw new Error(`Unable to update stock: ${error.message}`);
  }
}

/** Fast mall-counter decrement at a location — atomic, never goes below 0. Amount defaults to 1 ("Sold 1"). */
export async function quickDecrementStock(slug: string, location: string, amount = 1) {
  if (!isSupabaseOrderStoreConfigured()) {
    throw new Error("Supabase is not configured — cannot update stock.");
  }

  const { error } = await getSupabaseAdmin().rpc("decrement_product_stock", {
    p_slug: slug,
    p_amount: amount,
    p_location: location,
  });

  if (error) {
    throw new Error(`Unable to update stock: ${error.message}`);
  }
}

/** Called after a paid order to decrement stock for every tracked line item at a location. Never throws — logs and continues. */
export async function decrementStockForOrderLines(
  lines: Array<{ slug: string | null; quantity: number }>,
  location: string = ONLINE_LOCATION,
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
        p_location: location,
      });

      if (error) {
        console.error(`Stock decrement failed for ${line.slug}:`, error.message);
      }
    } catch (error) {
      console.error(`Stock decrement failed for ${line.slug}:`, error);
    }
  }
}
