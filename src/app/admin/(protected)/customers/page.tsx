import Link from "next/link";
import {
  filterCustomers,
  filterCustomersBySeller,
  listCustomers,
} from "@/lib/customers";
import { formatMoney } from "@/lib/money";
import { requirePermission } from "@/lib/staff-auth";
import { isSupabaseOrderStoreConfigured } from "@/lib/supabase-admin";

type CustomersPageProps = {
  searchParams: Promise<{ q?: string; sold?: string }>;
};

const dateFormat = new Intl.DateTimeFormat("en-MY", {
  dateStyle: "medium",
});

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const actor = await requirePermission("customers", "/admin/customers");
  const { q = "", sold = "" } = await searchParams;
  const viewerId = actor.type === "admin" ? "admin" : actor.staff.id;
  const mineOnly = sold === "me";

  if (!isSupabaseOrderStoreConfigured()) {
    return (
      <div className="rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-5 py-6 text-sm leading-7 text-[#8b5e1d]">
        Supabase is not configured, so the customer book is unavailable. Add
        <code className="mx-1">SUPABASE_URL</code> and
        <code className="mx-1">SUPABASE_SERVICE_ROLE_KEY</code>, then run
        <code className="mx-1">supabase/add_members.sql</code>.
      </div>
    );
  }

  const all = await listCustomers();
  const scoped = mineOnly ? filterCustomersBySeller(all, viewerId) : all;
  const customers = filterCustomers(scoped, q);
  const totalSpent = scoped.reduce((sum, customer) => sum + customer.totalSpentCents, 0);
  const withOrders = scoped.filter((customer) => customer.orderCount > 0).length;
  const mineCount = filterCustomersBySeller(all, viewerId).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8d7a5c]">
            Customers
          </p>
          <h2 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
            Customer Book
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#5d574f]">
            Everyone registered at the counter or who has checked out online, with
            every receipt they have been issued. Open a customer to resend a receipt
            by WhatsApp or print it again.
          </p>
        </div>
        <div className="flex gap-2 text-center">
          <div className="rounded-[1.25rem] border border-black/8 bg-white px-5 py-3">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8d7a5c]">
              Customers
            </p>
            <p className="mt-1 text-xl font-semibold text-[#201d17]">{all.length}</p>
          </div>
          <div className="rounded-[1.25rem] border border-black/8 bg-white px-5 py-3">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8d7a5c]">
              With orders
            </p>
            <p className="mt-1 text-xl font-semibold text-[#201d17]">{withOrders}</p>
          </div>
          <div className="rounded-[1.25rem] border border-black/8 bg-white px-5 py-3">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8d7a5c]">
              Lifetime sales
            </p>
            <p className="mt-1 text-xl font-semibold text-[#201d17]">
              {formatMoney(totalSpent / 100)}
            </p>
          </div>
        </div>
      </div>

      <form method="get" className="mt-6 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, phone or email"
          className="h-11 min-w-[16rem] flex-1 rounded-full border border-black/8 bg-white px-5 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59]"
        />
        {mineOnly ? <input type="hidden" name="sold" value="me" /> : null}
        <button
          type="submit"
          className="h-11 rounded-full bg-[#201d17] px-6 text-sm font-semibold text-white transition hover:bg-[#2e2a22]"
        >
          Search
        </button>
        {q ? (
          <Link
            href={mineOnly ? "/admin/customers?sold=me" : "/admin/customers"}
            className="inline-flex h-11 items-center rounded-full border border-black/10 px-5 text-sm font-semibold text-[#201d17] transition hover:bg-[#f7f2ea]"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {/* Who did I sell to? Staff see their own sales without scrolling the book. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          { label: "Everyone", value: "", count: all.length },
          { label: "Sold by me", value: "me", count: mineCount },
        ].map((filter) => {
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (filter.value) params.set("sold", filter.value);
          const href = `/admin/customers${params.size ? `?${params}` : ""}`;
          const isActive = (mineOnly ? "me" : "") === filter.value;

          return (
            <Link
              key={filter.label}
              href={href}
              className={`inline-flex h-9 items-center rounded-full border px-4 text-[0.72rem] font-semibold transition ${
                isActive
                  ? "border-[#201d17] bg-[#201d17] text-white"
                  : "border-black/8 bg-white text-[#201d17] hover:bg-[#f7f2ea]"
              }`}
            >
              {filter.label} ({filter.count})
            </Link>
          );
        })}
      </div>

      <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-black/8 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-black/8 bg-[#faf6ef] text-[0.68rem] uppercase tracking-[0.12em] text-[#8d7a5c]">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Receipts</th>
                <th className="px-4 py-3 font-semibold">Spent</th>
                <th className="px-4 py-3 font-semibold">Last purchase</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#201d17]">{customer.fullName}</p>
                    <p className="text-xs text-[#8d7a5c]">
                      {customer.isMember
                        ? `Member since ${formatDate(customer.joinedAt)}`
                        : "Online / guest"}
                      {customer.location ? ` · ${customer.location}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[#5d574f]">
                    <p>{customer.phone || "—"}</p>
                    <p className="text-xs text-[#8d7a5c]">{customer.email || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-[#5d574f]">{customer.orderCount}</td>
                  <td className="px-4 py-3 font-semibold text-[#201d17]">
                    {formatMoney(customer.totalSpentCents / 100)}
                  </td>
                  <td className="px-4 py-3 text-[#5d574f]">
                    {formatDate(customer.lastOrderAt)}
                    {customer.soldBy.length > 0 ? (
                      <p className="text-xs text-[#8d7a5c]">
                        Sold by {customer.soldBy.map((staff) => staff.name).join(", ")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-semibold text-[#201d17] transition hover:bg-[#f7f2ea]"
                    >
                      Receipts
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {customers.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#8d7a5c]">
            {q
              ? `No customer matches "${q}".`
              : "No customers yet. Fill in the customer details when recording a counter sale."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
