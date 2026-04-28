import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { recordCompletedOrder } from "@/lib/orders";
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

      await recordCompletedOrder({
        session,
        lineItems,
        source: "webhook",
      });
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
