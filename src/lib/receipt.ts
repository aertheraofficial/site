import { promises as fs } from "fs";
import path from "path";
import {
  PDFDocument,
  PDFName,
  PDFString,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type PDFRef,
} from "pdf-lib";
import { siteInfo } from "@/data/site";
import { formatMoney } from "@/lib/money";
import type { StoredOrder } from "@/lib/orders";

/**
 * Branded PDF receipt for a paid order.
 *
 * Scope note: this is a normal retail receipt, NOT an LHDN-validated e-Invoice.
 * Aerthera is under the RM1m turnover threshold and therefore exempt from
 * e-Invoicing. The fields below are deliberately kept aligned with what MyInvois
 * would need (supplier + buyer identity, itemised lines, tax, totals) so that a
 * consolidated e-invoice can be added later without reworking this document.
 */

const PAGE: [number, number] = [595.28, 841.89]; // A4
const MARGIN = 48;
const RIGHT = PAGE[0] - MARGIN;

// Column geometry — every x is derived from these, so nothing drifts.
const COL_QTY_RIGHT = 384;
const COL_UNIT_RIGHT = 464;
const COL_AMOUNT_RIGHT = RIGHT - 10;
const CELL_PAD = 10;

const INK = rgb(0.126, 0.114, 0.09); // #201d17
const MUTED = rgb(0.42, 0.4, 0.36);
const SOFT = rgb(0.553, 0.478, 0.361); // #8d7a5c
const LINE = rgb(0.886, 0.863, 0.824);
const HAIRLINE = rgb(0.93, 0.91, 0.88);
const CREAM = rgb(0.969, 0.949, 0.918); // #f7f2ea
const GREEN = rgb(0.145, 0.396, 0.259);
const GREEN_BG = rgb(0.914, 0.969, 0.933);

/** Standard PDF fonts are WinAnsi-encoded — strip anything they can't draw. */
function sanitize(value: string) {
  return value
    .replace(/ /g, " ")
    .replace(/[‐-―]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

/** Order amounts are stored in minor units (cents); formatMoney expects ringgit. */
function money(cents: number) {
  return sanitize(formatMoney(cents / 100));
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number) {
  let out = sanitize(text);
  if (font.widthOfTextAtSize(out, size) <= maxWidth) return out;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}...`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Deterministic receipt number — the same order always yields the same number,
 * so a redelivered webhook can never mint a second receipt for one payment.
 */
export function getReceiptNumber(order: StoredOrder) {
  const date = new Date(order.createdAt);
  const stamp = Number.isNaN(date.getTime()) ? new Date() : date;
  const y = stamp.getFullYear();
  const m = String(stamp.getMonth() + 1).padStart(2, "0");
  const d = String(stamp.getDate()).padStart(2, "0");
  const suffix = order.sessionId.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase();
  return `AE-${y}${m}${d}-${suffix || "000000"}`;
}

/**
 * wa.me links take the number in full international form, digits only —
 * no "+", spaces or dashes.
 */
export function getWhatsAppUrl() {
  const digits = siteInfo.phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

/** Turn a local Malaysian number into wa.me digits (0123... -> 60123...). */
export function toWhatsAppDigits(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `60${digits.slice(1)}`;
  return digits.length >= 8 ? digits : null;
}

/** Chat link to a customer's number, pre-filled with `message`. */
export function buildWhatsAppShareUrl(phone: string | null, message: string) {
  const digits = phone ? toWhatsAppDigits(phone) : null;
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}

function isSstEnabled() {
  const value = process.env.RECEIPT_SST_ENABLED?.toLowerCase();
  return ["1", "true", "yes", "on"].includes(value ?? "");
}

async function loadLogo() {
  try {
    return await fs.readFile(
      path.join(process.cwd(), "public/assets/brand/logo-lockup.jpeg"),
    );
  } catch {
    return null; // Receipt still renders with the text lockup.
  }
}

function formatAddress(address: StoredOrder["shippingAddress"]) {
  if (!address) return "";
  return [
    address.line1,
    address.line2,
    [address.postal_code, address.city].filter(Boolean).join(" "),
    address.state,
    address.country,
  ]
    .filter((part) => part && String(part).trim())
    .join(", ");
}

function drawRight(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  font: PDFFont,
  size: number,
  color = INK,
) {
  const clean = sanitize(text);
  page.drawText(clean, {
    x: rightX - font.widthOfTextAtSize(clean, size),
    y,
    size,
    font,
    color,
  });
}

export async function generateReceiptPdf(order: StoredOrder): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage(PAGE);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Clickable regions are PDF link annotations; collect them and attach once at
  // the end, since setting "Annots" replaces the whole array.
  const annotations: PDFRef[] = [];

  function addLink(x: number, yPos: number, width: number, height: number, url: string) {
    annotations.push(
      pdf.context.register(
        pdf.context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: [x, yPos, x + width, yPos + height],
          Border: [0, 0, 0],
          A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
        }),
      ),
    );
  }

  /** Draws text and makes exactly that text clickable. */
  function drawLinkedText(
    text: string,
    x: number,
    yPos: number,
    font: PDFFont,
    size: number,
    color: ReturnType<typeof rgb>,
    url: string,
  ) {
    const clean = sanitize(text);
    page.drawText(clean, { x, y: yPos, size, font, color });
    addLink(x, yPos - 2, font.widthOfTextAtSize(clean, size), size + 3, url);
  }

  const whatsAppUrl = getWhatsAppUrl();
  let y = PAGE[1] - MARGIN;

  pdf.setTitle(`Receipt ${getReceiptNumber(order)}`);
  pdf.setAuthor(siteInfo.company);
  pdf.setSubject("Purchase receipt");
  pdf.setProducer("Aerthera");

  // ---- Header --------------------------------------------------------------
  const logoBytes = await loadLogo();
  let textX = MARGIN;
  let logoHeight = 44;

  if (logoBytes) {
    try {
      const logo = await pdf.embedJpg(logoBytes);
      // The lockup is 3:2 landscape — scaleToFit keeps its real proportions.
      // Never pass a fixed width AND height here: that squashes the logo.
      const dims = logo.scaleToFit(78, 46);
      page.drawImage(logo, {
        x: MARGIN,
        y: y - dims.height,
        width: dims.width,
        height: dims.height,
      });
      textX = MARGIN + dims.width + 14;
      logoHeight = dims.height;
    } catch {
      // Unreadable logo — fall through to the text lockup.
    }
  }

  page.drawText(sanitize(siteInfo.name.toUpperCase()), {
    x: textX,
    y: y - 13,
    size: 14,
    font: bold,
    color: INK,
  });
  page.drawText(sanitize(siteInfo.collection), {
    x: textX,
    y: y - 26,
    size: 8.5,
    font: regular,
    color: SOFT,
  });
  page.drawText(sanitize(siteInfo.company), {
    x: textX,
    y: y - 38,
    size: 7.5,
    font: regular,
    color: MUTED,
  });

  drawRight(page, "RECEIPT", RIGHT, y - 15, bold, 21, INK);
  drawRight(page, "Official purchase receipt", RIGHT, y - 28, regular, 8, SOFT);

  y -= Math.max(logoHeight, 44) + 20;

  // ---- Supplier contact ----------------------------------------------------
  for (const line of wrap(siteInfo.address, regular, 7.5, 290)) {
    page.drawText(line, { x: MARGIN, y, size: 7.5, font: regular, color: MUTED });
    y -= 10;
  }
  // Email and phone are drawn as separate runs so each can carry its own link.
  drawLinkedText(siteInfo.email, MARGIN, y, regular, 7.5, MUTED, `mailto:${siteInfo.email}`);
  const emailWidth = regular.widthOfTextAtSize(sanitize(siteInfo.email), 7.5);
  const separator = "  |  ";
  page.drawText(separator, {
    x: MARGIN + emailWidth,
    y,
    size: 7.5,
    font: regular,
    color: MUTED,
  });

  const phoneX = MARGIN + emailWidth + regular.widthOfTextAtSize(separator, 7.5);
  if (whatsAppUrl) {
    drawLinkedText(siteInfo.phone, phoneX, y, regular, 7.5, MUTED, whatsAppUrl);
    const phoneWidth = regular.widthOfTextAtSize(sanitize(siteInfo.phone), 7.5);
    drawLinkedText(
      "  (WhatsApp)",
      phoneX + phoneWidth,
      y,
      regular,
      7.5,
      GREEN,
      whatsAppUrl,
    );
  } else {
    page.drawText(sanitize(siteInfo.phone), {
      x: phoneX,
      y,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
  }
  y -= 18;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: RIGHT, y },
    thickness: 0.8,
    color: LINE,
  });
  y -= 26;

  // ---- Meta (left) + Bill to (right) ---------------------------------------
  const issued = new Date(order.createdAt);
  const issuedDate = Number.isNaN(issued.getTime()) ? new Date() : issued;
  const issuedText = issuedDate.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const metaRows: Array<[string, string]> = [
    ["Receipt No.", getReceiptNumber(order)],
    ["Date Issued", issuedText],
    ["Order Ref.", order.sessionId],
  ];
  if (order.paymentIntentId) metaRows.push(["Payment Ref.", order.paymentIntentId]);

  const BILL_X = 330;
  const metaValueX = MARGIN + 76;
  let metaY = y;

  for (const [label, value] of metaRows) {
    page.drawText(sanitize(label.toUpperCase()), {
      x: MARGIN,
      y: metaY,
      size: 7,
      font: bold,
      color: SOFT,
    });
    page.drawText(truncate(value, regular, 8.5, BILL_X - metaValueX - 16), {
      x: metaValueX,
      y: metaY - 0.5,
      size: 8.5,
      font: regular,
      color: INK,
    });
    metaY -= 14;
  }

  let billY = y;
  const billWidth = RIGHT - BILL_X;
  page.drawText("BILL TO", { x: BILL_X, y: billY, size: 7, font: bold, color: SOFT });
  billY -= 13;
  page.drawText(truncate(order.customerName ?? "Customer", bold, 9.5, billWidth), {
    x: BILL_X,
    y: billY,
    size: 9.5,
    font: bold,
    color: INK,
  });
  billY -= 12;

  const billLines: string[] = [];
  if (order.customerEmail) billLines.push(order.customerEmail);
  if (order.customerPhone) billLines.push(order.customerPhone);
  for (const value of billLines) {
    page.drawText(truncate(value, regular, 8, billWidth), {
      x: BILL_X,
      y: billY,
      size: 8,
      font: regular,
      color: MUTED,
    });
    billY -= 10.5;
  }
  const address = formatAddress(order.shippingAddress);
  if (address) {
    for (const line of wrap(address, regular, 8, billWidth)) {
      page.drawText(line, { x: BILL_X, y: billY, size: 8, font: regular, color: MUTED });
      billY -= 10.5;
    }
  }

  y = Math.min(metaY, billY) - 12;

  // ---- Status --------------------------------------------------------------
  // Count units, not line entries — 2x of one product is 2 items, not 1.
  const totalUnits = order.lines.reduce((sum, line) => sum + (line.quantity ?? 0), 0);

  if (order.paymentStatus === "paid") {
    page.drawRectangle({
      x: MARGIN,
      y: y - 5,
      width: 54,
      height: 18,
      color: GREEN_BG,
      borderColor: GREEN,
      borderWidth: 0.7,
    });
    page.drawText("PAID", { x: MARGIN + 15, y, size: 8.5, font: bold, color: GREEN });
    page.drawText(
      sanitize(
        `${order.fulfillmentType === "pickup" ? "Pickup at shop" : "Delivery"}  |  ${totalUnits} item${
          totalUnits === 1 ? "" : "s"
        }`,
      ),
      { x: MARGIN + 66, y, size: 8, font: regular, color: MUTED },
    );
  }
  y -= 30;

  // ---- Line items ----------------------------------------------------------
  page.drawRectangle({
    x: MARGIN,
    y: y - 6,
    width: RIGHT - MARGIN,
    height: 20,
    color: CREAM,
  });
  page.drawText("DESCRIPTION", { x: MARGIN + CELL_PAD, y, size: 7, font: bold, color: SOFT });
  drawRight(page, "QTY", COL_QTY_RIGHT, y, bold, 7, SOFT);
  drawRight(page, "UNIT PRICE", COL_UNIT_RIGHT, y, bold, 7, SOFT);
  drawRight(page, "AMOUNT", COL_AMOUNT_RIGHT, y, bold, 7, SOFT);
  y -= 24;

  const descWidth = COL_QTY_RIGHT - (MARGIN + CELL_PAD) - 34;
  let computedSubtotal = 0;

  for (const line of order.lines) {
    const quantity = line.quantity ?? 0;
    const unit = line.unitAmount ?? 0;
    const lineTotal = line.totalAmount ?? line.subtotalAmount ?? unit * quantity;
    computedSubtotal += lineTotal;

    page.drawText(truncate(line.description, regular, 9, descWidth), {
      x: MARGIN + CELL_PAD,
      y,
      size: 9,
      font: regular,
      color: INK,
    });
    drawRight(page, String(quantity), COL_QTY_RIGHT, y, regular, 9, INK);
    drawRight(page, unit ? money(unit) : "-", COL_UNIT_RIGHT, y, regular, 9, MUTED);
    drawRight(page, money(lineTotal), COL_AMOUNT_RIGHT, y, regular, 9, INK);

    y -= 11;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: RIGHT, y },
      thickness: 0.5,
      color: HAIRLINE,
    });
    y -= 15;
  }

  // ---- Totals --------------------------------------------------------------
  const subtotal = order.subtotalAmount ?? computedSubtotal;
  const shipping = order.shippingAmount ?? 0;
  const tax = order.taxAmount ?? 0;
  const total =
    order.totalAmount ??
    subtotal +
      shipping +
      tax -
      (order.discountPercent ? Math.round((subtotal * order.discountPercent) / 100) : 0);

  const rows: Array<{ label: string; value: string; size: number; font: PDFFont }> = [
    { label: "Subtotal", value: money(subtotal), size: 9, font: regular },
  ];
  // Counter discount: subtotal is the list price, so show what came off it or
  // the totals will not add up on the printed receipt.
  const discount = order.discountPercent
    ? Math.round((subtotal * order.discountPercent) / 100)
    : 0;
  if (discount > 0) {
    rows.push({
      label: `Discount ${order.discountPercent}%`,
      value: `-${money(discount)}`,
      size: 9,
      font: regular,
    });
  }
  if (shipping > 0) {
    rows.push({ label: "Shipping", value: money(shipping), size: 9, font: regular });
  }
  if (isSstEnabled()) {
    rows.push({ label: "SST", value: money(tax), size: 9, font: regular });
  }
  const totalRow = { label: "TOTAL PAID", value: money(total), size: 12, font: bold };

  // Derive the label column from the widest rendered value so the label can never
  // collide with the amount — this is what broke the previous layout.
  const widestValue = Math.max(
    ...[...rows, totalRow].map((row) => row.font.widthOfTextAtSize(row.value, row.size)),
  );
  const labelRight = COL_AMOUNT_RIGHT - widestValue - 18;

  y -= 4;
  for (const row of rows) {
    drawRight(page, row.label, labelRight, y, regular, row.size, MUTED);
    drawRight(page, row.value, COL_AMOUNT_RIGHT, y, row.font, row.size, INK);
    y -= 14;
  }

  y -= 2;
  page.drawLine({
    start: { x: labelRight - 58, y: y + 7 },
    end: { x: COL_AMOUNT_RIGHT, y: y + 7 },
    thickness: 0.8,
    color: INK,
  });
  y -= 12;

  drawRight(page, totalRow.label, labelRight, y + 1, bold, 10, INK);
  drawRight(page, totalRow.value, COL_AMOUNT_RIGHT, y, totalRow.font, totalRow.size, INK);
  y -= 18;

  if (isSstEnabled() && process.env.RECEIPT_SST_NUMBER) {
    drawRight(
      page,
      `SST Reg. No: ${process.env.RECEIPT_SST_NUMBER}`,
      COL_AMOUNT_RIGHT,
      y,
      regular,
      7.5,
      MUTED,
    );
    y -= 14;
  }

  // ---- Summary strip -------------------------------------------------------
  // An A4 receipt for a handful of items leaves a large void between the totals
  // and the footer; this block closes the document off deliberately.
  y -= 26;
  const stripHeight = 62;
  page.drawRectangle({
    x: MARGIN,
    y: y - stripHeight,
    width: RIGHT - MARGIN,
    height: stripHeight,
    color: CREAM,
  });

  type StripLine = { text: string; url?: string; color?: ReturnType<typeof rgb> };

  const stripColumns: Array<[string, StripLine[]]> = [
    [
      "Payment",
      [
        { text: "Paid in full online" },
        {
          text: order.paymentIntentId ? `Ref: ${order.paymentIntentId}` : issuedText,
        },
      ],
    ],
    [
      order.fulfillmentType === "pickup" ? "Collection" : "Delivery",
      order.fulfillmentType === "pickup"
        ? [{ text: "Collect at our shop." }, { text: "We'll notify you when ready." }]
        : [{ text: "We're preparing your order." }, { text: "Tracking follows once shipped." }],
    ],
    [
      "Need help?",
      [
        { text: siteInfo.email, url: `mailto:${siteInfo.email}` },
        ...(whatsAppUrl
          ? [{ text: `WhatsApp ${siteInfo.phone}`, url: whatsAppUrl, color: GREEN }]
          : []),
      ],
    ],
  ];

  const stripWidth = (RIGHT - MARGIN) / 3;
  stripColumns.forEach(([label, lines], index) => {
    const x = MARGIN + 16 + index * stripWidth;
    let ty = y - 18;
    page.drawText(sanitize(label.toUpperCase()), {
      x,
      y: ty,
      size: 7,
      font: bold,
      color: SOFT,
    });
    ty -= 13;
    for (const line of lines) {
      const text = truncate(line.text, regular, 8, stripWidth - 24);
      if (line.url) {
        drawLinkedText(text, x, ty, regular, 8, line.color ?? MUTED, line.url);
      } else {
        page.drawText(text, { x, y: ty, size: 8, font: regular, color: MUTED });
      }
      ty -= 11;
    }
  });

  // ---- Footer (pinned to the bottom) ---------------------------------------
  const footerY = MARGIN + 40;
  page.drawLine({
    start: { x: MARGIN, y: footerY + 24 },
    end: { x: RIGHT, y: footerY + 24 },
    thickness: 0.5,
    color: LINE,
  });
  page.drawText("Thank you for your purchase.", {
    x: MARGIN,
    y: footerY + 11,
    size: 8.5,
    font: bold,
    color: INK,
  });
  page.drawText(
    sanitize(
      `Computer-generated receipt; valid without a signature. Questions? ${siteInfo.email}`,
    ),
    { x: MARGIN, y: footerY, size: 7, font: regular, color: MUTED },
  );
  page.drawText(sanitize(siteInfo.company), {
    x: MARGIN,
    y: footerY - 10,
    size: 7,
    font: regular,
    color: MUTED,
  });
  drawRight(page, getReceiptNumber(order), RIGHT, footerY, regular, 7, SOFT);

  // Attach every collected link region in one go.
  if (annotations.length > 0) {
    page.node.set(PDFName.of("Annots"), pdf.context.obj(annotations));
  }

  return pdf.save();
}

export function getReceiptFilename(order: StoredOrder) {
  return `Aerthera-Receipt-${getReceiptNumber(order)}.pdf`;
}
