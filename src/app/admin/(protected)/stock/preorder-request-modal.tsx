"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PreorderRequestModalProps = {
  productName: string;
  locationName: string;
  /** wa.me link, prefilled. Null when STOCK_ALERT_WHATSAPP_PHONE is unset. */
  whatsAppUrl: string | null;
  /** True when the alert email was accepted, so staff know if WhatsApp is the only copy. */
  emailSent: boolean;
  /** Manage Stock URL without the popup param, so a refresh doesn't reopen it. */
  returnTo: string;
};

export function PreorderRequestModal({
  productName,
  locationName,
  whatsAppUrl,
  emailSent,
  returnTo,
}: PreorderRequestModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function close() {
    setOpen(false);
    // Drop ?preorder= from the URL — otherwise a refresh or a back-navigation
    // pops the same dialog again for a request that's already been sent.
    router.replace(returnTo, { scroll: false });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Pre-order marked"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#f2ece2] text-[#201d17] transition hover:bg-[#e6dccd]"
        >
          ✕
        </button>

        <h2 className="font-display text-[1.6rem] leading-none tracking-[-0.04em] text-[#201d17]">
          Marked as pre-order
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#5d574f]">
          <span className="font-semibold text-[#201d17]">{productName}</span> at{" "}
          {locationName} is now pre-order. It stays purchasable on the storefront
          while you restock.
        </p>

        <p className="mt-3 text-[0.8rem] leading-5 text-[#8d7a5c]">
          {emailSent
            ? "A restock alert has been emailed."
            : "No alert email was sent — set STOCK_ALERT_TO_EMAIL to enable it."}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {whatsAppUrl ? (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#25D366] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1eb958]"
            >
              Send on WhatsApp
            </a>
          ) : null}
          <button
            type="button"
            onClick={close}
            className="rounded-xl border border-black/10 px-6 py-2.5 text-sm font-semibold text-[#201d17] transition hover:bg-[#f7f2ea]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
