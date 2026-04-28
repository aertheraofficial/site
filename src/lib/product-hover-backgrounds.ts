import type { Product } from "@/data/products";

export function getProductHoverBackgroundSrc(product: Pick<Product, "slug">) {
  return `/assets/brand/product-card-hover/${product.slug}.svg`;
}
