"use client";

import { useCart } from "@/components/cart-context";

type AddToCartButtonProps = {
  productSlug: string;
  className?: string;
  label?: string;
};

export function AddToCartButton({
  productSlug,
  className,
  label = "Add to cart",
}: AddToCartButtonProps) {
  const { addItem } = useCart();

  return (
    <button
      type="button"
      onClick={() => addItem(productSlug)}
      className={className}
    >
      {label}
    </button>
  );
}
