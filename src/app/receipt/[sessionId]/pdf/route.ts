import { NextResponse } from "next/server";
import { getOrderBySessionId } from "@/lib/orders";
import { generateReceiptPdf, getReceiptNumber } from "@/lib/receipt";

type RouteContext = { params: Promise<{ sessionId: string }> };

// Public receipt PDF, keyed by the order's unguessable session id. Used by the
// counter "Print" button and the WhatsApp receipt link.
export async function GET(_request: Request, { params }: RouteContext) {
  const { sessionId } = await params;
  const order = await getOrderBySessionId(sessionId);

  if (!order || order.paymentStatus !== "paid") {
    return new NextResponse("Receipt not found.", { status: 404 });
  }

  const pdf = await generateReceiptPdf(order);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${getReceiptNumber(order)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
