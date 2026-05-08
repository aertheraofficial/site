import Link from "next/link";
import type Stripe from "stripe";
import { CheckoutSuccessClient } from "@/components/checkout-success-client";
import { formatMoney } from "@/lib/money";
import { getOrderBySessionId, recordCompletedOrder } from "@/lib/orders";
import { getStripeServer } from "@/lib/stripe";

type CheckoutSuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  const { session_id: sessionId } = await searchParams;

  let session: Stripe.Checkout.Session | null = null;
  let order = sessionId ? await getOrderBySessionId(sessionId) : null;
  let errorMessage = "";

  if (sessionId) {
    try {
      const stripe = getStripeServer();
      session = await stripe.checkout.sessions.retrieve(sessionId);
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
        limit: 100,
      });
      order = await recordCompletedOrder({
        session,
        lineItems,
        source: "success-page",
      });
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : "We couldn't load your checkout details.";
    }
  }

  return (
    <div className="bg-[#f7f2ea] py-16 text-[#201d17] sm:py-20">
      <CheckoutSuccessClient />
      <div className="page-frame">
        <div className="content-shell">
          <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_24px_70px_rgba(31,28,24,0.06)] sm:p-10">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
              Checkout Complete
            </p>
            <h1 className="mt-4 font-display text-[3rem] leading-[0.96] tracking-[-0.05em] sm:text-[3.8rem]">
              Thank you for your order.
            </h1>
            <p className="mt-4 max-w-2xl text-[1rem] leading-8 text-[#5d574f]">
              Your guest checkout has been completed securely through Stripe. We&apos;ll
              use the details collected at checkout for fulfillment and confirmation.
            </p>

            {errorMessage ? (
              <p className="mt-6 rounded-[1.25rem] bg-[#f7f2ea] px-4 py-3 text-sm leading-6 text-[#8b3c26]">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <article className="min-w-0 rounded-[1.5rem] bg-[#f7f2ea] p-5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Payment status
                </p>
                <p className="mt-2 text-sm leading-6 capitalize text-[#201d17]">
                  {session?.payment_status ?? "Processing"}
                </p>
              </article>
              <article className="min-w-0 rounded-[1.5rem] bg-[#f7f2ea] p-5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Total paid
                </p>
                <p className="mt-2 text-sm leading-6 text-[#201d17]">
                  {typeof order?.totalAmount === "number"
                    ? formatMoney(order.totalAmount / 100)
                    : typeof session?.amount_total === "number"
                      ? formatMoney(session.amount_total / 100)
                      : "Confirmed"}
                </p>
              </article>
              <article className="min-w-0 rounded-[1.5rem] bg-[#f7f2ea] p-5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Email
                </p>
                <p className="mt-2 text-sm leading-6 text-[#201d17] [overflow-wrap:anywhere] break-words">
                  {order?.customerEmail ?? session?.customer_details?.email ?? "Unavailable"}
                </p>
              </article>
            </div>

            {order ? (
              <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section className="rounded-[1.75rem] border border-black/8 bg-[#f7f2ea] p-6">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                    Order Summary
                  </p>
                  <div className="mt-5 space-y-4">
                    {order.lines.map((line, index) => (
                      <div
                        key={`${line.description}-${index}`}
                        className="flex flex-col gap-3 border-b border-black/8 pb-4 last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-[#201d17] [overflow-wrap:anywhere] break-words">
                            {line.description}
                          </p>
                          <p className="mt-1 text-sm text-[#5d574f]">
                            Qty {line.quantity}
                            {typeof line.unitAmount === "number"
                              ? ` • ${formatMoney(line.unitAmount / 100)} each`
                              : ""}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-medium text-[#201d17]">
                          {typeof line.totalAmount === "number"
                            ? formatMoney(line.totalAmount / 100)
                            : "Confirmed"}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.75rem] border border-black/8 bg-white p-6">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                    Delivery
                  </p>
                  <div className="mt-4 min-w-0 space-y-3 text-sm leading-7 text-[#5d574f]">
                    <p className="font-medium text-[#201d17] [overflow-wrap:anywhere] break-words">
                      {order.shippingName ?? order.customerName ?? "Guest checkout"}
                    </p>
                    {order.shippingAddress ? (
                      <p className="[overflow-wrap:anywhere] break-words">
                        {[
                          order.shippingAddress.line1,
                          order.shippingAddress.line2,
                          order.shippingAddress.city,
                          order.shippingAddress.state,
                          order.shippingAddress.postal_code,
                          order.shippingAddress.country,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    ) : (
                      <p>Shipping details will be confirmed from your checkout record.</p>
                    )}
                    <div className="border-t border-black/8 pt-4">
                      <p>Subtotal: {typeof order.subtotalAmount === "number" ? formatMoney(order.subtotalAmount / 100) : "Included"}</p>
                      <p>Shipping: {typeof order.shippingAmount === "number" ? formatMoney(order.shippingAmount / 100) : "Calculated at checkout"}</p>
                      <p>Tax: {typeof order.taxAmount === "number" ? formatMoney(order.taxAmount / 100) : "As applicable"}</p>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#201d17] px-6 text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:opacity-92"
              >
                Continue Shopping
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
