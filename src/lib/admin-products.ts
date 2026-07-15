import type { Product } from "@/data/products";
import { getSupabaseAdmin, isSupabaseOrderStoreConfigured } from "@/lib/supabase-admin";

type AdminProductRow = {
  slug: string;
  name: string;
  short_name: string;
  category_label: string;
  size: string;
  price: number;
  excerpt: string;
  description: string;
  image_url: string;
  availability: Product["availability"];
};

function fromRow(row: AdminProductRow): Product {
  return {
    id: row.slug,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    categoryLabel: row.category_label,
    categorySlugs: [],
    size: row.size,
    price: Number(row.price),
    availability: row.availability,
    excerpt: row.excerpt,
    description: row.description,
    scentNotes: [],
    ritual: [],
    details: [],
    image: row.image_url,
    gallery: [row.image_url],
    accent: "#8d7a5c",
    relatedSlugs: [],
  };
}

export async function getAdminProducts(): Promise<Product[]> {
  if (!isSupabaseOrderStoreConfigured()) {
    return [];
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("admin_products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return [];
    }

    return (data as AdminProductRow[]).map(fromRow);
  } catch {
    return [];
  }
}

export async function getAdminProductBySlug(slug: string): Promise<Product | null> {
  if (!isSupabaseOrderStoreConfigured()) {
    return null;
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("admin_products")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return fromRow(data as AdminProductRow);
  } catch {
    return null;
  }
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type CreateAdminProductInput = {
  name: string;
  categoryLabel: string;
  size: string;
  price: number;
  excerpt: string;
  description: string;
  imageUrl: string;
};

export async function createAdminProduct(input: CreateAdminProductInput) {
  if (!isSupabaseOrderStoreConfigured()) {
    throw new Error("Supabase is not configured — cannot save this product.");
  }

  const baseSlug = slugify(input.name);
  if (!baseSlug) {
    throw new Error("Product name must contain at least one letter or number.");
  }

  const supabase = getSupabaseAdmin();

  // Ensure the slug is unique against both the static catalog and existing admin products.
  const { getProductBySlug } = await import("@/data/products");
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const staticMatch = getProductBySlug(slug);
    const { data: existing } = await supabase
      .from("admin_products")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (!staticMatch && !existing) break;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const { error } = await supabase.from("admin_products").insert({
    slug,
    name: input.name,
    short_name: input.name,
    category_label: input.categoryLabel,
    size: input.size,
    price: input.price,
    excerpt: input.excerpt,
    description: input.description || input.excerpt,
    image_url: input.imageUrl,
    availability: "In stock",
  });

  if (error) {
    throw new Error(`Unable to create product: ${error.message}`);
  }

  return slug;
}

export async function uploadProductImage(file: File): Promise<string> {
  if (!isSupabaseOrderStoreConfigured()) {
    throw new Error("Supabase is not configured — cannot upload images.");
  }

  const supabase = getSupabaseAdmin();
  const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { contentType: file.type || "image/jpeg" });

  if (error) {
    throw new Error(`Unable to upload image: ${error.message}`);
  }

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}
