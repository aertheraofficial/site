/** TEMPORARY: sends a real receipt email to a given address, to prove the chain works. */
import { readFileSync } from "fs";
import type { StoredOrder } from "@/lib/orders";
import { sendReceiptEmail } from "@/lib/receipt-email";
import { getReceiptNumber } from "@/lib/receipt";

/** tsx doesn't load .env.local the way Next does — parse it manually. */
function loadEnv(file = ".env.local") {
  const raw = readFileSync(file, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env) || !process.env[key]) process.env[key] = value;
  }
}

function buildSample(to: string): StoredOrder {
  return {
    id: "pi_test_live",
    sessionId: "cs_test_live0714amin01",
    paymentIntentId: "TP2607140099X1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    recordedFrom: "webhook",
    customerId: null,
    customerName: "Amin Azuwar",
    customerEmail: to,
    customerPhone: "+60 12-345 6789",
    paymentStatus: "paid",
    checkoutStatus: "complete",
    currency: "myr",
    subtotalAmount: 47600,
    shippingAmount: 1000,
    taxAmount: 0,
    totalAmount: 48600,
    fulfillmentType: "delivery",
    shippingName: "Amin Azuwar",
    shippingAddress: {
      line1: "12-3, Jalan Kerinchi Kiri 2",
      line2: "Pantai Dalam",
      city: "Kuala Lumpur",
      state: "Wilayah Persekutuan",
      postal_code: "59200",
      country: "MY",
    },
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
    lines: [
      {
        slug: "reed-diffuser-lemongrass-malaya-230ml",
        description: "Reed Diffuser Lemongrass Malaya 230ml",
        quantity: 1,
        currency: "myr",
        unitAmount: 19900,
        subtotalAmount: 19900,
        totalAmount: 19900,
      },
      {
        slug: "body-cleanse-shower-gel-lemongrass-malaya-230ml",
        description: "Body Cleanse Shower Gel Lemongrass Malaya 230ml",
        quantity: 1,
        currency: "myr",
        unitAmount: 11600,
        subtotalAmount: 11600,
        totalAmount: 11600,
      },
      {
        slug: "essential-oil-lemongrass-malaya-10ml",
        description: "Essential Oil Lemongrass Malaya 10ml",
        quantity: 1,
        currency: "myr",
        unitAmount: 9900,
        subtotalAmount: 9900,
        totalAmount: 9900,
      },
      {
        slug: "calm-mousseline-lemongrass-malaya-60ml",
        description: "Calm Mousseline Lemongrass Malaya 60ml",
        quantity: 1,
        currency: "myr",
        unitAmount: 6200,
        subtotalAmount: 6200,
        totalAmount: 6200,
      },
    ],
  };
}

async function main() {
  loadEnv();

  const to = process.argv[2];
  if (!to) throw new Error("Usage: tsx scripts/send-test-receipt.ts <email>");

  const key = process.env.RESEND_API_KEY ?? "";
  console.log(`RESEND_API_KEY : ${key ? `set (${key.length} chars, ${key.slice(0, 3)}...)` : "MISSING"}`);
  console.log(`from           : ${process.env.RECEIPT_FROM_EMAIL}`);
  console.log(`to             : ${to}`);

  const order = buildSample(to);
  console.log(`receipt no     : ${getReceiptNumber(order)}`);
  console.log("sending...");

  const ok = await sendReceiptEmail(order);
  console.log(ok ? "RESULT: SENT ✔" : "RESULT: FAILED ✘ (see error above)");
  process.exit(ok ? 0 : 1);
}

void main();
