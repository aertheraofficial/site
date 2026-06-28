import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutSuccessClient } from "@/components/checkout-success-client";
import { formatMoney } from "@/lib/money";
import { getOrderBySessionId } from "@/lib/orders";

type CheckoutSuccessPageProps = {
  searchParams: Promise<{
    order_id?: string;
    status_id?: string;
    billcode?: string;
  }>;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  const { order_id: orderId, status_id: statusId } = await searchParams;

  // ToyyibPay status_id 3 = failed/cancelled
  if (statusId === "3") {
    redirect("/checkout/cancel");
  }

  const order = orderId ? await getOrderBySessionId(orderId) : null;
  const isPaid =
    order?.paymentStatus === "paid" || statusId === "1";

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
              Terima kasih atas pesanan anda.
            </h1>
            <p className="mt-4 max-w-2xl text-[1rem] leading-8 text-[#5d574f]">
              Pembayaran anda telah diproses melalui ToyyibPay. Kami akan
              menghubungi anda untuk pengesahan dan penghantaran.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <article className="min-w-0 rounded-[1.5rem] bg-[#f7f2ea] p-5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Status Pembayaran
                </p>
                <p className="mt-2 text-sm leading-6 capitalize text-[#201d17]">
                  {isPaid ? "Berjaya" : "Sedang diproses"}
                </p>
              </article>
              <article className="min-w-0 rounded-[1.5rem] bg-[#f7f2ea] p-5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Jumlah Dibayar
                </p>
                <p className="mt-2 text-sm leading-6 text-[#201d17]">
                  {typeof order?.totalAmount === "number"
                    ? formatMoney(order.totalAmount / 100)
                    : "Disahkan"}
                </p>
              </article>
              <article className="min-w-0 rounded-[1.5rem] bg-[#f7f2ea] p-5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  No. Rujukan
                </p>
                <p className="mt-2 text-sm leading-6 text-[#201d17] [overflow-wrap:anywhere] break-words">
                  {orderId ?? "—"}
                </p>
              </article>
            </div>

            {order && order.lines.length > 0 ? (
              <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section className="rounded-[1.75rem] border border-black/8 bg-[#f7f2ea] p-6">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                    Ringkasan Pesanan
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
                            Kuantiti: {line.quantity}
                            {typeof line.unitAmount === "number"
                              ? ` • ${formatMoney(line.unitAmount / 100)} seunit`
                              : ""}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-medium text-[#201d17]">
                          {typeof line.totalAmount === "number"
                            ? formatMoney(line.totalAmount / 100)
                            : "Disahkan"}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 border-t border-black/8 pt-4 space-y-1 text-sm text-[#5d574f]">
                    <p>
                      Subtotal:{" "}
                      {typeof order.subtotalAmount === "number"
                        ? formatMoney(order.subtotalAmount / 100)
                        : "—"}
                    </p>
                    <p className="font-semibold text-[#201d17]">
                      Jumlah:{" "}
                      {typeof order.totalAmount === "number"
                        ? formatMoney(order.totalAmount / 100)
                        : "Disahkan"}
                    </p>
                  </div>
                </section>

                <section className="rounded-[1.75rem] border border-black/8 bg-white p-6">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                    Penghantaran
                  </p>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-[#5d574f]">
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
                      <p>
                        Maklumat penghantaran akan disahkan dari rekod pesanan
                        anda.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#201d17] px-6 text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:opacity-92"
              >
                Terus Membeli-belah
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/8 px-6 text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-black/4"
              >
                Kembali ke Laman Utama
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
