import { NextResponse } from "next/server";
import { getProductBySlug } from "@/data/products";
import {
  getAllowedShippingCountries,
  getShippingOptions,
  isAutomaticTaxEnabled,
} from "@/lib/store-config";
import { getStripeServer } from "@/lib/stripe";

export const runtime = "nodejs";

type RawLine = {
  slug?: unknown;
  quantity?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { lines?: RawLine[] };

    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json(
        { error: "Your cart is empty." },
        { status: 400 },
      );
    }

    const consolidatedLines = new Map<string, number>();

    for (const line of body.lines) {
      if (typeof line?.slug !== "string" || typeof line?.quantity !== "number") {
        continue;
      }

      const quantity = Math.max(1, Math.min(99, Math.floor(line.quantity)));
      consolidatedLines.set(
        line.slug,
        (consolidatedLines.get(line.slug) ?? 0) + quantity,
      );
    }

    const lineItems = [...consolidatedLines.entries()]
      .map(([slug, quantity]) => {
        const product = getProductBySlug(slug);

        if (!product) {
          return null;
        }

        return {
          quantity,
          price_data: {
            currency: "myr",
            unit_amount: Math.round(product.price * 100),
            product_data: {
              name: product.name,
              description: product.excerpt,
              images: [new URL(product.image, request.url).toString()],
              metadata: {
                slug: product.slug,
                category: product.categoryLabel,
                size: product.size,
                ...(product.sku ? { sku: product.sku } : {}),
              },
            },
          },
        };
      })
      .filter((line): line is NonNullable<typeof line> => Boolean(line));

    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: "No valid products were found in the cart." },
        { status: 400 },
      );
    }

    const stripe = getStripeServer();
    const siteUrl = new URL(request.url).origin;
    const shippingOptions = getShippingOptions();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "pay",
      customer_creation: "if_required",
      billing_address_collection: "required",
      automatic_tax: {
        enabled: isAutomaticTaxEnabled(),
      },
      shipping_address_collection: {
        allowed_countries: getAllowedShippingCountries(),
      },
      ...(shippingOptions.length > 0 ? { shipping_options: shippingOptions } : {}),
      phone_number_collection: {
        enabled: true,
      },
      allow_promotion_codes: true,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancel`,
      line_items: lineItems,
      metadata: {
        source: "aerthera-storefront",
      },
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return NextResponse.json({ url: session.url });
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
