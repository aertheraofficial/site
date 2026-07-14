"use client";

import { useState } from "react";
import { recordCounterSaleAction } from "@/app/admin/actions";
import { formatMoney } from "@/lib/money";
import { ProductQrScanner } from "@/components/admin/product-qr-scanner";

type PickerProduct = {
  slug: string;
  name: string;
  size: string;
  price: number;
  quantity: number | null;
};

type SaleLine = {
  slug: string;
  name: string;
  price: number;
  quantity: number;
  maxQuantity: number | null;
};

const PAYMENT_METHODS = ["Cash", "Card", "DuitNow QR", "Other"] as const;

export function CounterSaleForm({ products }: { products: PickerProduct[] }) {
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof PAYMENT_METHODS)[number]>("Cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanFeedback, setScanFeedback] = useState("");

  const normalizedSearch = search.trim().toLowerCase();
  const matches = normalizedSearch
    ? products
        .filter((p) => p.name.toLowerCase().includes(normalizedSearch))
        .slice(0, 8)
    : [];

  const total = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  function addProduct(product: PickerProduct) {
    setSearch("");
    setSuccess("");
    setLines((current) => {
      const existing = current.find((l) => l.slug === product.slug);
      if (existing) {
        const nextQuantity =
          product.quantity !== null
            ? Math.min(existing.quantity + 1, product.quantity)
            : existing.quantity + 1;
        return current.map((l) =>
          l.slug === product.slug ? { ...l, quantity: nextQuantity } : l,
        );
      }
      return [
        ...current,
        {
          slug: product.slug,
          name: product.name,
          price: product.price,
          quantity: 1,
          maxQuantity: product.quantity,
        },
      ];
    });
  }

  function handleScan(decodedText: string) {
    const product = products.find((p) => p.slug === decodedText.trim());

    if (!product) {
      setScanFeedback(`Not recognized: "${decodedText.slice(0, 40)}"`);
      return;
    }

    if (product.quantity !== null && product.quantity <= 0) {
      setScanFeedback(`${product.name} is sold out.`);
      return;
    }

    addProduct(product);
    setScanFeedback(`Added: ${product.name}`);
  }

  function updateQuantity(slug: string, quantity: number) {
    setLines((current) =>
      current.map((l) =>
        l.slug === slug
          ? {
              ...l,
              quantity: Math.max(
                1,
                l.maxQuantity !== null ? Math.min(quantity, l.maxQuantity) : quantity,
              ),
            }
          : l,
      ),
    );
  }

  function removeLine(slug: string) {
    setLines((current) => current.filter((l) => l.slug !== slug));
  }

  async function completeSale() {
    if (lines.length === 0 || submitting) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const result = await recordCounterSaleAction({
        lines: lines.map((l) => ({ slug: l.slug, quantity: l.quantity })),
        customerName,
        customerPhone,
        paymentMethod,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(`Sale recorded — ${formatMoney(total)} via ${paymentMethod}.`);
      setLines([]);
      setCustomerName("");
      setCustomerPhone("");
      setPaymentMethod("Cash");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record this sale.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="rounded-[1.75rem] border border-black/8 bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
            Add Product
          </p>
          <button
            type="button"
            onClick={() => {
              setScanFeedback("");
              setScanning((v) => !v);
            }}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-4 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition ${
              scanning
                ? "border-[#201d17] bg-[#201d17] text-white"
                : "border-black/8 bg-[#f7f2ea] text-[#201d17] hover:bg-black/4"
            }`}
          >
            {scanning ? "Scanning..." : "Scan QR"}
          </button>
        </div>

        <div className="mt-3">
          <ProductQrScanner active={scanning} onScan={handleScan} />
          {scanning && scanFeedback ? (
            <p className="mt-3 rounded-[1rem] border border-black/8 bg-[#f7f2ea] px-4 py-2.5 text-center text-sm text-[#201d17]">
              {scanFeedback}
            </p>
          ) : null}
        </div>

        <div className="relative mt-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product by name"
            className="w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
          />
          {matches.length > 0 ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-10 max-h-72 overflow-y-auto rounded-[1.25rem] border border-black/8 bg-white p-2 shadow-[0_18px_40px_rgba(32,29,23,0.12)]">
              {matches.map((product) => (
                <button
                  key={product.slug}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="flex w-full items-center justify-between gap-3 rounded-[0.85rem] px-4 py-2.5 text-left text-sm transition hover:bg-[#f7f2ea]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[#201d17]">
                      {product.name}
                    </span>
                    <span className="text-xs text-[#8d7a5c]">
                      {product.size}
                      {product.quantity !== null ? ` • ${product.quantity} left` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-[#201d17]">
                    {formatMoney(product.price)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-6 space-y-3">
          {lines.length === 0 ? (
            <p className="rounded-[1.25rem] border border-dashed border-black/10 bg-[#f7f2ea] px-5 py-8 text-center text-sm text-[#8d7a5c]">
              Search and add products to start this sale.
            </p>
          ) : (
            lines.map((line) => (
              <div
                key={line.slug}
                className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-black/8 bg-[#fcfaf6] p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#201d17]">{line.name}</p>
                  <p className="text-xs text-[#8d7a5c]">{formatMoney(line.price)} each</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="inline-flex items-center rounded-full border border-black/8 bg-white">
                    <button
                      type="button"
                      onClick={() => updateQuantity(line.slug, line.quantity - 1)}
                      className="flex h-8 w-8 items-center justify-center text-lg text-[#201d17]"
                      aria-label={`Decrease quantity for ${line.name}`}
                    >
                      −
                    </button>
                    <span className="min-w-6 text-center text-sm font-semibold text-[#201d17]">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(line.slug, line.quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center text-lg text-[#201d17]"
                      aria-label={`Increase quantity for ${line.name}`}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.slug)}
                    className="text-xs text-[#8d7a5c] transition hover:text-[#9b3d32]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="h-fit rounded-[1.75rem] border border-black/8 bg-white p-6">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
          Sale Summary
        </p>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-[#6a6258]">Total</span>
          <span className="text-lg font-semibold text-[#201d17]">{formatMoney(total)}</span>
        </div>

        <div className="mt-5 space-y-3">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer name (optional)"
            className="w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
          />
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="Phone (optional)"
            className="w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
          />

          <div>
            <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
              Paid via
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`h-9 rounded-full border text-[0.72rem] font-semibold transition ${
                    paymentMethod === method
                      ? "border-[#201d17] bg-[#201d17] text-white"
                      : "border-black/8 bg-[#f7f2ea] text-[#201d17] hover:bg-black/4"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-[1rem] border border-[#e6b4b4] bg-[#fff0ef] px-4 py-3 text-sm leading-6 text-[#9b3d32]">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-4 rounded-[1rem] border border-[#8cc8a4] bg-[#e9f7ee] px-4 py-3 text-sm leading-6 text-[#256542]">
            {success}
          </p>
        ) : null}

        <button
          type="button"
          onClick={completeSale}
          disabled={lines.length === 0 || submitting}
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#201d17] px-5 text-sm font-semibold text-white transition hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Recording..." : "Complete Sale"}
        </button>
      </div>
    </div>
  );
}
