"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getProductBySlug } from "@/data/products";

type CartLine = {
  slug: string;
  quantity: number;
};

type CartContextValue = {
  items: Array<{
    slug: string;
    quantity: number;
    product: NonNullable<ReturnType<typeof getProductBySlug>>;
  }>;
  count: number;
  subtotal: number;
  isOpen: boolean;
  addItem: (slug: string, quantity?: number) => void;
  updateItem: (slug: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "aerthera-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        setHasLoadedStorage(true);
        return;
      }

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        window.localStorage.removeItem(STORAGE_KEY);
        setHasLoadedStorage(true);
        return;
      }

      setLines(
        parsed
          .filter(
            (line): line is CartLine =>
              typeof line === "object" &&
              line !== null &&
              typeof line.slug === "string" &&
              typeof line.quantity === "number" &&
              Number.isFinite(line.quantity) &&
              line.quantity > 0,
          )
          .map((line) => ({
            slug: line.slug,
            quantity: Math.floor(line.quantity),
          })),
      );
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHasLoadedStorage(true);
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!hasLoadedStorage) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Ignore storage write failures and keep the in-memory cart usable.
    }
  }, [hasLoadedStorage, lines]);

  const items = lines
    .map((line) => {
      const product = getProductBySlug(line.slug);

      if (!product) {
        return null;
      }

      return {
        slug: line.slug,
        quantity: line.quantity,
        product,
      };
    })
    .filter(
      (
        item,
      ): item is {
        slug: string;
        quantity: number;
        product: NonNullable<ReturnType<typeof getProductBySlug>>;
      } => Boolean(item),
    );

  const count = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );

  const addItem = useCallback((slug: string, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((line) => line.slug === slug);

      if (!existing) {
        return [...current, { slug, quantity }];
      }

      return current.map((line) =>
        line.slug === slug
          ? { ...line, quantity: line.quantity + quantity }
          : line,
      );
    });
    setIsOpen(true);
  }, []);

  const updateItem = useCallback((slug: string, quantity: number) => {
    setLines((current) =>
      current
        .map((line) =>
          line.slug === slug ? { ...line, quantity: Math.max(0, quantity) } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }, []);

  const clearCart = useCallback(() => {
    setLines([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage write failures and keep the in-memory cart usable.
    }
  }, []);

  const openCart = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <CartContext.Provider
      value={{
        items,
        count,
        subtotal,
        isOpen,
        addItem,
        updateItem,
        clearCart,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }

  return context;
}
