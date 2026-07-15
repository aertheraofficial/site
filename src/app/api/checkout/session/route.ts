import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createToyyibPayBill, getToyyibPayConfig } from "@/lib/toyyibpay";
import { upsertOrder } from "@/lib/orders";
import { getProductBySlugWithStock, getQuantitiesForSlugs } from "@/lib/product-stock";
import { getSupabaseAdmin, isSupabaseOrderStoreConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const preferredRegion = "sin1"; // Singapore — closest to ToyyibPay (Malaysia)

type RawLine = {
  slug?: unknown;
  quantity?: unknown;
};

type RawDeliveryAddress = {
  name?: unknown;
  line1?: unknown;
  line2?: unknown;
  city?: unknown;
  state?: unknown;
  postcode?: unknown;
};

function textOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      lines?: RawLine[];
      fulfillmentType?: unknown;
      deliveryAddress?: RawDeliveryAddress;
    };

    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
    }

    const fulfillmentType = body.fulfillmentType === "pickup" ? "pickup" : "delivery";

    const shippingName = textOrNull(body.deliveryAddress?.name);
    const shippingLine1 = textOrNull(body.deliveryAddress?.line1);
    const shippingLine2 = textOrNull(body.deliveryAddress?.line2);
    const shippingCity = textOrNull(body.deliveryAddress?.city);
    const shippingState = textOrNull(body.deliveryAddress?.state);
    const shippingPostcode = textOrNull(body.deliveryAddress?.postcode);

    if (
      fulfillmentType === "delivery" &&
      (!shippingName || !shippingLine1 || !shippingCity || !shippingState || !shippingPostcode)
    ) {
      return NextResponse.json(
        { error: "Please fill in your delivery address before checking out." },
        { status: 400 },
      );
    }

    const consolidatedLines = new Map<string, number>();
    for (const line of body.lines) {
      if (typeof line?.slug !== "string" || typeof line?.quantity !== "number") continue;
      const quantity = Math.max(1, Math.min(99, Math.floor(line.quantity)));
      consolidatedLines.set(line.slug, (consolidatedLines.get(line.slug) ?? 0) + quantity);
    }

    type LineItem = {
      slug: string;
      name: string;
      quantity: number;
      unitAmountCents: number;
    };

    const lineItems: LineItem[] = [];
    for (const [slug, quantity] of consolidatedLines.entries()) {
      const product = await getProductBySlugWithStock(slug);
      if (!product) continue;
      lineItems.push({
        slug,
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

    const trackedQuantities = await getQuantitiesForSlugs(lineItems.map((l) => l.slug));
    for (const item of lineItems) {
      const available = trackedQuantities.get(item.slug);
      if (available !== null && available !== undefined && item.quantity > available) {
        return NextResponse.json(
          {
            error:
              available > 0
                ? `Only ${available} of "${item.name}" left in stock.`
                : `"${item.name}" is sold out.`,
          },
          { status: 400 },
        );
      }
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
    let customerEmail: string | null = null;
    let customerName: string | null = null;
    let customerPhone: string | null = null;
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ") && isSupabaseOrderStoreConfigured()) {
      try {
        const token = authHeader.slice(7);
        const supabase = getSupabaseAdmin();
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          customerId = user.id;
          customerEmail = user.email ?? null;
          // Load saved delivery profile for name + phone
          const { data: profile } = await supabase
            .from("customer_profiles")
            .select("full_name, phone")
            .eq("user_id", user.id)
            .single();
          customerName = profile?.full_name ?? null;
          customerPhone = profile?.phone ?? null;
        }
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
        customerName,
        customerEmail,
        customerPhone,
        paymentStatus: "pending",
        checkoutStatus: "open",
        currency: "myr",
        subtotalAmount: subtotalCents,
        shippingAmount: null,
        taxAmount: null,
        totalAmount: subtotalCents,
        fulfillmentType,
        shippingName: fulfillmentType === "delivery" ? shippingName : null,
        shippingAddress:
          fulfillmentType === "delivery"
            ? {
                line1: shippingLine1,
                line2: shippingLine2,
                city: shippingCity,
                state: shippingState,
                postal_code: shippingPostcode,
                country: "MY",
              }
            : null,
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
          slug: l.slug,
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
      billTo: customerName ?? undefined,
      billEmail: customerEmail ?? undefined,
      billPhone: customerPhone ?? undefined,
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
