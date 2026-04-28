import catalogData from "../../content/catalog.json";

export type Product = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  categoryLabel: string;
  categorySlugs: string[];
  size: string;
  price: number;
  compareAtPrice?: number;
  badge?: string;
  availability: "In stock" | "Pre-order";
  leadTime?: string;
  excerpt: string;
  description: string;
  scentNotes: string[];
  ritual: string[];
  details: Array<{
    label: string;
    value: string;
  }>;
  image: string;
  gallery: string[];
  accent: string;
  relatedSlugs: string[];
};

export type Category = {
  slug: string;
  name: string;
  eyebrow: string;
  description: string;
  intro: string;
  heroImage: string;
  productSlugs: string[];
};

function getProductImageExtension(image: string) {
  const extensionIndex = image.lastIndexOf(".");
  return extensionIndex >= 0 ? image.slice(extensionIndex) : "";
}

function getMainProductImageSrc(slug: string, image: string) {
  return `/assets/products/main/${slug}${getProductImageExtension(image)}`;
}

function normalizeProductImagePaths(product: Product): Product {
  const image = getMainProductImageSrc(product.slug, product.image);

  return {
    ...product,
    image,
    gallery: [image],
  };
}

function assertProduct(candidate: unknown): asserts candidate is Product {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Invalid product entry in catalog content.");
  }

  const product = candidate as Record<string, unknown>;
  const requiredStringFields = [
    "id",
    "slug",
    "name",
    "shortName",
    "categoryLabel",
    "size",
    "excerpt",
    "description",
    "image",
    "accent",
  ];

  for (const field of requiredStringFields) {
    if (typeof product[field] !== "string" || product[field] === "") {
      throw new Error(`Catalog product is missing required field "${field}".`);
    }
  }

  if (typeof product.price !== "number" || Number.isNaN(product.price)) {
    throw new Error(`Catalog product "${product.slug}" has an invalid price.`);
  }

  for (const field of ["categorySlugs", "scentNotes", "ritual", "gallery", "relatedSlugs"]) {
    if (!Array.isArray(product[field])) {
      throw new Error(`Catalog product "${product.slug}" has an invalid "${field}" field.`);
    }
  }

  if (!Array.isArray(product.details)) {
    throw new Error(`Catalog product "${product.slug}" has invalid details.`);
  }
}

function assertCategory(candidate: unknown): asserts candidate is Category {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Invalid category entry in catalog content.");
  }

  const category = candidate as Record<string, unknown>;
  const requiredStringFields = [
    "slug",
    "name",
    "eyebrow",
    "description",
    "intro",
    "heroImage",
  ];

  for (const field of requiredStringFields) {
    if (typeof category[field] !== "string" || category[field] === "") {
      throw new Error(`Catalog category is missing required field "${field}".`);
    }
  }

  if (!Array.isArray(category.productSlugs)) {
    throw new Error(`Catalog category "${category.slug}" has invalid productSlugs.`);
  }
}

const rawProducts = catalogData.products as unknown[];
const rawCategories = catalogData.categories as unknown[];

rawProducts.forEach(assertProduct);
rawCategories.forEach(assertCategory);

export const products: Product[] = (rawProducts as Product[]).map(
  normalizeProductImagePaths,
);
export const categories: Category[] = rawCategories as Category[];

const productMap = new Map(products.map((product) => [product.slug, product]));
const categoryMap = new Map(categories.map((category) => [category.slug, category]));

export function getProductBySlug(slug: string) {
  return productMap.get(slug);
}

export function getCategoryBySlug(slug: string) {
  return categoryMap.get(slug);
}

export function getProductsBySlugs(slugs: string[]) {
  return slugs
    .map((slug) => productMap.get(slug))
    .filter((product): product is Product => Boolean(product));
}

export function getProductsForCategory(slug: string) {
  const category = getCategoryBySlug(slug);

  if (!category) {
    return [];
  }

  return getProductsBySlugs(category.productSlugs);
}

export function getRelatedProducts(product: Product) {
  return getProductsBySlugs(product.relatedSlugs);
}
