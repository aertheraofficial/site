import type { Product } from "@/data/products";

type ProductAvailabilityLabel = "Available" | "Pre-order";

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

export function isProductAvailableNow(
  product: Pick<Product, "details" | "availability">,
) {
  const inventoryValue = getInventoryValue(product);
  const inventoryCount = getInventoryCount(inventoryValue);

  if (inventoryCount !== null) {
    return inventoryCount > 0;
  }

  if (inventoryValue.trim()) {
    return false;
  }

  return product.availability === "In stock";
}

export function getStorefrontAvailabilityLabel(
  product: Pick<Product, "details" | "availability">,
): ProductAvailabilityLabel {
  return isProductAvailableNow(product) ? "Available" : "Pre-order";
}

export function getStorefrontProductDetails(
  product: Pick<Product, "details" | "availability">,
) {
  const availability = getStorefrontAvailabilityLabel(product);
  const isAvailableNow = availability === "Available";

  return product.details
    .filter((detail) => !isAvailableNow || detail.label !== "Lead time")
    .map((detail) =>
      detail.label === "Status" ? { ...detail, value: availability } : detail,
    );
}
