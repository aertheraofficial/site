"use client";

import { useCart } from "@/components/cart-context";

type AddToCartButtonProps = {
  productSlug: string;
  className?: string;
  label?: string;
  disabled?: boolean;
};

export function AddToCartButton({
  productSlug,
  className,
  label = "Add to cart",
  disabled = false,
}: AddToCartButtonProps) {
  const { addItem } = useCart();

  return (
    <button
      type="button"
      onClick={() => addItem(productSlug)}
      disabled={disabled}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {label}
    </button>
  );
}
