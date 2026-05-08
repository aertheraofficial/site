import catalogData from "../../content/catalog.json";

export type Product = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  categoryLabel: string;
  categorySlugs: string[];
  size: string;
  sku?: string;
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

  if ("sku" in product && product.sku !== undefined && typeof product.sku !== "string") {
    throw new Error(`Catalog product "${product.slug}" has an invalid sku.`);
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

const rawProducts = catalogData.products as unknown[];

rawProducts.forEach(assertProduct);

export const products: Product[] = (rawProducts as Product[]).map(
  normalizeProductImagePaths,
);

const productMap = new Map(products.map((product) => [product.slug, product]));

export function getProductBySlug(slug: string) {
  return productMap.get(slug);
}

export function getProductsBySlugs(slugs: string[]) {
  return slugs
    .map((slug) => productMap.get(slug))
    .filter((product): product is Product => Boolean(product));
}

export function getRelatedProducts(product: Product) {
  return getProductsBySlugs(product.relatedSlugs);
}
