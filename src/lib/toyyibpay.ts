const TOYYIBPAY_BASE = "https://toyyibpay.com";

export type ToyyibPayBillParams = {
  userSecretKey: string;
  categoryCode: string;
  billName: string;
  billDescription: string;
  billAmount: number; // in cents (e.g. 1000 = RM10.00)
  billReturnUrl: string;
  billCallbackUrl: string;
  billExternalReferenceNo: string;
  billTo?: string;
  billEmail?: string;
  billPhone?: string;
};

export type ToyyibPayBillResult = {
  billCode: string;
  paymentUrl: string;
};

export async function createToyyibPayBill(
  params: ToyyibPayBillParams,
): Promise<ToyyibPayBillResult> {
  const body = new URLSearchParams({
    userSecretKey: params.userSecretKey,
    categoryCode: params.categoryCode,
    billName: params.billName.slice(0, 30),
    billDescription: params.billDescription.slice(0, 100),
    billPriceSetting: "1",
    billPayorInfo: "1",
    billAmount: String(params.billAmount),
    billReturnUrl: params.billReturnUrl,
    billCallbackUrl: params.billCallbackUrl,
    billExternalReferenceNo: params.billExternalReferenceNo,
    billTo: params.billTo || "Customer",
    billEmail: params.billEmail || "noreply@aerthera.com",
    billPhone: params.billPhone || "0000000000",
    billPaymentChannel: "0",
    billSplitPayment: "0",
    billSplitPaymentArgs: "",
    billMultiPayment: "0",
    billChargeToCustomer: "1",
    billContentEmail: "Thank you for your order. We will process it shortly.",
  });

  const response = await fetch(`${TOYYIBPAY_BASE}/index.php/api/createBill`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ToyyibPay API error: HTTP ${response.status} — ${body.slice(0, 200)}`);
  }

  type ApiResponse = Array<{ BillCode?: string; msg?: string }> | { msg?: string };
  const data = (await response.json()) as ApiResponse;

  if (Array.isArray(data) && data[0]?.BillCode) {
    const billCode = data[0].BillCode;
    return {
      billCode,
      paymentUrl: `${TOYYIBPAY_BASE}/${billCode}`,
    };
  }

  const msg = Array.isArray(data)
    ? (data[0]?.msg ?? "Unknown error from ToyyibPay")
    : ((data as { msg?: string }).msg ?? "Unknown error from ToyyibPay");

  throw new Error(`ToyyibPay: ${msg}`);
}

export function getToyyibPayConfig() {
  const secretKey = process.env.TOYYIBPAY_SECRET_KEY;
  const categoryCode = process.env.TOYYIBPAY_CATEGORY_CODE;

  if (!secretKey) {
    throw new Error("TOYYIBPAY_SECRET_KEY belum diset dalam .env.local");
  }
  if (!categoryCode) {
    throw new Error("TOYYIBPAY_CATEGORY_CODE belum diset dalam .env.local");
  }

  return { secretKey, categoryCode };
}
