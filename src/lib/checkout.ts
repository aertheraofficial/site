import { getSupabaseBrowser } from "@/lib/supabase-browser";

export type CheckoutLineInput = {
  slug: string;
  quantity: number;
};

export type FulfillmentType = "delivery" | "pickup";

export type DeliveryAddressInput = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postcode: string;
};

type CheckoutSessionPayload = {
  mode?: string;
  url?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  error?: string;
};

async function postCheckoutSession(
  lines: CheckoutLineInput[],
  fulfillmentType: FulfillmentType,
  deliveryAddress: DeliveryAddressInput | undefined,
  paymentMethod: "qr" | "toyyibpay",
): Promise<CheckoutSessionPayload> {
  const sanitizedLines = lines
    .map((line) => ({
      slug: line.slug,
      quantity: Math.max(1, Math.floor(line.quantity)),
    }))
    .filter((line) => line.slug);

  if (sanitizedLines.length === 0) {
    throw new Error("Add at least one product before checking out.");
  }

  // Attach auth token if the customer is logged in so the API can link the order
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const supabase = getSupabaseBrowser();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch {
    // Not logged in or Supabase not configured — continue as guest
  }

  const response = await fetch("/api/checkout/session", {
    method: "POST",
    headers,
    body: JSON.stringify({
      lines: sanitizedLines,
      fulfillmentType,
      deliveryAddress,
      paymentMethod,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | CheckoutSessionPayload
    | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? "Unable to start checkout right now.");
  }

  return payload;
}

export async function startCheckout(
  lines: CheckoutLineInput[],
  fulfillmentType: FulfillmentType = "delivery",
  deliveryAddress?: DeliveryAddressInput,
) {
  const payload = await postCheckoutSession(
    lines,
    fulfillmentType,
    deliveryAddress,
    "toyyibpay",
  );

  if (!payload.url) {
    throw new Error(payload.error ?? "Unable to start checkout right now.");
  }

  window.location.assign(payload.url);
}

export type QrCheckoutResult = {
  orderId: string;
  /** Amount owed, in cents (MYR). */
  amount: number;
};

/**
 * Creates a pending order and returns the reference + amount so the UI can
 * show the DuitNow QR popup. The customer pays by scanning the merchant QR;
 * an admin confirms the payment afterwards.
 */
export async function startQrCheckout(
  lines: CheckoutLineInput[],
  fulfillmentType: FulfillmentType = "delivery",
  deliveryAddress?: DeliveryAddressInput,
): Promise<QrCheckoutResult> {
  const payload = await postCheckoutSession(
    lines,
    fulfillmentType,
    deliveryAddress,
    "qr",
  );

  if (!payload.orderId || typeof payload.amount !== "number") {
    throw new Error(payload.error ?? "Unable to start checkout right now.");
  }

  return { orderId: payload.orderId, amount: payload.amount };
}
