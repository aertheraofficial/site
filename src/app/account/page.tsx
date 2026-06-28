import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/supabase-server";
import { getOrdersByCustomerId } from "@/lib/orders";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "My Account" };

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    paid: "bg-green-50 text-green-700",
    pending: "bg-amber-50 text-amber-700",
    unpaid: "bg-red-50 text-red-700",
  };
  const label = status ?? "unknown";
  const cls = map[label] ?? "bg-stone-100 text-stone-600";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold capitalize ${cls}`}>
      {label}
    </span>
  );
}

export default async function AccountPage() {
  const user = await getServerUser();
  if (!user) redirect("/account/login");

  const orders = await getOrdersByCustomerId(user.id);

  return (
    <main className="page-frame py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[#201d17]">
            My Account
          </h1>
          <p className="mt-1 text-sm text-[#6a6258]">{user.email}</p>
        </div>
        <form action="/api/account/signout" method="POST">
          <button
            type="submit"
            className="rounded-xl border border-black/10 px-4 py-2 text-sm font-medium text-[#51483d] transition hover:bg-black/4"
          >
            Sign out
          </button>
        </form>
      </div>

      <div className="mb-8">
        <Link
          href="/account/profile"
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium text-[#51483d] transition hover:bg-black/4"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Delivery Profile
        </Link>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-[#201d17]">Order History</h2>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-black/8 bg-[#faf7f2] px-6 py-12 text-center">
          <p className="text-sm text-[#6a6258]">You haven&apos;t placed any orders yet.</p>
          <Link
            href="/products"
            className="mt-4 inline-block rounded-xl bg-[#201d17] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#2e2a22]"
          >
            Shop now
          </Link>
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
                <div className="text-right">
                  <StatusBadge status={order.paymentStatus} />
                  <p className="mt-1 text-sm font-semibold text-[#201d17]">
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
                {new Date(order.createdAt).toLocaleDateString("en-MY", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {order.fulfillmentStatus !== "unfulfilled" && (
                  <span className="ml-3 capitalize">{order.fulfillmentStatus}</span>
                )}
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
