import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/customers";
import { formatMoney } from "@/lib/money";
import { requirePermission } from "@/lib/staff-auth";

type CustomerDetailProps = {
  params: Promise<{ id: string }>;
};

const dateTimeFormat = new Intl.DateTimeFormat("en-MY", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormat.format(date);
}

export default async function CustomerDetailPage({ params }: CustomerDetailProps) {
  await requirePermission("customers", "/admin/customers");
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  return (
    <div>
      <Link
        href="/admin/customers"
        className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c] transition hover:text-[#201d17]"
      >
        ← Customer Book
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
            {customer.fullName}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#5d574f]">
            {[customer.phone, customer.email].filter(Boolean).join(" · ") ||
              "No contact details on file"}
          </p>
          <p className="mt-1 text-xs text-[#8d7a5c]">
            {customer.isMember
              ? `Registered at the counter${customer.location ? ` · ${customer.location}` : ""}`
              : "Online / guest customer"}
            {" · "}
            {customer.paidOrderCount} paid{" "}
            {customer.paidOrderCount === 1 ? "receipt" : "receipts"}
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-black/8 bg-white px-5 py-3 text-center">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8d7a5c]">
            Lifetime spend
          </p>
          <p className="mt-1 text-xl font-semibold text-[#201d17]">
            {formatMoney(customer.totalSpentCents / 100)}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {customer.receipts.map((receipt) => (
          <div
            key={receipt.sessionId}
            className="rounded-[1.25rem] border border-black/8 bg-white p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#201d17]">{receipt.receiptNumber}</p>
                <p className="mt-1 text-xs text-[#8d7a5c]">
                  {formatDateTime(receipt.createdAt)} ·{" "}
                  {receipt.recordedFrom === "admin-walk-in" ? "Counter sale" : "Online"} ·{" "}
                  {receipt.itemCount} {receipt.itemCount === 1 ? "item" : "items"}
                  {receipt.soldByName ? ` · Sold by ${receipt.soldByName}` : ""}
                  {receipt.discountPercent ? ` · ${receipt.discountPercent}% off` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-[#201d17]">
                  {formatMoney((receipt.totalAmount ?? 0) / 100)}
                </p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[0.66rem] font-semibold uppercase tracking-[0.12em] ${
                    receipt.paymentStatus === "paid"
                      ? "bg-[#e9f7ee] text-[#256542]"
                      : "bg-[#f8f1e4] text-[#8b5e1d]"
                  }`}
                >
                  {receipt.paymentStatus || "unknown"}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={receipt.receiptPath}
                target="_blank"
                className="inline-flex h-9 items-center rounded-full border border-black/10 bg-[#f7f2ea] px-4 text-xs font-semibold text-[#201d17] transition hover:bg-black/4"
              >
                View receipt
              </Link>
              <Link
                href={`${receipt.receiptPath}/pdf`}
                target="_blank"
                className="inline-flex h-9 items-center rounded-full border border-black/10 bg-[#f7f2ea] px-4 text-xs font-semibold text-[#201d17] transition hover:bg-black/4"
              >
                PDF / print
              </Link>
              {receipt.whatsAppUrl ? (
                <a
                  href={receipt.whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-full border border-[#25a35a] bg-[#eaf7ef] px-4 text-xs font-semibold text-[#1c7a43] transition hover:bg-[#dcf1e4]"
                >
                  Send by WhatsApp
                </a>
              ) : null}
              <Link
                href={`/admin/orders/${receipt.sessionId}`}
                className="inline-flex h-9 items-center rounded-full border border-black/10 px-4 text-xs font-semibold text-[#5d574f] transition hover:bg-[#f7f2ea]"
              >
                Order details
              </Link>
            </div>
          </div>
        ))}

        {customer.receipts.length === 0 ? (
          <p className="rounded-[1.25rem] border border-dashed border-black/10 bg-[#f7f2ea] px-5 py-8 text-center text-sm text-[#8d7a5c]">
            No receipts yet for this customer.
          </p>
        ) : null}
      </div>
    </div>
  );
}
