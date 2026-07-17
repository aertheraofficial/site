import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getOrderBySessionId, recordCompletedOrder } from "@/lib/orders";
import { sendReceiptEmail } from "@/lib/receipt-email";
import { getStripeServer, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = getStripeWebhookSecret();

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 400 },
    );
  }

  try {
    const payload = await request.text();
    const stripe = getStripeServer();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 100,
      });

      // Capture the prior state before the upsert: Stripe redelivers webhooks, and
      // the success page records the same order, so this is what keeps the receipt
      // from being emailed twice for one payment.
      const existing = await getOrderBySessionId(session.id);
      const wasAlreadyPaid = existing?.paymentStatus === "paid";

      const order = await recordCompletedOrder({
        session,
        lineItems,
        source: "webhook",
      });

      if (session.payment_status === "paid" && !wasAlreadyPaid) {
        // Fail-soft: never let a receipt failure turn this into a non-2xx retry loop.
        await sendReceiptEmail(order);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid Stripe webhook payload.",
      },
      { status: 400 },
    );
  }
}
