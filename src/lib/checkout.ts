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

export async function startCheckout(
  lines: CheckoutLineInput[],
  fulfillmentType: FulfillmentType = "delivery",
  deliveryAddress?: DeliveryAddressInput,
) {
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
    body: JSON.stringify({ lines: sanitizedLines, fulfillmentType, deliveryAddress }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;

  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error ?? "Unable to start checkout right now.");
  }

  window.location.assign(payload.url);
}
