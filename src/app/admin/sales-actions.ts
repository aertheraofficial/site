"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { shopDayKey } from "@/lib/datetime";
import {
  getOrderBySessionId,
  readOrders,
  upsertOrder,
  type StoredOrder,
} from "@/lib/orders";
import { decrementStockForOrderLines, isLocationId } from "@/lib/product-stock";
import { sendReceiptEmail } from "@/lib/receipt-email";
import {
  matchStatementLines,
  summariseMoney,
  type StatementLine,
  type StockCountRow,
} from "@/lib/reconciliation";
import { isPaidOrder } from "@/lib/sales-analytics";
import {
  getReconciliation,
  saveReconciliation,
  uploadStatementImage,
} from "@/lib/reconciliation-store";
import { extractStatement } from "@/lib/statement-vision";
import { requirePermission } from "@/lib/staff-auth";

/**
 * Actions for the daily cash-up.
 *
 * Kept out of `admin/actions.ts` — that module is already very large, and these
 * are the only actions that move money state, which is easier to audit together.
 */

function salesPath(date: string, location: string, extra?: Record<string, string>) {
  const params = new URLSearchParams({ date, location, ...extra });
  return `/admin/sales?${params.toString()}`;
}

function requiredField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readDateAndLocation(formData: FormData) {
  const date = requiredField(formData, "date");
  const location = requiredField(formData, "location");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isLocationId(location)) {
    redirect("/admin/sales?error=bad-request");
  }

  return { date, location };
}

async function ordersFor(date: string, location: string) {
  const all = await readOrders();
  return all.filter(
    (order) =>
      shopDayKey(order.createdAt) === date && (order.location ?? "online") === location,
  );
}

function actorName(actor: Awaited<ReturnType<typeof requirePermission>>) {
  return actor.type === "admin" ? actor.name : actor.staff.fullName;
}

/** Uploads the screenshots and asks the model to read them. Never auto-applies. */
export async function uploadStatementAction(formData: FormData) {
  const actor = await requirePermission("sales", "/admin/sales");
  const { date, location } = readDateAndLocation(formData);

  const files = formData
    .getAll("statement")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    redirect(salesPath(date, location, { error: "Choose at least one screenshot." }));
  }

  let paths: string[] = [];
  let lines: StatementLine[] = [];
  let warning: string | null = null;

  try {
    const existing = await getReconciliation(date, location);

    paths = [
      ...(existing?.statementImagePaths ?? []),
      ...(await Promise.all(files.map((file) => uploadStatementImage(file, date, location)))),
    ];

    const images = await Promise.all(
      files.map(async (file) => ({
        bytes: new Uint8Array(await file.arrayBuffer()),
        mediaType: file.type || "image/png",
      })),
    );

    const extraction = await extractStatement(images);
    // Match against paid orders only — an unpaid cart has not sent money.
    const paid = (await ordersFor(date, location)).filter(isPaidOrder);
    lines = matchStatementLines(
      [...(existing?.statementLines ?? []), ...extraction.lines],
      paid,
    );

    if (extraction.unreadable) {
      warning = "The model flagged the image as hard to read — check every row.";
    } else if (extraction.notes) {
      warning = extraction.notes;
    }
  } catch (error) {
    redirect(
      salesPath(date, location, {
        error: error instanceof Error ? error.message : "Could not read the statement.",
      }),
    );
  }

  await saveReconciliation(date, location, {
    statementImagePaths: paths,
    statementLines: lines,
    statementAmount: lines.reduce((sum, line) => sum + line.amount, 0),
    createdBy: actorName(actor),
  });

  revalidatePath("/admin/sales");
  redirect(salesPath(date, location, warning ? { warning } : { read: "1" }));
}

/**
 * Saves the statement rows after a human has corrected them, and recomputes the
 * money variance. This is the point where the AI's reading becomes a record.
 */
export async function saveStatementLinesAction(formData: FormData) {
  const actor = await requirePermission("sales", "/admin/sales");
  const { date, location } = readDateAndLocation(formData);

  const amounts = formData.getAll("lineAmount").map(String);
  const references = formData.getAll("lineReference").map(String);
  const times = formData.getAll("lineTime").map(String);

  const lines: StatementLine[] = amounts
    .map((amount, index) => {
      const ringgit = Number.parseFloat(amount.replace(/[^\d.-]/g, ""));
      return {
        time: times[index]?.trim() || null,
        amount: Number.isFinite(ringgit) ? Math.round(ringgit * 100) : 0,
        reference: references[index]?.trim() || null,
        matchedSessionId: null,
      };
    })
    // A row blanked out in the form is a deletion, not a zero.
    .filter((line) => line.amount > 0);

  const orders = await ordersFor(date, location);
  const paid = orders.filter(isPaidOrder);
  const matched = matchStatementLines(lines, paid);

  const money = summariseMoney(paid);
  const statementAmount = matched.reduce((sum, line) => sum + line.amount, 0);
  const variance = statementAmount - money.expectedBankAmount;

  await saveReconciliation(date, location, {
    statementLines: matched,
    statementAmount,
    expectedBankAmount: money.expectedBankAmount,
    moneyVariance: variance,
    status: variance === 0 ? "balanced" : "variance",
    createdBy: actorName(actor),
  });

  revalidatePath("/admin/sales");
  redirect(salesPath(date, location, { saved: "1" }));
}

/** Records the physical count and the resulting shortage or overage. */
export async function saveStockCountAction(formData: FormData) {
  const actor = await requirePermission("sales", "/admin/sales");
  const { date, location } = readDateAndLocation(formData);

  const slugs = formData.getAll("countSlug").map(String);
  const names = formData.getAll("countName").map(String);
  const sold = formData.getAll("countSold").map(String);
  const expected = formData.getAll("countExpected").map(String);
  const counted = formData.getAll("countCounted").map(String);

  const rows: StockCountRow[] = slugs.map((slug, index) => {
    const expectedOnHand = expected[index] === "" ? null : Number(expected[index]);
    const countedValue = counted[index]?.trim() === "" ? null : Number(counted[index]);
    const bothKnown =
      countedValue !== null &&
      Number.isFinite(countedValue) &&
      expectedOnHand !== null &&
      Number.isFinite(expectedOnHand);

    return {
      slug,
      name: names[index] ?? slug,
      sold: Number(sold[index]) || 0,
      expectedOnHand: Number.isFinite(expectedOnHand as number) ? expectedOnHand : null,
      counted: countedValue !== null && Number.isFinite(countedValue) ? countedValue : null,
      variance: bothKnown ? (countedValue as number) - (expectedOnHand as number) : null,
    };
  });

  const counts = rows.filter((row) => row.variance !== null);
  const stockVarianceUnits = counts.length
    ? counts.reduce((sum, row) => sum + (row.variance ?? 0), 0)
    : null;

  await saveReconciliation(date, location, {
    stockCounts: rows,
    stockVarianceUnits,
    createdBy: actorName(actor),
  });

  revalidatePath("/admin/sales");
  redirect(salesPath(date, location, { saved: "1" }));
}

/**
 * Confirms a manual DuitNow QR order once its payment is seen on the statement.
 *
 * This is the control the checkout route always assumed existed ("customer pays
 * by scanning, and an admin confirms afterwards") but which was never built —
 * which is why QR orders sat at `pending` forever. Stock decrement and the
 * receipt run here for the same reason they run in the ToyyibPay callback, and
 * are guarded so a double click cannot decrement twice.
 */
export async function markOrderPaidAction(formData: FormData) {
  await requirePermission("sales", "/admin/sales");
  const { date, location } = readDateAndLocation(formData);
  const sessionId = requiredField(formData, "sessionId");

  const order = await getOrderBySessionId(sessionId);
  if (!order) {
    redirect(salesPath(date, location, { error: "That order no longer exists." }));
  }

  if (order.paymentStatus === "paid") {
    redirect(salesPath(date, location, { saved: "1" }));
  }

  const updated: StoredOrder = {
    ...order,
    paymentStatus: "paid",
    checkoutStatus: "complete",
    paymentMethod: order.paymentMethod ?? "duitnow-qr",
    internalNotes: [order.internalNotes, `Payment confirmed in the ${date} cash-up.`]
      .filter(Boolean)
      .join(" "),
    updatedAt: new Date().toISOString(),
  };

  await upsertOrder(updated, { preserveAdminFields: true });
  await decrementStockForOrderLines(
    order.lines.map((line) => ({ slug: line.slug, quantity: line.quantity })),
    order.location ?? "online",
  );
  await sendReceiptEmail(updated);

  revalidatePath("/admin/sales");
  revalidatePath("/admin/orders");
  redirect(salesPath(date, location, { saved: "1" }));
}

/** Free-text note on the day, e.g. why a variance is acceptable. */
export async function saveReconciliationNotesAction(formData: FormData) {
  const actor = await requirePermission("sales", "/admin/sales");
  const { date, location } = readDateAndLocation(formData);

  await saveReconciliation(date, location, {
    notes: requiredField(formData, "notes").trim() || null,
    createdBy: actorName(actor),
  });

  revalidatePath("/admin/sales");
  redirect(salesPath(date, location, { saved: "1" }));
}
