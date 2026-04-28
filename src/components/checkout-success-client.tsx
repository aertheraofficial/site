"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart-context";

export function CheckoutSuccessClient() {
  const { clearCart, closeCart } = useCart();

  useEffect(() => {
    clearCart();
    closeCart();
  }, [clearCart, closeCart]);

  return null;
}
