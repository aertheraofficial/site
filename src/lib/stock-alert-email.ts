import { Resend } from "resend";
import { siteInfo } from "@/data/site";
import { PREORDER_THRESHOLD } from "@/lib/product-availability";
import { getPublicSiteUrl } from "@/lib/store-config";

/**
 * Internal restock alerts to the shop's own inbox — never sent to a customer.
 *
 * Fail-soft like the receipt mailer, and for the same reason: the low-stock path
 * runs inside the paid-order callback, where a throw would make ToyyibPay
 * redeliver the callback and re-enter the stock decrement guard. An alert email
 * is never worth double-decrementing stock over.
 */

export type StockAlertReason = "low-stock" | "sold-out" | "preorder-requested";

export type StockAlert = {
  reason: StockAlertReason;
  slug: string;
  productName: string;
  locationId: string;
  locationName: string;
  /** Units left. Null for pre-order products, which are untracked by design. */
  quantity: number | null;
  /** Staff member who pressed Pre-order. Null for automatic alerts. */
  requestedBy?: string | null;
};

/** Comma-separated, so more than one person can be on the list. */
export function getStockAlertRecipients() {
  return (process.env.STOCK_ALERT_TO_EMAIL ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

export function isStockAlertConfigured() {
  return (
    Boolean(process.env.RESEND_API_KEY?.trim()) && getStockAlertRecipients().length > 0
  );
}

/**
 * Number the "Send on WhatsApp" button in Manage Stock messages. Deliberately has
 * no fallback to siteInfo.phone — that is the public customer-facing line, and a
 * restock request must never land there by accident. Unset simply hides the button.
 */
export function getStockAlertWhatsAppPhone() {
  return process.env.STOCK_ALERT_WHATSAPP_PHONE?.trim() || null;
}

/** Prefilled text for the restock WhatsApp message. */
export function buildRestockMessage(input: {
  productName: string;
  locationName: string;
  requestedBy?: string | null;
}) {
  const by = input.requestedBy?.trim();
  return [
    `Restock request: ${input.productName}`,
    `Location: ${input.locationName}`,
    by ? `Marked pre-order by: ${by}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function getFromAddress() {
  return (
    process.env.RECEIPT_FROM_EMAIL?.trim() || `${siteInfo.name} <${siteInfo.email}>`
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSubject(alert: StockAlert) {
  switch (alert.reason) {
    case "sold-out":
      return `Sold out — ${alert.productName} (${alert.locationName})`;
    case "preorder-requested":
      return `Pre-order requested — ${alert.productName} (${alert.locationName})`;
    default:
      return `Low stock — ${alert.productName}, ${alert.quantity ?? 0} left (${alert.locationName})`;
  }
}

function buildHeadline(alert: StockAlert) {
  switch (alert.reason) {
    case "sold-out":
      return "Sold out — restock needed";
    case "preorder-requested":
      return "Pre-order requested by staff";
    default:
      return "Running low — restock soon";
  }
}

function buildLead(alert: StockAlert) {
  switch (alert.reason) {
    case "sold-out":
      return `<strong>${escapeHtml(alert.productName)}</strong> just hit 0 units at ${escapeHtml(
        alert.locationName,
      )}. It now shows as Sold Out on the storefront and cannot be bought.`;
    case "preorder-requested":
      return `${escapeHtml(
        alert.requestedBy?.trim() || "A staff member",
      )} marked <strong>${escapeHtml(
        alert.productName,
      )}</strong> as pre-order at ${escapeHtml(
        alert.locationName,
      )}. Stock is no longer tracked for it, and the storefront will keep accepting orders while you restock.`;
    default:
      return `<strong>${escapeHtml(alert.productName)}</strong> is down to ${
        alert.quantity ?? 0
      } unit${alert.quantity === 1 ? "" : "s"} at ${escapeHtml(
        alert.locationName,
      )} — at or below the ${PREORDER_THRESHOLD}-unit mark, so the storefront now shows it as Pre-order.`;
  }
}

function buildEmailHtml(alert: StockAlert) {
  const stockUrl = `${getPublicSiteUrl()}/admin/stock?location=${encodeURIComponent(
    alert.locationId,
  )}`;
  const quantityLabel =
    alert.quantity === null ? "Not tracked (pre-order)" : `${alert.quantity}`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f7f2ea;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2ea;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4dccd;border-radius:16px;padding:32px;font-family:Helvetica,Arial,sans-serif;">
            <tr>
              <td>
                <p style="margin:0;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#8d7a5c;font-weight:700;">
                  ${escapeHtml(siteInfo.name)} — Stock alert
                </p>

                <h1 style="margin:16px 0 0;font-family:Georgia,serif;font-size:24px;font-weight:600;color:#201d17;">
                  ${escapeHtml(buildHeadline(alert))}
                </h1>
                <p style="margin:12px 0 0;font-size:15px;line-height:24px;color:#5d574f;">
                  ${buildLead(alert)}
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #e4dccd;font-size:13px;color:#8d7a5c;">Product</td>
                    <td style="padding:8px 0;border-bottom:1px solid #e4dccd;font-size:13px;color:#201d17;text-align:right;">
                      ${escapeHtml(alert.productName)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #e4dccd;font-size:13px;color:#8d7a5c;">Location</td>
                    <td style="padding:8px 0;border-bottom:1px solid #e4dccd;font-size:13px;color:#201d17;text-align:right;">
                      ${escapeHtml(alert.locationName)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #e4dccd;font-size:13px;color:#8d7a5c;">Units left</td>
                    <td style="padding:8px 0;border-bottom:1px solid #e4dccd;font-size:13px;color:#201d17;text-align:right;">
                      ${escapeHtml(quantityLabel)}
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
                  <tr>
                    <td style="border-radius:999px;background:#201d17;">
                      <a
                        href="${stockUrl}"
                        style="display:inline-block;padding:11px 22px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;"
                      >Open Manage Stock</a>
                    </td>
                  </tr>
                </table>

                <hr style="border:none;border-top:1px solid #e4dccd;margin:24px 0;" />
                <p style="margin:0;font-size:11px;line-height:18px;color:#8d7a5c;">
                  Automatic alert from ${escapeHtml(siteInfo.name)}. Change who receives
                  these with the STOCK_ALERT_TO_EMAIL environment variable.
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

/**
 * Emails the restock alert to the internal recipient list.
 * Returns true only if Resend accepted it. Never throws.
 */
export async function sendStockAlertEmail(alert: StockAlert): Promise<boolean> {
  try {
    const to = getStockAlertRecipients();

    if (to.length === 0 || !process.env.RESEND_API_KEY?.trim()) {
      // Not configured is the normal state on a fresh install — don't shout.
      return false;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: buildSubject(alert),
      html: buildEmailHtml(alert),
    });

    if (error) {
      console.error(`Stock alert email failed for ${alert.slug}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Stock alert email failed for ${alert.slug}:`, error);
    return false;
  }
}
