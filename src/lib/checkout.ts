export type CheckoutLineInput = {
  slug: string;
  quantity: number;
};

export async function startCheckout(lines: CheckoutLineInput[]) {
  const sanitizedLines = lines
    .map((line) => ({
      slug: line.slug,
      quantity: Math.max(1, Math.floor(line.quantity)),
    }))
    .filter((line) => line.slug);

  if (sanitizedLines.length === 0) {
    throw new Error("Add at least one product before checking out.");
  }

  const response = await fetch("/api/checkout/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ lines: sanitizedLines }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;

  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error ?? "Unable to start checkout right now.");
  }

  window.location.assign(payload.url);
}
