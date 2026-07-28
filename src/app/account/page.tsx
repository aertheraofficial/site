import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/supabase-server";
import { getOrdersByCustomerId, type StoredOrder } from "@/lib/orders";
import { formatShopLongDate } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "My Account" };

type FilterTab = "all" | "to-pay" | "processing" | "shipped" | "cancelled";

const TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All Orders" },
  { value: "to-pay", label: "To Pay" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "cancelled", label: "Cancelled" },
];

function getTabForOrder(order: StoredOrder): FilterTab {
  if (order.fulfillmentStatus === "cancelled" || order.paymentStatus === "unpaid") {
    return "cancelled";
  }
  if (order.fulfillmentStatus === "fulfilled") return "shipped";
  if (order.paymentStatus === "paid") return "processing";
  return "to-pay";
}

function PaymentBadge({ order }: { order: StoredOrder }) {
  const tab = getTabForOrder(order);
  const configs: Record<FilterTab, { label: string; cls: string }> = {
    "all": { label: "", cls: "" },
    "to-pay": { label: "Awaiting Payment", cls: "bg-amber-50 text-amber-700" },
    "processing": { label: "Processing", cls: "bg-blue-50 text-blue-700" },
    "shipped": { label: "Shipped", cls: "bg-green-50 text-green-700" },
    "cancelled": { label: "Cancelled", cls: "bg-red-50 text-red-700" },
  };
  const { label, cls } = configs[tab];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

type PageProps = { searchParams: Promise<{ filter?: string }> };

export default async function AccountPage({ searchParams }: PageProps) {
  const user = await getServerUser();
  if (!user) redirect("/account/login");

  const { filter } = await searchParams;
  const activeTab = (TABS.find((t) => t.value === filter)?.value ?? "all") as FilterTab;

  const allOrders = await getOrdersByCustomerId(user.id);
  const orders =
    activeTab === "all"
      ? allOrders
      : allOrders.filter((o) => getTabForOrder(o) === activeTab);

  const counts = {
    all: allOrders.length,
    "to-pay": allOrders.filter((o) => getTabForOrder(o) === "to-pay").length,
    processing: allOrders.filter((o) => getTabForOrder(o) === "processing").length,
    shipped: allOrders.filter((o) => getTabForOrder(o) === "shipped").length,
    cancelled: allOrders.filter((o) => getTabForOrder(o) === "cancelled").length,
  };

  return (
    <main className="page-frame py-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[#201d17]">
          My Account
        </h1>
        <p className="mt-1 text-sm text-[#6a6258]">{user.email}</p>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-[#201d17]">Order History</h2>

      {/* Filter tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-black/8 bg-[#faf7f2] p-1.5">
        {TABS.map((tab) => {
          const isActive = tab.value === activeTab;
          const count = counts[tab.value];
          return (
            <Link
              key={tab.value}
              href={tab.value === "all" ? "/account" : `/account?filter=${tab.value}`}
              className={`flex-shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
                isActive
                  ? "bg-white text-[#201d17] shadow-sm"
                  : "text-[#6a6258] hover:text-[#201d17]"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold ${
                  isActive ? "bg-[#201d17] text-white" : "bg-black/8 text-[#51483d]"
                }`}>
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-black/8 bg-[#faf7f2] px-6 py-12 text-center">
          <p className="text-sm text-[#6a6258]">
            {activeTab === "all"
              ? "You haven't placed any orders yet."
              : `No ${TABS.find((t) => t.value === activeTab)?.label.toLowerCase()} orders.`}
          </p>
          {activeTab === "all" && (
            <Link
              href="/products"
              className="mt-4 inline-block rounded-xl bg-[#201d17] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#2e2a22]"
            >
              Shop now
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.sessionId}
              className="rounded-2xl border border-black/8 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[0.75rem] font-medium uppercase tracking-widest text-[#6a6258]">
                    Order
                  </p>
                  <p className="mt-0.5 font-mono text-sm text-[#201d17]">
                    {order.sessionId}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <PaymentBadge order={order} />
                  <p className="text-sm font-semibold text-[#201d17]">
                    {order.totalAmount != null
                      ? formatMoney(order.totalAmount / 100)
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="mt-4 divide-y divide-black/6">
                {order.lines.map((line, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm text-[#51483d]">
                    <span>
                      {line.description}{" "}
                      <span className="text-[#a09282]">× {line.quantity}</span>
                    </span>
                    <span>
                      {line.totalAmount != null
                        ? formatMoney(line.totalAmount / 100)
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-[0.72rem] text-[#a09282]">
                {formatShopLongDate(order.createdAt)}
                {order.trackingNumber && (
                  <span className="ml-3">
                    Tracking:{" "}
                    {order.trackingUrl ? (
                      <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="underline">
                        {order.trackingNumber}
                      </a>
                    ) : (
                      order.trackingNumber
                    )}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
