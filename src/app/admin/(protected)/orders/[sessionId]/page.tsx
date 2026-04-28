import Link from "next/link";
import { notFound } from "next/navigation";
import { updateOrderManagementAction } from "@/app/admin/actions";
import { formatMoney } from "@/lib/money";
import { getOrderBySessionId } from "@/lib/orders";

type OrderDetailPageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ saved?: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClasses(status: string) {
  switch (status) {
    case "fulfilled":
      return "border-[#8cc8a4] bg-[#e9f7ee] text-[#256542]";
    case "packed":
      return "border-[#d4b16c] bg-[#faf1df] text-[#8b5e1d]";
    case "cancelled":
      return "border-[#e6b4b4] bg-[#fff0ef] text-[#9b3d32]";
    default:
      return "border-[#d7c7aa] bg-[#f8f1e4] text-[#8b5e1d]";
  }
}

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: OrderDetailPageProps) {
  const [{ sessionId }, { saved }] = await Promise.all([params, searchParams]);
  const order = await getOrderBySessionId(sessionId);

  if (!order) {
    notFound();
  }

  const addressLines = order.shippingAddress
    ? [
        order.shippingAddress.line1,
        order.shippingAddress.line2,
        order.shippingAddress.city,
        order.shippingAddress.state,
        order.shippingAddress.postal_code,
        order.shippingAddress.country,
      ].filter(Boolean)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/orders"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c] transition hover:text-[#201d17]"
          >
            ← Back to orders
          </Link>
          <h2 className="mt-3 font-display text-[2.8rem] leading-[0.95] tracking-[-0.05em] text-[#201d17]">
            {order.customerName ?? order.customerEmail ?? "Guest checkout"}
          </h2>
          <p className="mt-2 text-sm leading-7 text-[#5d574f]">
            {order.customerEmail ?? "Guest checkout"} · {formatDate(order.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <span
            className={`inline-flex rounded-full border px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] ${statusClasses(order.fulfillmentStatus)}`}
          >
            {order.fulfillmentStatus}
          </span>
          <span className="inline-flex rounded-full border border-black/8 bg-white px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#6a6258]">
            {order.paymentStatus ?? "Pending"}
          </span>
        </div>
      </div>

      {saved ? (
        <p className="rounded-[1.25rem] border border-[#b8d9c2] bg-[#edf8f0] px-4 py-3 text-sm leading-6 text-[#256542]">
          Order management details saved.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <article>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Ordered
                </p>
                <p className="mt-2 text-sm leading-6 text-[#201d17]">
                  {formatDate(order.createdAt)}
                </p>
              </article>
              <article>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Total
                </p>
                <p className="mt-2 text-sm leading-6 text-[#201d17]">
                  {typeof order.totalAmount === "number"
                    ? formatMoney(order.totalAmount / 100)
                    : "Pending"}
                </p>
              </article>
              <article>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Fulfilled at
                </p>
                <p className="mt-2 text-sm leading-6 text-[#201d17]">
                  {order.fulfilledAt ? formatDate(order.fulfilledAt) : "Not yet fulfilled"}
                </p>
              </article>
            </div>
          </section>

          <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
                  Order Summary
                </p>
                <h3 className="mt-2 text-xl font-semibold text-[#201d17]">
                  {order.lines.length} line item{order.lines.length === 1 ? "" : "s"}
                </h3>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {order.lines.map((line, index) => (
                <div
                  key={`${line.description}-${index}`}
                  className="flex flex-col gap-3 rounded-[1.4rem] border border-black/8 bg-[#fcfaf6] p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[#201d17] [overflow-wrap:anywhere] break-words">
                      {line.description}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#5d574f]">
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

          <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
              Customer & Delivery
            </p>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="rounded-[1.4rem] border border-black/8 bg-[#fcfaf6] p-5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Customer
                </p>
                <div className="mt-3 space-y-2 text-sm leading-7 text-[#201d17]">
                  <p>{order.customerName ?? "Guest checkout"}</p>
                  {order.customerEmail ? (
                    <a
                      href={`mailto:${order.customerEmail}`}
                      className="block [overflow-wrap:anywhere] break-words text-[#5d574f] hover:text-[#201d17]"
                    >
                      {order.customerEmail}
                    </a>
                  ) : null}
                  {order.customerPhone ? (
                    <p className="text-[#5d574f]">{order.customerPhone}</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-black/8 bg-[#fcfaf6] p-5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Delivery
                </p>
                <div className="mt-3 space-y-2 text-sm leading-7 text-[#201d17]">
                  <p>{order.shippingName ?? order.customerName ?? "Guest checkout"}</p>
                  {addressLines.length > 0 ? (
                    <p className="[overflow-wrap:anywhere] break-words text-[#5d574f]">
                      {addressLines.join(", ")}
                    </p>
                  ) : (
                    <p className="text-[#5d574f]">
                      Shipping details were not captured in the checkout record.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
              Fulfillment
            </p>
            <form action={updateOrderManagementAction} className="mt-5 space-y-5">
              <input type="hidden" name="sessionId" value={order.sessionId} />

              <label className="block">
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Status
                </span>
                <select
                  name="fulfillmentStatus"
                  defaultValue={order.fulfillmentStatus}
                  className="mt-3 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
                >
                  <option value="unfulfilled">Unfulfilled</option>
                  <option value="packed">Packed</option>
                  <option value="fulfilled">Fulfilled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>

              <label className="block">
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Tracking carrier
                </span>
                <input
                  type="text"
                  name="trackingCarrier"
                  defaultValue={order.trackingCarrier ?? ""}
                  placeholder="DHL, J&T, Ninja Van..."
                  className="mt-3 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Tracking number
                </span>
                <input
                  type="text"
                  name="trackingNumber"
                  defaultValue={order.trackingNumber ?? ""}
                  className="mt-3 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Tracking URL
                </span>
                <input
                  type="url"
                  name="trackingUrl"
                  defaultValue={order.trackingUrl ?? ""}
                  placeholder="https://..."
                  className="mt-3 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Internal notes
                </span>
                <textarea
                  name="internalNotes"
                  defaultValue={order.internalNotes ?? ""}
                  rows={5}
                  className="mt-3 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
                />
              </label>

              <div className="rounded-[1.4rem] border border-black/8 bg-[#fcfaf6] p-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  DHL Shipment Prep
                </p>
                <p className="mt-2 text-sm leading-6 text-[#5d574f]">
                  Parcel weight is required before the bulk DHL batch action can generate a
                  label for this order.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                      Parcel weight (g)
                    </span>
                    <input
                      type="number"
                      name="packageWeightGrams"
                      min="1"
                      step="1"
                      defaultValue={order.packageWeightGrams ?? ""}
                      className="mt-3 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                      Package description
                    </span>
                    <input
                      type="text"
                      name="packageDescription"
                      defaultValue={order.packageDescription ?? ""}
                      placeholder="Product summary for the label"
                      className="mt-3 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                      Length (cm)
                    </span>
                    <input
                      type="number"
                      name="packageLengthCm"
                      min="0"
                      step="0.1"
                      defaultValue={order.packageLengthCm ?? ""}
                      className="mt-3 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                      Width (cm)
                    </span>
                    <input
                      type="number"
                      name="packageWidthCm"
                      min="0"
                      step="0.1"
                      defaultValue={order.packageWidthCm ?? ""}
                      className="mt-3 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                      Height (cm)
                    </span>
                    <input
                      type="number"
                      name="packageHeightCm"
                      min="0"
                      step="0.1"
                      defaultValue={order.packageHeightCm ?? ""}
                      className="mt-3 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
                    />
                  </label>
                </div>
              </div>

              {order.shippingBatchId ? (
                <div className="rounded-[1.4rem] border border-[#b8d9c2] bg-[#edf8f0] p-4 text-sm leading-6 text-[#256542]">
                  <p>
                    DHL batch saved
                    {order.shippingLabelGeneratedAt
                      ? ` on ${formatDate(order.shippingLabelGeneratedAt)}`
                      : ""}.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link
                      href={`/admin/shipments/${encodeURIComponent(order.shippingBatchId)}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#b8d9c2] bg-white px-4 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#256542] transition hover:bg-[#f8fffa]"
                    >
                      Open Shipment Batch
                    </Link>
                    {order.courierShipmentId ? (
                      <span className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#b8d9c2] px-4 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#256542]">
                        Shipment {order.courierShipmentId}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#201d17] px-6 text-[0.76rem] font-semibold uppercase tracking-[0.2em] text-white transition hover:opacity-92"
              >
                Save Order Updates
              </button>
            </form>
          </section>

          <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
              Totals
            </p>
            <div className="mt-5 space-y-3 text-sm leading-7 text-[#5d574f]">
              <p className="flex items-center justify-between gap-4">
                <span>Subtotal</span>
                <span className="text-[#201d17]">
                  {typeof order.subtotalAmount === "number"
                    ? formatMoney(order.subtotalAmount / 100)
                    : "Included"}
                </span>
              </p>
              <p className="flex items-center justify-between gap-4">
                <span>Shipping</span>
                <span className="text-[#201d17]">
                  {typeof order.shippingAmount === "number"
                    ? formatMoney(order.shippingAmount / 100)
                    : "Calculated at checkout"}
                </span>
              </p>
              <p className="flex items-center justify-between gap-4">
                <span>Tax</span>
                <span className="text-[#201d17]">
                  {typeof order.taxAmount === "number"
                    ? formatMoney(order.taxAmount / 100)
                    : "As applicable"}
                </span>
              </p>
              <p className="flex items-center justify-between gap-4 border-t border-black/8 pt-3 text-base font-semibold text-[#201d17]">
                <span>Total</span>
                <span>
                  {typeof order.totalAmount === "number"
                    ? formatMoney(order.totalAmount / 100)
                    : "Pending"}
                </span>
              </p>
            </div>

            {order.trackingUrl ? (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-black/8 px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-black/4"
              >
                Open Tracking Link
              </a>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
