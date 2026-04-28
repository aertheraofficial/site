import Stripe from "stripe";

type StripeMode = "test" | "live";

const stripeClients = new Map<string, Stripe>();

export function getStripeMode() {
  const explicitMode = process.env.STRIPE_MODE?.trim().toLowerCase();

  if (explicitMode === "live" || explicitMode === "test") {
    return explicitMode;
  }

  return "test";
}

function getModeSpecificSecret(mode: StripeMode) {
  return mode === "live"
    ? process.env.STRIPE_SECRET_KEY_LIVE?.trim()
    : process.env.STRIPE_SECRET_KEY_TEST?.trim();
}

function getModeSpecificWebhookSecret(mode: StripeMode) {
  return mode === "live"
    ? process.env.STRIPE_WEBHOOK_SECRET_LIVE?.trim()
    : process.env.STRIPE_WEBHOOK_SECRET_TEST?.trim();
}

function getSecretKeyForMode(mode: StripeMode) {
  return getModeSpecificSecret(mode) || "";
}

export function getStripeWebhookSecret() {
  const mode = getStripeMode();
  return getModeSpecificWebhookSecret(mode) || "";
}

export function getStripeServer() {
  const mode = getStripeMode();
  const secretKey = getSecretKeyForMode(mode);

  if (!secretKey) {
    throw new Error(
      mode === "live"
        ? "Stripe live mode is selected, but no live secret key is configured."
        : "Stripe test mode is selected, but no test secret key is configured.",
    );
  }

  const cachedClient = stripeClients.get(secretKey);

  if (cachedClient) {
    return cachedClient;
  }

  const stripeClient = new Stripe(secretKey);
  stripeClients.set(secretKey, stripeClient);
  return stripeClient;
}
