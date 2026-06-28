import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getProductBySlug } from "@/data/products";
import { createToyyibPayBill, getToyyibPayConfig } from "@/lib/toyyibpay";
import { upsertOrder } from "@/lib/orders";
import { getSupabaseAdmin, isSupabaseOrderStoreConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type RawLine = {
  slug?: unknown;
  quantity?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { lines?: RawLine[] };

    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
    }

    const consolidatedLines = new Map<string, number>();
    for (const line of body.lines) {
      if (typeof line?.slug !== "string" || typeof line?.quantity !== "number") continue;
      const quantity = Math.max(1, Math.min(99, Math.floor(line.quantity)));
      consolidatedLines.set(line.slug, (consolidatedLines.get(line.slug) ?? 0) + quantity);
    }

    type LineItem = {
      name: string;
      quantity: number;
      unitAmountCents: number;
    };

    const lineItems: LineItem[] = [];
    for (const [slug, quantity] of consolidatedLines.entries()) {
      const product = getProductBySlug(slug);
      if (!product) continue;
      lineItems.push({
        name: product.name,
        quantity,
        unitAmountCents: Math.round(product.price * 100),
      });
    }

    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: "No valid products were found in the cart." },
        { status: 400 },
      );
    }

    const subtotalCents = lineItems.reduce(
      (sum, l) => sum + l.unitAmountCents * l.quantity,
      0,
    );

    const sessionId = `TP-${Date.now()}-${randomBytes(4).toString("hex")}`;
    const siteUrl = new URL(request.url).origin;
    const { secretKey, categoryCode } = getToyyibPayConfig();

    // Resolve customer if they're logged in
    let customerId: string | null = null;
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ") && isSupabaseOrderStoreConfigured()) {
      try {
        const token = authHeader.slice(7);
        const supabase = getSupabaseAdmin();
        const { data: { user } } = await supabase.auth.getUser(token);
        customerId = user?.id ?? null;
      } catch {
        // Token invalid — continue as guest
      }
    }

    const now = new Date().toISOString();
    await upsertOrder(
      {
        id: sessionId,
        sessionId,
        paymentIntentId: null,
        createdAt: now,
        updatedAt: now,
        recordedFrom: "webhook",
        customerId,
        customerName: null,
        customerEmail: null,
        customerPhone: null,
        paymentStatus: "pending",
        checkoutStatus: "open",
        currency: "myr",
        subtotalAmount: subtotalCents,
        shippingAmount: null,
        taxAmount: null,
        totalAmount: subtotalCents,
        shippingName: null,
        shippingAddress: null,
        fulfillmentStatus: "unfulfilled",
        trackingNumber: null,
        trackingCarrier: null,
        trackingUrl: null,
        internalNotes: null,
        fulfilledAt: null,
        packageWeightGrams: null,
        packageLengthCm: null,
        packageWidthCm: null,
        packageHeightCm: null,
        packageDescription: null,
        shippingBatchId: null,
        courierShipmentId: null,
        shippingLabelGeneratedAt: null,
        lines: lineItems.map((l) => ({
          description: l.name,
          quantity: l.quantity,
          currency: "myr",
          unitAmount: l.unitAmountCents,
          subtotalAmount: l.unitAmountCents * l.quantity,
          totalAmount: l.unitAmountCents * l.quantity,
        })),
      },
      { preserveAdminFields: false },
    );

    const billDescription = lineItems
      .map((l) => `${l.name} x${l.quantity}`)
      .join(", ")
      .slice(0, 100);

    const bill = await createToyyibPayBill({
      userSecretKey: secretKey,
      categoryCode,
      billName: "Aerthera Order",
      billDescription,
      billAmount: subtotalCents,
      billReturnUrl: `${siteUrl}/checkout/success?order_id=${sessionId}`,
      billCallbackUrl: `${siteUrl}/api/toyyibpay/callback`,
      billExternalReferenceNo: sessionId,
    });

    return NextResponse.json({ url: bill.paymentUrl });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start checkout right now.",
      },
      { status: 500 },
    );
  }
}
