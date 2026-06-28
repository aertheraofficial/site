import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

export async function GET() {
  const body = new URLSearchParams({
    userSecretKey: process.env.TOYYIBPAY_SECRET_KEY ?? "",
    categoryCode: process.env.TOYYIBPAY_CATEGORY_CODE ?? "",
    billName: "Test",
    billDescription: "Test order",
    billPriceSetting: "1",
    billPayorInfo: "1",
    billAmount: "100",
    billReturnUrl: "https://www.aerthera.com/checkout/success",
    billCallbackUrl: "https://www.aerthera.com/api/toyyibpay/callback",
    billExternalReferenceNo: `DEBUG-${Date.now()}`,
    billTo: "Test Customer",
    billEmail: "test@aerthera.com",
    billPhone: "0123456789",
    billPaymentChannel: "0",
    billSplitPayment: "0",
    billSplitPaymentArgs: "",
    billMultiPayment: "0",
    billChargeToCustomer: "1",
    billContentEmail: "Test",
  });

  const response = await fetch("https://toyyibpay.com/index.php/api/createBill", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const responseText = await response.text().catch(() => "(empty)");

  return NextResponse.json({
    status: response.status,
    ok: response.ok,
    body: responseText,
    secretKeySet: Boolean(process.env.TOYYIBPAY_SECRET_KEY),
    categoryCodeSet: Boolean(process.env.TOYYIBPAY_CATEGORY_CODE),
    secretKeyPreview: process.env.TOYYIBPAY_SECRET_KEY?.slice(0, 8) + "...",
  });
}
