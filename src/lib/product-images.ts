import type { Product } from "@/data/products";

function getProductImageExtension(product: Pick<Product, "image">) {
  const extensionIndex = product.image.lastIndexOf(".");
  return extensionIndex >= 0 ? product.image.slice(extensionIndex) : "";
}

function getMainProductImageSrc(product: Pick<Product, "slug" | "image">) {
  return `/assets/products/main/${product.slug}${getProductImageExtension(product)}`;
}

const PRODUCT_IMAGE_FILENAME_OVERRIDES: Record<string, string> = {
  "body-cleanse-shower-oil-lemongrass-malaya-230ml":
    "/assets/products/main/body-cleanse-shower-oil-lemongrass-malaya-230ml-20260422.png",
  "body-cleanse-shower-oil-pineapple-tropical-230ml":
    "/assets/products/main/body-cleanse-shower-oil-pineapple-tropical-230ml-20260422.png",
};

function getProductImageSrc(
  product: Pick<Product, "slug">,
) {
  return PRODUCT_IMAGE_FILENAME_OVERRIDES[product.slug];
}

export function getCatalogCardImageSrc(product: Pick<Product, "slug" | "image">) {
  return getProductImageSrc(product) ?? getMainProductImageSrc(product);
}

export function getProductDetailImageSrc(product: Pick<Product, "slug" | "image">) {
  return getProductImageSrc(product) ?? getMainProductImageSrc(product);
}

const PRODUCT_IMAGE_CLASS_OVERRIDES: Record<
  string,
  {
    card?: string;
    detail?: string;
  }
> = {
  "scented-oil-pink-chiffon-10ml": {
    detail: "scale-[1.15] sm:scale-[1.22]",
  },
};

export function getCatalogCardImageClassName(product: Pick<Product, "slug">) {
  return PRODUCT_IMAGE_CLASS_OVERRIDES[product.slug]?.card ?? "";
}

export function getProductDetailImageClassName(product: Pick<Product, "slug">) {
  return PRODUCT_IMAGE_CLASS_OVERRIDES[product.slug]?.detail ?? "";
}
