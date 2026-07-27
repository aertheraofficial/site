import { Resend } from "resend";
import { siteInfo } from "@/data/site";
import { formatMoney } from "@/lib/money";
import type { StoredOrder } from "@/lib/orders";
import {
  generateReceiptPdf,
  getReceiptFilename,
  getReceiptNumber,
  getWhatsAppUrl,
} from "@/lib/receipt";
import { getPublicSiteUrl } from "@/lib/store-config";

/**
 * Emails the PDF receipt to the customer after a confirmed payment.
 *
 * Every function here is fail-soft on purpose: payment webhooks (ToyyibPay,
 * Stripe) treat a non-2xx as "retry me". If email delivery threw, the provider
 * would redeliver the callback forever and re-run the stock decrement guard.
 * A receipt is never worth breaking payment processing over — we log and move on.
 */

export function isReceiptEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function getFromAddress() {
  return (
    process.env.RECEIPT_FROM_EMAIL?.trim() || `${siteInfo.name} <${siteInfo.email}>`
  );
}

/**
 * Mail clients can't load images from localhost, so fall back to the live site
 * whenever the configured origin isn't a public HTTPS one (i.e. in dev).
 */
function getLogoUrl() {
  return `${getPublicSiteUrl()}/assets/brand/logo-lockup.jpeg`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailHtml(order: StoredOrder) {
  const receiptNumber = getReceiptNumber(order);
  const total = order.totalAmount ?? 0;
  const name = order.customerName?.trim() || "there";
  const isPickup = order.fulfillmentType === "pickup";
  const whatsAppUrl = getWhatsAppUrl();

  const rows = order.lines
    .map((line) => {
      const lineTotal =
        line.totalAmount ?? line.subtotalAmount ?? (line.unitAmount ?? 0) * line.quantity;
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e4dccd;color:#201d17;font-size:14px;">
            ${escapeHtml(line.description)}
            <span style="color:#8d7a5c;"> x${line.quantity}</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #e4dccd;color:#201d17;font-size:14px;text-align:right;white-space:nowrap;">
            ${escapeHtml(formatMoney(lineTotal / 100))}
          </td>
        </tr>`;
    })
    .join("");

  // Counter discount, shown between the lines and the total so the customer can
  // see the price they were given.
  const subtotal = order.subtotalAmount ?? 0;
  const discount = order.discountPercent
    ? Math.round((subtotal * order.discountPercent) / 100)
    : 0;
  const discountRow =
    discount > 0
      ? `<tr>
                    <td style="padding:10px 0 0;font-size:14px;color:#8b5e1d;">Discount ${order.discountPercent}%</td>
                    <td style="padding:10px 0 0;font-size:14px;color:#8b5e1d;text-align:right;white-space:nowrap;">
                      -${escapeHtml(formatMoney(discount / 100))}
                    </td>
                  </tr>`
      : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f7f2ea;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2ea;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4dccd;border-radius:16px;padding:32px;font-family:Helvetica,Arial,sans-serif;">
            <tr>
              <td>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:12px;">
                      <img
                        src="${getLogoUrl()}"
                        width="66"
                        height="44"
                        alt="${escapeHtml(siteInfo.name)}"
                        style="display:block;width:66px;height:44px;border-radius:8px;border:1px solid #e4dccd;"
                      />
                    </td>
                    <td>
                      <p style="margin:0;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#201d17;font-weight:700;">
                        ${escapeHtml(siteInfo.name)}
                      </p>
                      <p style="margin:3px 0 0;font-size:12px;color:#8d7a5c;">
                        ${escapeHtml(siteInfo.collection)}
                      </p>
                    </td>
                  </tr>
                </table>

                <h1 style="margin:24px 0 0;font-family:Georgia,serif;font-size:26px;font-weight:600;color:#201d17;">
                  Thank you for your order
                </h1>
                <p style="margin:12px 0 0;font-size:15px;line-height:24px;color:#5d574f;">
                  Hi ${escapeHtml(name)}, we've received your payment. Your official
                  receipt is attached to this email as a PDF.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
                  ${rows}
                  ${discountRow}
                  <tr>
                    <td style="padding:14px 0 0;font-size:15px;font-weight:700;color:#201d17;">Total paid</td>
                    <td style="padding:14px 0 0;font-size:17px;font-weight:700;color:#201d17;text-align:right;">
                      ${escapeHtml(formatMoney(total / 100))}
                    </td>
                  </tr>
                </table>

                <p style="margin:24px 0 0;font-size:13px;line-height:22px;color:#5d574f;">
                  ${
                    isPickup
                      ? "You've chosen to collect this order at our shop. We'll let you know as soon as it's ready."
                      : "We're preparing your order for delivery and will share tracking details once it ships."
                  }
                </p>

                <p style="margin:24px 0 0;font-size:12px;color:#8d7a5c;">
                  Receipt no. ${escapeHtml(receiptNumber)}
                </p>

                ${
                  whatsAppUrl
                    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
                  <tr>
                    <td style="border-radius:999px;background:#25D366;">
                      <a
                        href="${whatsAppUrl}"
                        style="display:inline-block;padding:11px 22px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;"
                      >Chat with us on WhatsApp</a>
                    </td>
                  </tr>
                </table>`
                    : ""
                }

                <hr style="border:none;border-top:1px solid #e4dccd;margin:24px 0;" />
                <p style="margin:0;font-size:11px;line-height:18px;color:#8d7a5c;">
                  ${escapeHtml(siteInfo.company)}<br />
                  Questions? Reply to this email, email
                  <a href="mailto:${escapeHtml(siteInfo.email)}" style="color:#4e6146;">${escapeHtml(siteInfo.email)}</a>${
                    whatsAppUrl
                      ? `, or <a href="${whatsAppUrl}" style="color:#4e6146;">WhatsApp ${escapeHtml(siteInfo.phone)}</a>`
                      : ""
                  }.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export type ReceiptEmailResult = {
  sent: boolean;
  /** Where it went (or was meant to go), so staff can spot a mistyped address. */
  address: string | null;
  /** Short, staff-readable reason when `sent` is false. */
  reason: string | null;
};

/**
 * Generates and emails the receipt. `sent` is true only if Resend accepted it.
 * Never throws — callers are payment webhooks.
 */
export async function sendReceiptEmail(
  order: StoredOrder,
): Promise<ReceiptEmailResult> {
  const to = order.customerEmail?.trim() || null;

  try {
    if (!to) {
      console.warn(`Receipt skipped for ${order.sessionId}: no customer email.`);
      return { sent: false, address: null, reason: "No email address was entered." };
    }

    if (!isReceiptEmailConfigured()) {
      console.warn(
        `Receipt skipped for ${order.sessionId}: RESEND_API_KEY is not configured.`,
      );
      return {
        sent: false,
        address: to,
        reason: "Email sending is not configured on this server (RESEND_API_KEY).",
      };
    }

    const pdfBytes = await generateReceiptPdf(order);
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: `Your Aerthera receipt (${getReceiptNumber(order)})`,
      html: buildEmailHtml(order),
      attachments: [
        {
          filename: getReceiptFilename(order),
          content: Buffer.from(pdfBytes),
        },
      ],
    });

    if (error) {
      console.error(`Receipt email failed for ${order.sessionId}:`, error);
      return { sent: false, address: to, reason: error.message || "Rejected by Resend." };
    }

    return { sent: true, address: to, reason: null };
  } catch (error) {
    console.error(`Receipt email failed for ${order.sessionId}:`, error);
    return {
      sent: false,
      address: to,
      reason: error instanceof Error ? error.message : "Unknown error.",
    };
  }
}
