"use client";

import { useState } from "react";
import { useCart } from "@/components/cart-context";
import { startCheckout } from "@/lib/checkout";

type ProductPurchaseControlsProps = {
  productSlug: string;
};

export function ProductPurchaseControls({
  productSlug,
}: ProductPurchaseControlsProps) {
  const [quantity, setQuantity] = useState(1);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const { addItem } = useCart();

  function addToCart() {
    setCheckoutError("");
    addItem(productSlug, quantity);
  }

  async function buyNow() {
    if (isBuyingNow) {
      return;
    }

    setCheckoutError("");
    setIsBuyingNow(true);

    try {
      await startCheckout([{ slug: productSlug, quantity }]);
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Unable to start checkout right now.",
      );
      setIsBuyingNow(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white/62">
          Quantity
        </p>
        <div className="inline-flex items-center rounded-full border border-white/12 bg-black/20 text-white">
          <button
            type="button"
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            className="flex h-9 w-9 items-center justify-center text-lg"
            aria-label="Decrease quantity"
          >
            -
          </button>
          <span className="flex h-9 min-w-9 items-center justify-center border-x border-white/12 px-3 text-sm">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((current) => current + 1)}
            className="flex h-9 w-9 items-center justify-center text-lg"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={addToCart}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#fff2b6] px-5 text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-[#171717] transition hover:opacity-90"
        >
          Add to Cart
        </button>
        <button
          type="button"
          onClick={buyNow}
          disabled={isBuyingNow}
          className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/12 bg-white/6 px-5 text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isBuyingNow ? "Redirecting..." : "Buy Now"}
        </button>
        {checkoutError ? (
          <p className="rounded-[1rem] bg-[#2a241c] px-4 py-3 text-sm leading-6 text-[#f6c7b2]">
            {checkoutError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
