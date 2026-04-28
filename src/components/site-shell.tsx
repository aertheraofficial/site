"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useCart } from "@/components/cart-context";
import { categories, products } from "@/data/products";
import { siteInfo } from "@/data/site";
import { startCheckout } from "@/lib/checkout";
import { formatMoney } from "@/lib/money";

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="5.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function BagIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
      aria-hidden="true"
    >
      <path d="M5.5 8.5h13l-1.2 11H6.7l-1.2-11Z" />
      <path d="M9 9V7.5a3 3 0 0 1 6 0V9" />
    </svg>
  );
}

function SocialIcon({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const normalized = label.trim().toLowerCase();

  if (normalized === "instagram") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className={className}
        aria-hidden="true"
      >
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.25" cy="6.75" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (normalized === "facebook") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d="M13.35 20v-6.55h2.35l.36-2.72h-2.7V9.01c0-.79.22-1.33 1.35-1.33h1.44V5.24c-.25-.03-1.1-.1-2.1-.1-2.08 0-3.51 1.27-3.51 3.61v1.98H8.2v2.72h2.34V20h2.81Z" />
      </svg>
    );
  }

  if (normalized === "tiktok") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d="M14.22 4c.3 2.28 1.58 3.79 3.78 4.02v2.51c-1.45.14-2.72-.28-3.78-.97v4.72c0 3.53-1.53 5.82-5.02 5.82-2.8 0-4.94-1.9-4.94-4.77 0-3.18 2.58-4.98 5.71-4.87v2.65c-1.47-.12-3.03.62-3.03 2.23 0 1.31.93 2.17 2.09 2.17 1.61 0 2.48-1 2.48-3V4h2.71Z" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M5.15 5h3.46l3.56 4.77L16.33 5H19l-5.6 6.49L20 19h-3.47l-3.81-5.1L8.3 19H5.64l5.83-6.76L5.15 5Zm3.06 1.92h-1.1l8.73 10.17h1.1L8.21 6.92Z" />
    </svg>
  );
}

function useHasHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hasHydrated = useHasHydrated();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [cartError, setCartError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { items, count, subtotal, isOpen, openCart, closeCart, updateItem } =
    useCart();

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  const normalizedSearch = searchValue.trim().toLowerCase();
  const searchResults = products
    .filter((product) => {
      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        product.name,
        product.shortName,
        product.categoryLabel,
        product.excerpt,
        ...product.scentNotes,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    })
    .slice(0, 6);

  const searchCollections = categories.filter((category) => {
    if (!normalizedSearch) {
      return true;
    }

    const haystack = [category.name, category.description, category.intro]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });

  const isProductPage = pathname.startsWith("/product-page/");
  const isAdminPath = pathname.startsWith("/admin");
  const shellTone = isProductPage
    ? {
        background: "bg-[rgba(17,17,14,0.82)]",
        text: "text-white",
        footer: "border-white/10 bg-[#11110e] text-white",
      }
    : {
        background: "bg-[rgba(247,242,234,0.86)]",
        text: "text-[#201d17]",
        footer: "border-black/8 bg-[#efe6d9] text-[#201d17]",
      };

  async function handleCartCheckout() {
    if (items.length === 0 || isCheckingOut) {
      return;
    }

    setCartError("");
    setIsCheckingOut(true);

    try {
      await startCheckout(items.map((item) => ({ slug: item.slug, quantity: item.quantity })));
    } catch (error) {
      setCartError(
        error instanceof Error
          ? error.message
          : "Unable to start checkout right now.",
      );
      setIsCheckingOut(false);
    }
  }

  function handleOpenSearch() {
    setMenuOpen(false);
    setSearchOpen(true);
  }

  function handleOpenCart() {
    setMenuOpen(false);
    setSearchOpen(false);
    openCart();
  }

  if (isAdminPath) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        className={isProductPage ? "min-h-screen bg-[#11110e]" : "min-h-screen bg-[#f7f2ea]"}
      >
        <header
          className={`sticky top-0 z-40 border-b backdrop-blur-xl ${shellTone.background} ${shellTone.text} ${
            isProductPage ? "border-white/10" : "border-black/8"
          }`}
        >
          <div className="page-frame">
            <div className="flex items-center justify-between gap-4 py-4">
              <Link
                href="/"
                className="flex items-center gap-3"
                onClick={() => {
                  setMenuOpen(false);
                  setSearchOpen(false);
                }}
              >
                <span className="relative block h-[46px] w-[46px] overflow-hidden rounded-xl border border-black/8 bg-white sm:h-[52px] sm:w-[52px]">
                  <Image
                    src="/assets/brand/logo-lockup.jpeg"
                    alt="Aerthera"
                    fill
                    sizes="52px"
                    className="object-cover"
                  />
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block text-[0.78rem] font-semibold uppercase tracking-[0.22em]">
                    Aerthera
                  </span>
                  <span
                    className={`block text-[0.72rem] ${
                      isProductPage ? "text-white/60" : "text-[#6a6258]"
                    }`}
                  >
                    Lemongrass Malaya
                  </span>
                </span>
              </Link>

              <nav className="hidden items-center gap-6 text-[0.8rem] font-medium xl:gap-7 lg:flex">
                {siteInfo.primaryLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => {
                      setMenuOpen(false);
                      setSearchOpen(false);
                    }}
                    className={`transition ${
                      isProductPage
                        ? "text-white/72 hover:text-white"
                        : "text-[#51483d] hover:text-[#201d17]"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="flex items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={handleOpenSearch}
                  aria-label="Search the catalog"
                  aria-haspopup="dialog"
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                    isProductPage
                      ? "border-white/12 text-white hover:bg-white/8"
                      : "border-black/8 text-[#201d17] hover:bg-black/4"
                  }`}
                >
                  <SearchIcon className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setMenuOpen((current) => !current);
                  }}
                  className={`inline-flex min-h-10 items-center justify-center rounded-full border px-4 text-[0.72rem] font-semibold uppercase tracking-[0.16em] transition sm:px-5 ${
                    isProductPage
                      ? "border-white/12 text-white hover:bg-white/8"
                      : "border-black/8 text-[#201d17] hover:bg-black/4"
                  }`}
                  aria-expanded={menuOpen}
                  aria-label="Toggle menu"
                >
                  Menu
                </button>

                <button
                  type="button"
                  onClick={handleOpenCart}
                  className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                    isProductPage
                      ? "border-white/12 text-white hover:bg-white/8"
                      : "border-black/8 text-[#201d17] hover:bg-black/4"
                  }`}
                  aria-label="Open cart"
                >
                  <BagIcon className="h-5.5 w-5.5" />
                  {hasHydrated && count > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--menu)] px-1 text-[0.65rem] font-semibold text-white">
                      {count}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>

            {menuOpen ? (
              <div className={`border-t ${isProductPage ? "border-white/10" : "border-black/8"}`}>
                <div className="py-8">
                  <div className="wide-shell grid gap-8 lg:grid-cols-[1fr_1fr_0.9fr]">
                    <div className="space-y-4">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#9b8b78]">
                        Site Links
                      </p>
                      <div className="grid gap-3">
                        {siteInfo.primaryLinks.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setMenuOpen(false)}
                            className={`text-[1.2rem] font-semibold transition ${
                              isProductPage
                                ? "text-white hover:text-[#d8daf6]"
                                : "text-[#201d17] hover:text-[#6a6258]"
                            }`}
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#9b8b78]">
                        Shop & Info
                      </p>
                      <div className="grid gap-3">
                        {siteInfo.footerLinks.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setMenuOpen(false)}
                            className={`text-base transition ${
                              isProductPage
                                ? "text-white/80 hover:text-white"
                                : "text-[#51483d] hover:text-[#201d17]"
                            }`}
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#9b8b78]">
                        Contact
                      </p>
                      <div
                        className={`rounded-[1.75rem] border p-5 ${
                          isProductPage
                            ? "border-white/10 bg-white/4"
                            : "border-black/8 bg-white/72"
                        }`}
                      >
                        <p className="text-sm leading-7">
                          {siteInfo.phone}
                          <br />
                          {siteInfo.email}
                          <br />
                          {siteInfo.address}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <main className={isProductPage ? "bg-[#11110e]" : "bg-[#f7f2ea]"}>{children}</main>

        <footer className={`border-t ${shellTone.footer}`}>
          <div className="page-frame py-12 sm:py-14">
            <div className="wide-shell grid gap-10 lg:grid-cols-[1.2fr_0.7fr_0.8fr_1fr]">
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="relative h-[64px] w-[64px] overflow-hidden rounded-2xl border border-black/8 bg-white">
                    <Image
                      src="/assets/brand/logo-lockup.jpeg"
                      alt="Aerthera"
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-[0.78rem] font-semibold uppercase tracking-[0.22em]">
                      Aerthera
                    </p>
                    <p className={isProductPage ? "text-sm text-white/62" : "text-sm text-[#6a6258]"}>
                      Sustainable wellness rituals rooted in Lemongrass Malaya.
                    </p>
                  </div>
                </div>

                <p
                  className={`max-w-md text-sm leading-7 ${
                    isProductPage ? "text-white/70" : "text-[#51483d]"
                  }`}
                >
                  {siteInfo.phone}
                  <br />
                  <a href={`mailto:${siteInfo.email}`} className="hover:opacity-70">
                    {siteInfo.email}
                  </a>
                  <br />
                  {siteInfo.address}
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#9b8b78]">
                  Explore
                </p>
                <Link href="/" className="block hover:opacity-70">
                  Home
                </Link>
                <Link href="/#about" className="block hover:opacity-70">
                  About
                </Link>
                <Link href="/category/all-products" className="block hover:opacity-70">
                  Shop
                </Link>
                <Link href="/#feature" className="block hover:opacity-70">
                  Why Choose Us
                </Link>
              </div>

              <div className="space-y-3 text-sm">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#9b8b78]">
                  Pages
                </p>
                <Link href="/blank" className="block hover:opacity-70">
                  Privacy Policy
                </Link>
                <Link href="/blank-1" className="block hover:opacity-70">
                  Accessibility Statement
                </Link>
                <Link href="/category/lemongrass-collection" className="block hover:opacity-70">
                  Lemongrass Collection
                </Link>
              </div>

              <div className="space-y-4">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#9b8b78]">
                  Follow
                </p>
                <div className="flex flex-wrap gap-3">
                  {siteInfo.socials.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                        isProductPage
                          ? "border-white/12 bg-white/4 hover:bg-white/8"
                          : "border-black/8 bg-white/72 hover:bg-white"
                      }`}
                      aria-label={social.label}
                    >
                      <SocialIcon
                        label={social.label}
                        className={`h-[18px] w-[18px] ${
                          isProductPage ? "text-white/86" : "text-[#201d17]"
                        }`}
                      />
                    </a>
                  ))}
                </div>
                <p className={`pt-6 text-xs ${isProductPage ? "text-white/52" : "text-[#6a6258]"}`}>
                  © 2026 by {siteInfo.company}
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <div
        className={`fixed inset-0 z-[45] transition ${
          searchOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!searchOpen}
      >
        <button
          type="button"
          onClick={() => setSearchOpen(false)}
          className={`absolute inset-0 bg-[rgba(14,14,14,0.42)] transition ${
            searchOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Close search"
        />
        <div className="page-frame relative flex min-h-screen items-start justify-center py-16 sm:py-20">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search the Aerthera catalog"
            className={`wide-shell w-full max-w-4xl overflow-hidden rounded-[2rem] border border-black/8 bg-[#fffdf9] shadow-[0_28px_90px_rgba(0,0,0,0.22)] transition duration-300 ${
              searchOpen ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
            }`}
          >
            <div className="flex items-center justify-between border-b border-black/8 px-5 py-5 sm:px-6">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[#9b8b78]">
                  Search
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[#201d17]">Find a ritual</h2>
              </div>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/8 text-lg text-[#201d17] transition hover:bg-black/4"
                aria-label="Close search panel"
              >
                ×
              </button>
            </div>

            <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.25fr)_280px]">
              <div className="space-y-5">
                <label className="block">
                  <span className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
                    Search the collection
                  </span>
                  <div className="mt-3 flex items-center gap-3 rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3">
                    <SearchIcon className="h-4 w-4 text-[#8d7a5c]" />
                    <input
                      ref={searchInputRef}
                      type="search"
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder="Lemongrass, diffuser, essential oil..."
                      className="w-full bg-transparent text-sm text-[#201d17] outline-none placeholder:text-[#8d7a5c]"
                    />
                  </div>
                </label>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
                      Products
                    </p>
                    <p className="text-xs text-[#6a6258]">
                      {searchResults.length} result{searchResults.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="grid gap-3">
                      {searchResults.map((product) => (
                        <Link
                          key={product.slug}
                          href={`/product-page/${product.slug}`}
                          onClick={() => setSearchOpen(false)}
                          className="flex items-center gap-4 rounded-[1.5rem] border border-black/8 bg-white p-3 transition hover:border-black/15 hover:shadow-[0_12px_28px_rgba(31,28,24,0.06)]"
                        >
                          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[1rem] bg-[#f7f2ea]">
                            <Image
                              src={product.image}
                              alt={product.name}
                              fill
                              sizes="72px"
                              className="object-contain p-2"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c]">
                              {product.categoryLabel}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-[#201d17]">
                              {product.name}
                            </p>
                            <p className="mt-1 text-sm text-[#6a6258]">
                              {formatMoney(product.price)}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-black/12 bg-[#f7f2ea] p-5 text-sm leading-7 text-[#6a6258]">
                      No products match that search yet. Try searching by format,
                      category, or scent note.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[1.75rem] bg-[#f7f2ea] p-5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
                    Collections
                  </p>
                  <div className="mt-4 grid gap-3">
                    {searchCollections.map((collection) => (
                      <Link
                        key={collection.slug}
                        href={`/category/${collection.slug}`}
                        onClick={() => setSearchOpen(false)}
                        className="rounded-[1rem] border border-black/8 bg-white px-4 py-3 text-sm font-medium text-[#201d17] transition hover:bg-[#fffdf9]"
                      >
                        {collection.name}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-black/8 bg-white p-5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
                    Quick Links
                  </p>
                  <div className="mt-4 grid gap-3 text-sm text-[#51483d]">
                    <Link
                      href="/category/all-products"
                      onClick={() => setSearchOpen(false)}
                      className="hover:text-[#201d17]"
                    >
                      Browse all products
                    </Link>
                    <Link
                      href="/#about"
                      onClick={() => setSearchOpen(false)}
                      className="hover:text-[#201d17]"
                    >
                      Read our mission
                    </Link>
                    <Link
                      href="/#services"
                      onClick={() => setSearchOpen(false)}
                      className="hover:text-[#201d17]"
                    >
                      View wellness offerings
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-50 transition ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          onClick={closeCart}
          className={`absolute inset-0 bg-[rgba(14,14,14,0.45)] transition ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Close cart"
        />
        <aside
          className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-black/8 bg-[#fffdf9] transition duration-300 ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-black/8 px-5 py-5">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[#9b8b78]">
                Cart
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[#201d17]">
                {count} item{count === 1 ? "" : "s"}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeCart}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/8 text-lg text-[#201d17] transition hover:bg-black/4"
              aria-label="Close cart panel"
            >
              ×
            </button>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
              <p className="text-2xl font-bold text-[#201d17]">Your cart is empty.</p>
              <p className="max-w-sm text-sm leading-7 text-[#6a6258]">
                Add products from the catalog or product pages, then continue to
                secure guest checkout.
              </p>
              <Link
                href="/category/all-products"
                onClick={closeCart}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#201d17] px-6 text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:opacity-92"
              >
                Shop Products
              </Link>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {items.map((item) => (
                  <div
                    key={item.slug}
                    className="rounded-[1.5rem] border border-black/8 bg-white p-4"
                  >
                    <div className="flex gap-4">
                      <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#f7f2ea]">
                        <Image
                          src={item.product.image}
                          alt={item.product.name}
                          fill
                          sizes="80px"
                          className="object-contain p-2"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#201d17]">
                          {item.product.shortName}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-3 text-sm text-[#6a6258]">
                          <span>{item.product.size}</span>
                          <span>{formatMoney(item.product.price)}</span>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center rounded-full border border-black/8 bg-[#f7f2ea]">
                            <button
                              type="button"
                              onClick={() => updateItem(item.slug, item.quantity - 1)}
                              className="flex h-9 w-9 items-center justify-center text-lg text-[#201d17] transition hover:bg-black/4"
                              aria-label={`Decrease quantity for ${item.product.name}`}
                            >
                              −
                            </button>
                            <span className="min-w-8 text-center text-sm font-semibold text-[#201d17]">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateItem(item.slug, item.quantity + 1)}
                              className="flex h-9 w-9 items-center justify-center text-lg text-[#201d17] transition hover:bg-black/4"
                              aria-label={`Increase quantity for ${item.product.name}`}
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateItem(item.slug, 0)}
                            className="text-sm text-[#6a6258] transition hover:text-[#201d17]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-black/8 px-5 py-5">
                <div className="flex items-center justify-between text-sm text-[#6a6258]">
                  <span>Subtotal</span>
                  <span className="text-lg font-semibold text-[#201d17]">
                    {formatMoney(subtotal)}
                  </span>
                </div>
                {cartError ? (
                  <p className="mt-4 rounded-[1rem] bg-[#f7f2ea] px-4 py-3 text-sm leading-6 text-[#8b3c26]">
                    {cartError}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={handleCartCheckout}
                  disabled={isCheckingOut}
                  className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#201d17] px-5 text-sm font-semibold text-white transition hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isCheckingOut ? "Redirecting to Checkout..." : "Secure Guest Checkout"}
                </button>
                <p className="mt-3 text-xs leading-6 text-[#6a6258]">
                  Secure payment is handled through Stripe Checkout. No account is required.
                </p>
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
