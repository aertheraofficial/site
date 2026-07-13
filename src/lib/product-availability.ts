import type { Product } from "@/data/products";

type ProductAvailabilityLabel = "Available" | "Pre-order" | "Sold Out";

function getInventoryValue(product: Pick<Product, "details">) {
  return (
    product.details.find(
      (detail) => detail.label.trim().toLowerCase() === "inventory",
    )?.value ?? ""
  );
}

function getInventoryCount(inventoryValue: string) {
  const numericMatch = inventoryValue.replaceAll(",", "").match(/\d+(?:\.\d+)?/);

  if (!numericMatch) {
    return null;
  }

  return Number(numericMatch[0]);
}

export function getStorefrontAvailabilityLabel(
  product: Pick<Product, "details" | "availability" | "quantity">,
): ProductAvailabilityLabel {
  // Tracked quantity (from the Manage Stock admin page) is authoritative when set.
  if (typeof product.quantity === "number") {
    return product.quantity > 0 ? "Available" : "Sold Out";
  }

  if (product.availability === "Sold Out") {
    return "Sold Out";
  }

  const inventoryValue = getInventoryValue(product);
  const inventoryCount = getInventoryCount(inventoryValue);

  if (inventoryCount !== null) {
    return inventoryCount > 0 ? "Available" : "Sold Out";
  }

  if (inventoryValue.trim()) {
    return "Pre-order";
  }

  return product.availability === "In stock" ? "Available" : "Pre-order";
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
