import { NextResponse } from "next/server";
import { getOrderBySessionId, upsertOrder, type StoredOrder } from "@/lib/orders";
import { decrementStockForOrderLines } from "@/lib/product-stock";
import { sendReceiptEmail } from "@/lib/receipt-email";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

export async function POST(request: Request) {
  try {
    const text = await request.text();
    const params = new URLSearchParams(text);

    const orderId = params.get("order_id");
    const status = params.get("status") ?? params.get("status_id");
    const refno = params.get("refno");
    const transactionId = params.get("transaction_id");
    const amount = params.get("amount");

    if (!orderId) {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    const order = await getOrderBySessionId(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // status 1=success, 2=pending, 3=failed/cancelled
    const isPaid = status === "1";
    const isFailed = status === "3";
    const wasAlreadyPaid = order.paymentStatus === "paid";
    const totalAmountCents = amount
      ? Math.round(parseFloat(amount) * 100)
      : order.totalAmount;

    const updatedOrder: StoredOrder = {
      ...order,
      paymentIntentId: transactionId ?? refno ?? order.paymentIntentId,
      paymentStatus: isPaid ? "paid" : isFailed ? "failed" : "pending",
      checkoutStatus: isPaid ? "complete" : isFailed ? "expired" : "open",
      totalAmount: totalAmountCents ?? order.totalAmount,
      updatedAt: new Date().toISOString(),
    };

    await upsertOrder(updatedOrder, { preserveAdminFields: true });

    // Only run once, the first time this order transitions to paid — ToyyibPay
    // can redeliver the callback, and this must stay idempotent.
    if (isPaid && !wasAlreadyPaid) {
      await decrementStockForOrderLines(
        order.lines.map((line) => ({ slug: line.slug, quantity: line.quantity })),
      );

      // Fail-soft: a receipt problem must never make this callback return non-2xx,
      // or ToyyibPay would redeliver and re-trigger the guard above.
      await sendReceiptEmail(updatedOrder);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("ToyyibPay callback error:", error);
    return NextResponse.json(
      { error: "Callback processing failed" },
      { status: 500 },
    );
  }
}
