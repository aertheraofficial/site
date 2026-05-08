import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <div className="bg-[#f7f2ea] py-16 text-[#201d17] sm:py-20">
      <div className="page-frame">
        <div className="content-shell">
          <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_24px_70px_rgba(31,28,24,0.06)] sm:p-10">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
              Checkout Paused
            </p>
            <h1 className="mt-4 font-display text-[3rem] leading-[0.96] tracking-[-0.05em] sm:text-[3.8rem]">
              Your cart is still waiting.
            </h1>
            <p className="mt-4 max-w-2xl text-[1rem] leading-8 text-[#5d574f]">
              No payment was taken. You can return to the catalog, review your cart,
              and start checkout again whenever you&apos;re ready.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#201d17] px-6 text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:opacity-92"
              >
                Back to Shop
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/8 px-6 text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-black/4"
              >
                Return Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
