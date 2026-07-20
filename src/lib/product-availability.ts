import type { Product } from "@/data/products";

type ProductAvailabilityLabel = "Available" | "Pre-order" | "Sold Out";

/**
 * Tracked-stock display rule: more than this many units in stock shows as
 * available; 1..threshold shows as Pre-order (still purchasable, restocking);
 * 0 or fewer is Sold Out.
 */
export const PREORDER_THRESHOLD = 10;

function labelForTrackedQuantity(quantity: number): ProductAvailabilityLabel {
  if (quantity <= 0) return "Sold Out";
  if (quantity <= PREORDER_THRESHOLD) return "Pre-order";
  return "Available";
}

export function getStorefrontAvailabilityLabel(
  product: Pick<Product, "details" | "availability" | "quantity">,
): ProductAvailabilityLabel {
  // Only stock set in Manage Stock can show as In stock: more than the
  // threshold is Available, 1..threshold is Pre-order, 0 is Sold Out.
  if (typeof product.quantity === "number") {
    return labelForTrackedQuantity(product.quantity);
  }

  // Until admin sets a quantity, a product is Pre-order by default — never shown
  // as In stock — unless it has been explicitly marked Sold Out.
  return product.availability === "Sold Out" ? "Sold Out" : "Pre-order";
}

export function isProductAvailableNow(
  product: Pick<Product, "details" | "availability" | "quantity">,
) {
  return getStorefrontAvailabilityLabel(product) === "Available";
}

/** False only when Sold Out — Pre-order still allows purchase (ships later). */
export function isProductPurchasable(
  product: Pick<Product, "details" | "availability" | "quantity">,
) {
  return getStorefrontAvailabilityLabel(product) !== "Sold Out";
}

export function getStorefrontProductDetails(
  product: Pick<Product, "details" | "availability" | "quantity">,
) {
  const availability = getStorefrontAvailabilityLabel(product);
  const isAvailableNow = availability === "Available";

  return product.details
    .filter((detail) => !isAvailableNow || detail.label !== "Lead time")
    .map((detail) =>
      detail.label === "Status" ? { ...detail, value: availability } : detail,
    );
}
