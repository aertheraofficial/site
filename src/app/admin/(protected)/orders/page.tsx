import Link from "next/link";
import { generateDhlShipmentBatchAction } from "@/app/admin/actions";
import { isDhlEcommerceConfigured } from "@/lib/dhl-ecommerce";
import { formatMoney } from "@/lib/money";
import { type FulfillmentStatus, type StoredOrder, readOrders } from "@/lib/orders";

type OrdersPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    error?: string;
    shipmentError?: string;
  }>;
};

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "unfulfilled", label: "Unfulfilled" },
  { value: "packed", label: "Packed" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "cancelled", label: "Cancelled" },
] as const;

function isFulfillmentStatus(value: string | undefined): value is FulfillmentStatus {
  return (
    value === "unfulfilled" ||
    value === "packed" ||
    value === "fulfilled" ||
    value === "cancelled"
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildOrdersHref(status: string, query: string) {
  const params = new URLSearchParams();

  if (status !== "all") {
    params.set("status", status);
  }

  if (query) {
    params.set("q", query);
  }

  const suffix = params.toString();
  return suffix ? `/admin/orders?${suffix}` : "/admin/orders";
}

function getStatusClasses(status: FulfillmentStatus) {
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

function getDhlSelectionState(order: StoredOrder) {
  const country = order.shippingAddress?.country?.toUpperCase() ?? "";

  if (order.fulfillmentStatus === "cancelled") {
    return {
      selectable: false,
      label: "Cancelled",
      classes: "border-[#e6b4b4] bg-[#fff0ef] text-[#9b3d32]",
    };
  }

  if (order.courierShipmentId) {
    return {
      selectable: false,
      label: "DHL linked",
      classes: "border-[#b8d9c2] bg-[#edf8f0] text-[#256542]",
    };
  }

  if (!order.shippingAddress?.line1 || !order.shippingAddress?.postal_code || !country) {
    return {
      selectable: false,
      label: "Address incomplete",
      classes: "border-[#d6c2a0] bg-[#f8f1e4] text-[#8b5e1d]",
    };
  }

  if (country !== "MY") {
    return {
      selectable: false,
      label: "Not MY domestic",
      classes: "border-[#d6c2a0] bg-[#f8f1e4] text-[#8b5e1d]",
    };
  }

  if (!order.packageWeightGrams || order.packageWeightGrams <= 0) {
    return {
      selectable: false,
      label: "Weight missing",
      classes: "border-[#d6c2a0] bg-[#f8f1e4] text-[#8b5e1d]",
    };
  }

  return {
    selectable: true,
    label: `${Math.round(order.packageWeightGrams)} g ready`,
    classes: "border-[#b8d9c2] bg-[#edf8f0] text-[#256542]",
  };
}

export default async function AdminOrdersPage({
  searchParams,
}: OrdersPageProps) {
  const { q, status, error, shipmentError } = await searchParams;
  const query = q?.trim() ?? "";
  const normalizedQuery = query.toLowerCase();
  const activeStatus = isFulfillmentStatus(status) ? status : "all";
  const orders = await readOrders();
  const dhlConfigured = isDhlEcommerceConfigured();
  const returnTo = buildOrdersHref(activeStatus, query);

  const filteredOrders = orders.filter((order) => {
    if (activeStatus !== "all" && order.fulfillmentStatus !== activeStatus) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      order.customerName,
      order.customerEmail,
      order.customerPhone,
      order.sessionId,
      order.paymentIntentId,
      order.shippingName,
      order.trackingCarrier,
      order.trackingNumber,
      order.courierShipmentId,
      order.shippingBatchId,
      order.packageDescription,
      order.internalNotes,
      ...order.lines.map((line) => line.description),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  const totalRevenue = filteredOrders.reduce(
    (sum, order) => sum + (order.totalAmount ?? 0),
    0,
  );
  const unfulfilledCount = orders.filter(
    (order) => order.fulfillmentStatus === "unfulfilled",
  ).length;
  const fulfilledCount = orders.filter(
    (order) => order.fulfillmentStatus === "fulfilled",
  ).length;
  const packedCount = orders.filter(
    (order) => order.fulfillmentStatus === "packed",
  ).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)]">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c]">
            Orders
          </p>
          <p className="mt-3 font-display text-[2.6rem] leading-none tracking-[-0.05em] text-[#201d17]">
            {orders.length}
          </p>
          <p className="mt-2 text-sm text-[#5d574f]">All stored orders across checkout.</p>
        </article>

        <article className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)]">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c]">
            Unfulfilled
          </p>
          <p className="mt-3 font-display text-[2.6rem] leading-none tracking-[-0.05em] text-[#201d17]">
            {unfulfilledCount}
          </p>
          <p className="mt-2 text-sm text-[#5d574f]">Orders still waiting to be packed.</p>
        </article>

        <article className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)]">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c]">
            Packed / Fulfilled
          </p>
          <p className="mt-3 font-display text-[2.6rem] leading-none tracking-[-0.05em] text-[#201d17]">
            {packedCount + fulfilledCount}
          </p>
          <p className="mt-2 text-sm text-[#5d574f]">
            Orders already moving through fulfillment.
          </p>
        </article>

        <article className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)]">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c]">
            Filtered Revenue
          </p>
          <p className="mt-3 font-display text-[2.2rem] leading-none tracking-[-0.05em] text-[#201d17]">
            {formatMoney(totalRevenue / 100)}
          </p>
          <p className="mt-2 text-sm text-[#5d574f]">
            Total across the orders currently shown below.
          </p>
        </article>
      </section>

      <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
              Orders
            </p>
            <h2 className="mt-3 font-display text-[2.5rem] leading-[0.95] tracking-[-0.05em] text-[#201d17]">
              Track fulfillment
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5d574f]">
              Search by customer, email, tracking number, or product name. Open any
              order to update fulfillment and delivery details.
            </p>
          </div>

          <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px] xl:min-w-[520px]">
            <label className="block">
              <span className="sr-only">Search orders</span>
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search orders or customer details"
                className="w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="sr-only">Status</span>
              <select
                name="status"
                defaultValue={activeStatus}
                className="w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
              >
                {STATUS_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#201d17] px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:opacity-92"
              >
                Apply Filters
              </button>
              <Link
                href="/admin/orders"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/8 px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-black/4"
              >
                Clear
              </Link>
            </div>
          </form>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {STATUS_FILTERS.map((filter) => {
            const isActive = filter.value === activeStatus;
            return (
              <Link
                key={filter.value}
                href={buildOrdersHref(filter.value, query)}
                className={`inline-flex min-h-10 items-center justify-center rounded-full border px-4 text-[0.72rem] font-semibold uppercase tracking-[0.18em] transition ${
                  isActive
                    ? "border-[#201d17] bg-[#201d17] text-white"
                    : "border-black/8 bg-[#f7f2ea] text-[#201d17] hover:bg-white"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        {error === "missing-order" ? (
          <p className="mt-6 rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-4 py-3 text-sm leading-6 text-[#8b5e1d]">
            The requested order could not be found.
          </p>
        ) : null}

        {shipmentError ? (
          <p className="mt-6 rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-4 py-3 text-sm leading-6 text-[#8b5e1d]">
            {shipmentError}
          </p>
        ) : null}

        <form action={generateDhlShipmentBatchAction} className="mt-8 space-y-4">
          <input type="hidden" name="returnTo" value={returnTo} />

          <div className="rounded-[1.75rem] border border-black/8 bg-[#fcfaf6] p-5 shadow-[0_16px_48px_rgba(32,29,23,0.04)] sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  DHL Batch Fulfillment
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5d574f]">
                  Select the orders that are packed and weighed, then generate the DHL
                  shipment batch. DHL tracking numbers are saved back onto each order, and
                  the batch page will expose the printable label document.
                </p>
              </div>

              <button
                type="submit"
                disabled={!dhlConfigured}
                className={`inline-flex min-h-12 items-center justify-center rounded-full px-6 text-[0.76rem] font-semibold uppercase tracking-[0.2em] transition ${
                  dhlConfigured
                    ? "bg-[#201d17] text-white hover:opacity-92"
                    : "cursor-not-allowed bg-[#d7c7aa] text-white"
                }`}
              >
                Generate DHL Batch
              </button>
            </div>

            <p className="mt-4 text-sm leading-7 text-[#5d574f]">
              {dhlConfigured
                ? "Each order needs a parcel weight saved on its detail page before it can be sent to DHL."
                : "DHL batch generation stays disabled until the DHL eCommerce account credentials and sender details are added to the environment."}
            </p>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-black/10 bg-[#f7f2ea] px-6 py-10 text-center text-sm leading-7 text-[#5d574f]">
              No orders match the current filters.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const dhlState = getDhlSelectionState(order);

              return (
                <article
                  key={order.sessionId}
                  className="rounded-[1.75rem] border border-black/8 bg-[#fcfaf6] p-5 shadow-[0_16px_48px_rgba(32,29,23,0.04)] sm:p-6"
                >
                  <div className="flex gap-4">
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        name="selectedOrders"
                        value={order.sessionId}
                        disabled={!dhlState.selectable || !dhlConfigured}
                        className="size-5 rounded border border-black/15 accent-[#201d17] disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${getStatusClasses(order.fulfillmentStatus)}`}
                            >
                              {order.fulfillmentStatus}
                            </span>
                            <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a6258]">
                              {order.paymentStatus ?? "Pending"}
                            </span>
                            <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a6258]">
                              {order.lines.length} item{order.lines.length === 1 ? "" : "s"}
                            </span>
                            <span
                              className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${dhlState.classes}`}
                            >
                              {dhlState.label}
                            </span>
                          </div>

                          <h3 className="mt-4 text-xl font-semibold text-[#201d17]">
                            {order.customerName ?? order.customerEmail ?? "Guest checkout"}
                          </h3>
                          <p className="mt-1 text-sm text-[#5d574f]">
                            {order.customerEmail ?? "No email captured"}
                          </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 xl:min-w-[560px] xl:grid-cols-4">
                          <div>
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                              Ordered
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[#201d17]">
                              {formatDate(order.createdAt)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                              Total
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[#201d17]">
                              {typeof order.totalAmount === "number"
                                ? formatMoney(order.totalAmount / 100)
                                : "Pending"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                              Tracking
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[#201d17]">
                              {order.trackingNumber ?? "Not added yet"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                              Parcel
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[#201d17]">
                              {order.packageWeightGrams
                                ? `${Math.round(order.packageWeightGrams)} g`
                                : "Not set"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-4 border-t border-black/8 pt-5 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                            Products
                          </p>
                          <p className="mt-2 text-sm leading-7 text-[#5d574f]">
                            {order.lines
                              .slice(0, 3)
                              .map((line) => line.description)
                              .join(" • ")}
                            {order.lines.length > 3 ? " • …" : ""}
                          </p>
                        </div>
                        <Link
                          href={`/admin/orders/${encodeURIComponent(order.sessionId)}`}
                          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#201d17] px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:opacity-92"
                        >
                          Open Order
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </form>
      </section>
    </div>
  );
}
