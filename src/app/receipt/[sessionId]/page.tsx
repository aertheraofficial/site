import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteInfo } from "@/data/site";
import { formatShopDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { getOrderBySessionId } from "@/lib/orders";
import { getReceiptNumber } from "@/lib/receipt";

export const metadata: Metadata = {
  title: "Receipt",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ sessionId: string }> };

const ringgit = (cents: number | null) => formatMoney((cents ?? 0) / 100);

export default async function ReceiptPage({ params }: PageProps) {
  const { sessionId } = await params;
  const order = await getOrderBySessionId(sessionId);

  if (!order || order.paymentStatus !== "paid") {
    notFound();
  }

  const receiptNo = getReceiptNumber(order);
  const date = formatShopDateTime(order.createdAt);

  return (
    <main className="mx-auto max-w-md px-5 py-10 text-[#201d17]">
      <div className="rounded-2xl border border-[#e3dccd] bg-white p-6 shadow-sm">
        <header className="border-b border-[#efe9dc] pb-4 text-center">
          <p className="font-display text-2xl tracking-[-0.03em]">
            {siteInfo.name}
          </p>
          <p className="mt-1 text-[0.72rem] uppercase tracking-[0.28em] text-[#9a8f78]">
            {siteInfo.collection}
          </p>
        </header>

        <div className="mt-4 flex justify-between text-[0.82rem] text-[#6b6252]">
          <span>Receipt {receiptNo}</span>
          <span>{date}</span>
        </div>
        {order.customerName ? (
          <p className="mt-1 text-[0.82rem] text-[#6b6252]">{order.customerName}</p>
        ) : null}

        <ul className="mt-5 space-y-3">
          {order.lines.map((line, index) => (
            <li key={`${line.slug}-${index}`} className="flex justify-between gap-3 text-sm">
              <span className="text-[#201d17]">
                {line.description}
                <span className="text-[#9a8f78]"> × {line.quantity}</span>
              </span>
              <span className="tabular-nums">{ringgit(line.totalAmount)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex justify-between border-t border-[#efe9dc] pt-4 text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{ringgit(order.totalAmount)}</span>
        </div>

        <a
          href={`/receipt/${encodeURIComponent(sessionId)}/pdf`}
          className="mt-6 block rounded-full bg-[#201d17] py-3 text-center text-sm font-semibold text-white"
        >
          Download / Print PDF
        </a>

        <p className="mt-4 text-center text-[0.72rem] text-[#9a8f78]">
          Thank you for shopping with {siteInfo.name}. Questions?{" "}
          {siteInfo.email}
        </p>
      </div>
    </main>
  );
}
