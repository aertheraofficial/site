/** TEMPORARY: renders a sample receipt so the layout can be eyeballed. Safe to delete. */
import { writeFileSync } from "fs";
import type { StoredOrder } from "@/lib/orders";
import { generateReceiptPdf } from "@/lib/receipt";

const sample: StoredOrder = {
  id: "pi_sample_123",
  sessionId: "cs_test_a1b2c3d4e5f6a7b8",
  paymentIntentId: "TP2607140099X1",
  createdAt: new Date("2026-07-14T10:24:00Z").toISOString(),
  updatedAt: new Date("2026-07-14T10:24:00Z").toISOString(),
  recordedFrom: "webhook",
  customerId: null,
  memberId: null,
  location: null,
  soldById: null,
  soldByName: null,
  customerName: "Nurul Aisyah binti Rahman",
  customerEmail: "nurul.aisyah@example.com",
  customerPhone: "+60 12-345 6789",
  paymentMethod: "duitnow-qr",
  paymentStatus: "paid",
  checkoutStatus: "complete",
  currency: "myr",
  subtotalAmount: 47600,
  shippingAmount: 1000,
  taxAmount: 0,
  totalAmount: 48600,
  fulfillmentType: "delivery",
  shippingName: "Nurul Aisyah binti Rahman",
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
  discountPercent: null,
  receiptNumber: null,
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
      quantity: 2,
      currency: "myr",
      unitAmount: 6200,
      subtotalAmount: 12400,
      totalAmount: 12400,
    },
  ],
};

async function main() {
  const pdf = await generateReceiptPdf(sample);
  const out = process.argv[2] ?? "/tmp/sample-receipt.pdf";
  writeFileSync(out, Buffer.from(pdf));
  console.log(`wrote ${out} (${pdf.length} bytes)`);
}

void main();
