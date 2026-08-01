"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { recordCounterSaleAction, searchCustomersAction } from "@/app/admin/actions";
import { formatMoney } from "@/lib/money";
import { ProductQrScanner } from "@/components/admin/product-qr-scanner";

type CustomerMatch = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  isMember: boolean;
  orderCount: number;
};

type SaleReceipt = {
  receiptUrl: string;
  whatsAppUrl: string | null;
  emailedReceipt: boolean;
};

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

/** Mirrors DISCOUNT_PERCENTS in @/lib/orders, which the server re-checks.
 * Not imported: that module pulls fs + the Supabase service key into the bundle. */
const DISCOUNT_PERCENTS = [10, 30, 50] as const;

type CounterSaleFormProps = {
  products: PickerProduct[];
  location: string;
  locationName: string;
};

export function CounterSaleForm({ products, location, locationName }: CounterSaleFormProps) {
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<CustomerMatch[]>([]);
  const [memberSearchNote, setMemberSearchNote] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof PAYMENT_METHODS)[number]>("Cash");
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [emailNotice, setEmailNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [lastSale, setLastSale] = useState<SaleReceipt | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanFeedback, setScanFeedback] = useState("");
  const [showQr, setShowQr] = useState(false);
  const memberBoxRef = useRef<HTMLDivElement>(null);

  // Typeahead over everyone who has ever bought or registered, by name/phone/email.
  useEffect(() => {
    const query = memberQuery.trim();
    if (query.length < 2) {
      setMemberResults([]);
      setMemberSearchNote("");
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const customers = await searchCustomersAction(query);
        if (cancelled) return;
        setMemberResults(customers);
        setMemberSearchNote(customers.length === 0 ? "No customer found." : "");
      } catch {
        if (!cancelled) {
          setMemberResults([]);
          setMemberSearchNote("Customer lookup unavailable.");
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [memberQuery]);

  function selectMember(customer: CustomerMatch) {
    setCustomerName(customer.fullName);
    setCustomerPhone(customer.phone ?? "");
    setCustomerEmail(customer.email ?? "");
    setMemberQuery("");
    setMemberResults([]);
    setMemberSearchNote("");
  }

  const normalizedSearch = search.trim().toLowerCase();
  const matches = normalizedSearch
    ? products
        .filter((p) => p.name.toLowerCase().includes(normalizedSearch))
        .slice(0, 8)
    : [];

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  // Rounded in cents, the way the server records it, so the counter never
  // quotes a ringgit the receipt disagrees with.
  const discountAmount = discountPercent
    ? Math.round(subtotal * 100 * discountPercent / 100) / 100
    : 0;
  const total = subtotal - discountAmount;

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

    // Catch a malformed address before the sale goes through — a receipt sent to
    // a typo is silently lost, and the counter is the only chance to fix it.
    const email = customerEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError(`"${email}" does not look like a valid email address. Fix it or clear it.`);
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");
    setEmailNotice(null);
    setLastSale(null);

    try {
      const result = await recordCounterSaleAction({
        lines: lines.map((l) => ({ slug: l.slug, quantity: l.quantity })),
        customerName,
        customerPhone,
        customerEmail,
        paymentMethod,
        location,
        discountPercent,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(
        `Sale recorded — ${formatMoney(total)} via ${paymentMethod}${
          discountPercent ? ` (${discountPercent}% off)` : ""
        }.`,
      );
      setEmailNotice(
        result.emailedReceipt
          ? {
              ok: true,
              text: `Receipt emailed to ${result.receiptEmailAddress ?? customerEmail}`,
            }
          : customerEmail
            ? {
                ok: false,
                text: `Receipt NOT emailed to ${result.receiptEmailAddress ?? customerEmail}${
                  result.receiptEmailError ? ` — ${result.receiptEmailError}` : ""
                }. Check the address is spelt right, then use WhatsApp or Print.`,
              }
            : null,
      );
      setLastSale({
        receiptUrl: result.receiptUrl,
        whatsAppUrl: result.whatsAppUrl,
        emailedReceipt: result.emailedReceipt,
      });
      setLines([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setMemberQuery("");
      setMemberResults([]);
      setMemberSearchNote("");
      setPaymentMethod("Cash");
      setDiscountPercent(null);
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

        <p className="mt-2 inline-flex rounded-full border border-[#a8cbe0] bg-[#eaf4fa] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#2a5f7a]">
          Selling at: {locationName}
        </p>

        {discountPercent ? (
          <div className="mt-4 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#6a6258]">Subtotal</span>
              <span className="text-[#201d17]">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8b5e1d]">Discount {discountPercent}%</span>
              <span className="text-[#8b5e1d]">−{formatMoney(discountAmount)}</span>
            </div>
          </div>
        ) : null}

        <div
          className={`flex items-center justify-between text-sm ${
            discountPercent ? "mt-2 border-t border-black/8 pt-2" : "mt-4"
          }`}
        >
          <span className="text-[#6a6258]">Total</span>
          <span className="text-lg font-semibold text-[#201d17]">{formatMoney(total)}</span>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
            Discount
          </p>
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setDiscountPercent(null)}
              className={`h-9 rounded-full border text-[0.72rem] font-semibold transition ${
                discountPercent === null
                  ? "border-[#201d17] bg-[#201d17] text-white"
                  : "border-black/8 bg-[#f7f2ea] text-[#201d17] hover:bg-black/4"
              }`}
            >
              None
            </button>
            {DISCOUNT_PERCENTS.map((percent) => (
              <button
                key={percent}
                type="button"
                onClick={() => setDiscountPercent(percent)}
                className={`h-9 rounded-full border text-[0.72rem] font-semibold transition ${
                  discountPercent === percent
                    ? "border-[#201d17] bg-[#201d17] text-white"
                    : "border-black/8 bg-[#f7f2ea] text-[#201d17] hover:bg-black/4"
                }`}
              >
                {percent}%
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="relative" ref={memberBoxRef}>
            <label htmlFor="counter-member-search" className="mb-1.5 block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
              Find existing customer
            </label>
            <input
              id="counter-member-search"
              type="search"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Name, phone or email"
              className="w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
            />
            {memberResults.length > 0 ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 max-h-60 overflow-y-auto rounded-[1.25rem] border border-black/8 bg-white p-2 shadow-[0_18px_40px_rgba(32,29,23,0.12)]">
                {memberResults.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => selectMember(customer)}
                    className="flex w-full flex-col items-start rounded-[0.85rem] px-4 py-2.5 text-left transition hover:bg-[#f7f2ea]"
                  >
                    <span className="text-sm font-medium text-[#201d17]">
                      {customer.fullName}
                    </span>
                    <span className="text-xs text-[#8d7a5c]">
                      {[
                        customer.phone,
                        customer.email,
                        customer.orderCount > 0
                          ? `${customer.orderCount} past ${
                              customer.orderCount === 1 ? "sale" : "sales"
                            }`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" • ") || "No contact"}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {memberResults.length === 0 && memberSearchNote ? (
              <p className="mt-1.5 px-1 text-xs text-[#8d7a5c]">{memberSearchNote}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="counter-customer-name" className="mb-1.5 block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
              Customer name
            </label>
            <input
              id="counter-customer-name"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Siti Aminah"
              className="w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
            />
          </div>
          <div>
            <label htmlFor="counter-customer-phone" className="mb-1.5 block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
              Phone
            </label>
            <input
              id="counter-customer-phone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 0173159643"
              className="w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
            />
          </div>
          <div>
            <label htmlFor="counter-customer-email" className="mb-1.5 block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
              Email
            </label>
            <input
              id="counter-customer-email"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="Receipt is emailed here"
              className="w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
            />
          </div>

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
            {paymentMethod === "DuitNow QR" ? (
              <button
                type="button"
                onClick={() => setShowQr(true)}
                className="mt-2 h-9 w-full rounded-full border border-[#b38a59] bg-[#faf1df] text-[0.72rem] font-semibold text-[#8b5e1d] transition hover:bg-[#f3e6cf]"
              >
                Show DuitNow QR to customer
              </button>
            ) : null}
          </div>
        </div>

        {showQr ? (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="DuitNow QR"
            onClick={() => setShowQr(false)}
          >
            <div
              className="relative w-full max-w-sm rounded-[1.5rem] bg-white p-6 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowQr(false)}
                aria-label="Close"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#f2ece2] text-[#201d17] transition hover:bg-[#e6dccd]"
              >
                ✕
              </button>
              <h3 className="text-lg font-bold text-[#201d17]">Scan to Pay</h3>
              {total > 0 ? (
                <p className="mt-1 text-sm text-[#6a6258]">
                  Amount:{" "}
                  <span className="font-semibold text-[#201d17]">
                    {formatMoney(total)}
                  </span>
                </p>
              ) : null}
              <div className="mt-4 flex justify-center">
                <Image
                  src="/assets/duitnow-qr.png"
                  alt="Aerthera DuitNow QR"
                  width={320}
                  height={520}
                  className="h-auto w-full max-w-[240px] rounded-[1rem]"
                  priority
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-[#6a6258]">
                Ask the customer to scan with any Malaysian banking / e-wallet app,
                then confirm payment received before recording the sale.
              </p>
              <button
                type="button"
                onClick={() => setShowQr(false)}
                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#201d17] px-5 text-sm font-semibold text-white transition hover:opacity-92"
              >
                Done
              </button>
            </div>
          </div>
        ) : null}

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
        {emailNotice ? (
          <p
            className={`mt-2 rounded-[1rem] border px-4 py-3 text-sm leading-6 ${
              emailNotice.ok
                ? "border-[#8cc8a4] bg-[#e9f7ee] text-[#256542]"
                : "border-[#e6b4b4] bg-[#fff0ef] text-[#9b3d32]"
            }`}
          >
            {emailNotice.text}
          </p>
        ) : null}

        {lastSale ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {lastSale.whatsAppUrl ? (
              <a
                href={lastSale.whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-full border border-[#25a35a] bg-[#eaf7ef] text-[0.72rem] font-semibold text-[#1c7a43]"
              >
                Send WhatsApp
              </a>
            ) : null}
            <a
              href={`${lastSale.receiptUrl}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex h-10 items-center justify-center rounded-full border border-black/8 bg-[#f7f2ea] text-[0.72rem] font-semibold text-[#201d17] ${
                lastSale.whatsAppUrl ? "" : "col-span-2"
              }`}
            >
              Print receipt
            </a>
          </div>
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
