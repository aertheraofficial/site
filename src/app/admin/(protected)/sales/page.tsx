import Link from "next/link";
import {
  markOrderPaidAction,
  saveReconciliationNotesAction,
  saveStatementLinesAction,
  saveStockCountAction,
  uploadStatementAction,
} from "@/app/admin/sales-actions";
import { formatShopDate, shopDayKey } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { readOrders } from "@/lib/orders";
import {
  ALL_LOCATIONS,
  ONLINE_LOCATION,
  getLocationName,
  getProductsWithStockAtLocation,
  getQuantitiesForSlugs,
  isLocationId,
} from "@/lib/product-stock";
import {
  PAYMENT_METHODS,
  buildStockRows,
  resolvePaymentMethod,
  summariseMoney,
} from "@/lib/reconciliation";
import { isPaidOrder } from "@/lib/sales-analytics";
import { getReconciliation, getStatementUrls } from "@/lib/reconciliation-store";
import { describeStatementVision } from "@/lib/statement-vision";
import { requirePermission } from "@/lib/staff-auth";

type SalesPageProps = {
  searchParams: Promise<{
    date?: string;
    location?: string;
    error?: string;
    warning?: string;
    saved?: string;
    read?: string;
  }>;
};

const CARD = "rounded-[1.75rem] border border-black/8 bg-white p-6";
const INPUT =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#201d17] outline-none transition focus:border-[#a07850] focus:ring-2 focus:ring-[#a07850]/20";
const BUTTON =
  "inline-flex h-10 items-center justify-center rounded-full bg-[#201d17] px-5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#2f2a22]";

function yesterdayKey() {
  return shopDayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={CARD}>
      <h2 className="font-display text-[1.15rem] leading-none tracking-[-0.02em] text-[#201d17]">
        {title}
      </h2>
      {hint ? <p className="mt-1.5 text-[0.75rem] leading-5 text-[#8d7a5c]">{hint}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function DailyCashUpPage({ searchParams }: SalesPageProps) {
  await requirePermission("sales");
  const params = await searchParams;

  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "")
    ? (params.date as string)
    : yesterdayKey();
  const location = isLocationId(params.location) ? params.location : ONLINE_LOCATION;

  const [allOrders, products, record] = await Promise.all([
    readOrders(),
    getProductsWithStockAtLocation(location),
    getReconciliation(date, location),
  ]);

  const onDate = allOrders.filter(
    (order) =>
      shopDayKey(order.createdAt) === date &&
      (order.location ?? ONLINE_LOCATION) === location,
  );
  const paid = onDate.filter(isPaidOrder);
  const money = summariseMoney(paid);

  // Manual QR carts that were never confirmed — the reason this page exists.
  const awaitingConfirmation = onDate.filter(
    (order) => order.paymentStatus === "pending" && order.checkoutStatus === "open",
  );

  const names = new Map(products.map((product) => [product.slug, product.name]));
  const soldSlugs = [
    ...new Set(paid.flatMap((order) => order.lines.map((line) => line.slug).filter(Boolean))),
  ] as string[];
  const quantities = await getQuantitiesForSlugs(soldSlugs, location);
  const freshStockRows = buildStockRows(paid, quantities, names);

  // Saved counts win, so a half-finished cash-up survives a reload.
  const savedCounts = new Map(record?.stockCounts.map((row) => [row.slug, row]) ?? []);
  const stockRows = freshStockRows.map((row) => ({
    ...row,
    counted: savedCounts.get(row.slug)?.counted ?? null,
  }));

  const statementLines = record?.statementLines ?? [];
  const statementAmount = statementLines.reduce((sum, line) => sum + line.amount, 0);
  const variance = statementAmount - money.expectedBankAmount;
  const hasStatement = statementLines.length > 0;

  const imageUrls = await getStatementUrls(record?.statementImagePaths ?? []);
  const visionProvider = describeStatementVision();

  const buildHref = (next: { date?: string; location?: string }) =>
    `/admin/sales?date=${next.date ?? date}&location=${next.location ?? location}`;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-[#8d7a5c]">
          Overview
        </p>
        <h1 className="font-display text-[2.1rem] leading-none tracking-[-0.04em] text-[#201d17]">
          Daily Cash-up
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-[#5d574f]">
          Match one day against reality: the money that should have reached the bank
          against the statement, and the stock the system expects against what is on
          the shelf.
        </p>
      </div>

      {params.error ? (
        <p className="rounded-[1.25rem] border border-[#eec4c1] bg-[#fdf1f0] px-4 py-3 text-sm text-[#9b3d32]">
          {params.error}
        </p>
      ) : null}
      {params.warning ? (
        <p className="rounded-[1.25rem] border border-[#e7d3a8] bg-[#fbf4e6] px-4 py-3 text-sm text-[#8b5e1d]">
          {params.warning}
        </p>
      ) : null}
      {params.saved || params.read ? (
        <p className="rounded-[1.25rem] border border-[#8cc8a4] bg-[#e9f7ee] px-4 py-3 text-sm text-[#256542]">
          {params.read ? "Statement read — check every row before saving." : "Saved."}
        </p>
      ) : null}

      {/* Day + till picker */}
      <div className="flex flex-col gap-4 rounded-[1.5rem] border border-black/8 bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
        <form className="flex items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c]">
              Business date
            </span>
            <input type="date" name="date" defaultValue={date} className={INPUT} />
          </label>
          <input type="hidden" name="location" value={location} />
          <button type="submit" className={BUTTON}>
            Go
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {ALL_LOCATIONS.map((entry) => (
            <Link
              key={entry.id}
              href={buildHref({ location: entry.id })}
              className={`inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-[0.7rem] font-semibold uppercase tracking-[0.14em] transition ${
                entry.id === location
                  ? "bg-[#201d17] text-white"
                  : "border border-black/10 bg-white text-[#201d17] hover:bg-[#f7f2ea]"
              }`}
            >
              {entry.name}
            </Link>
          ))}
        </div>
      </div>

      <p className="text-sm text-[#5d574f]">
        Showing <strong className="text-[#201d17]">{formatShopDate(date)}</strong> at{" "}
        <strong className="text-[#201d17]">{getLocationName(location)}</strong> —{" "}
        {paid.length} paid {paid.length === 1 ? "order" : "orders"}.
      </p>

      {/* --- Money ------------------------------------------------------- */}
      <Section
        title="Money taken"
        hint="Cash stays in the drawer and will never appear on a statement. Only the methods marked as banked should show up there."
      >
        {money.breakdown.length === 0 ? (
          <p className="text-sm text-[#8d7a5c]">No paid orders on this day.</p>
        ) : (
          // Scrolls rather than squeezing: at phone width the squeezed version
          // pushed "RM 26.00" hard against "No — in drawer".
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="text-left text-[0.68rem] uppercase tracking-[0.14em] text-[#8d7a5c]">
                  <th className="whitespace-nowrap pb-2 pr-4 font-semibold">Method</th>
                  <th className="whitespace-nowrap pb-2 pr-4 font-semibold">Orders</th>
                  <th className="whitespace-nowrap pb-2 pr-6 text-right font-semibold">
                    Amount
                  </th>
                  <th className="whitespace-nowrap pb-2 text-right font-semibold">Banked?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {money.breakdown.map((entry) => (
                  <tr key={entry.method}>
                    <td className="py-2.5 pr-4 text-[#201d17]">{entry.label}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-[#5d574f]">{entry.orders}</td>
                    <td className="whitespace-nowrap py-2.5 pr-6 text-right tabular-nums font-medium text-[#201d17]">
                      {formatMoney(entry.amount / 100)}
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-right text-[0.78rem]">
                      {entry.settlesToBank === true ? (
                        <span className="text-[#256542]">Yes</span>
                      ) : entry.settlesToBank === false ? (
                        <span className="text-[#8d7a5c]">No — in drawer</span>
                      ) : (
                        <span className="text-[#8b5e1d]">Unclassified</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black/10">
                  <td colSpan={2} className="whitespace-nowrap pt-3 pr-4 font-semibold text-[#201d17]">
                    Should reach the bank
                  </td>
                  <td className="whitespace-nowrap pt-3 pr-6 text-right tabular-nums font-semibold text-[#201d17]">
                    {formatMoney(money.expectedBankAmount / 100)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {money.unclassifiedAmount > 0 ? (
          <p className="mt-4 rounded-xl border border-[#e7d3a8] bg-[#fbf4e6] px-3 py-2 text-[0.78rem] text-[#8b5e1d]">
            {formatMoney(money.unclassifiedAmount / 100)} could not be classified by payment
            method. It is counted in neither total — open those orders and set the method.
          </p>
        ) : null}
      </Section>

      {/* --- Statement --------------------------------------------------- */}
      <Section
        title="Bank statement"
        hint={
          visionProvider
            ? `Read by ${visionProvider}. Always check the rows — a misread amount would confirm the wrong order.`
            : "No vision model configured (set GEMINI_API_KEY), so rows have to be typed in by hand."
        }
      >
        <form action={uploadStatementAction} encType="multipart/form-data" className="space-y-3">
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="location" value={location} />
          <input
            type="file"
            name="statement"
            accept="image/*"
            multiple
            required
            className={INPUT}
          />
          <button type="submit" className={BUTTON}>
            Upload &amp; read
          </button>
        </form>

        {imageUrls.length > 0 ? (
          <p className="mt-3 text-[0.75rem] text-[#8d7a5c]">
            {imageUrls.filter(Boolean).map((url, index) => (
              <a
                key={url}
                href={url as string}
                target="_blank"
                rel="noopener noreferrer"
                className="mr-3 underline hover:text-[#a85d1c]"
              >
                Screenshot {index + 1}
              </a>
            ))}
            <span>(links expire after 10 minutes)</span>
          </p>
        ) : null}

        <form action={saveStatementLinesAction} className="mt-6 space-y-3">
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="location" value={location} />

          {(hasStatement ? statementLines : [{ time: null, amount: 0, reference: null }]).map(
            (line, index) => (
              <div key={index} className="grid grid-cols-[5rem_1fr_8rem] gap-2">
                <input
                  name="lineTime"
                  defaultValue={line.time ?? ""}
                  placeholder="14:32"
                  className={INPUT}
                />
                <input
                  name="lineReference"
                  defaultValue={line.reference ?? ""}
                  placeholder="Reference / sender"
                  className={INPUT}
                />
                <input
                  name="lineAmount"
                  defaultValue={line.amount ? (line.amount / 100).toFixed(2) : ""}
                  placeholder="0.00"
                  inputMode="decimal"
                  className={`${INPUT} text-right tabular-nums`}
                />
              </div>
            ),
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/6 pt-4">
            <div className="text-sm">
              <p className="text-[#5d574f]">
                Statement total:{" "}
                <strong className="tabular-nums text-[#201d17]">
                  {formatMoney(statementAmount / 100)}
                </strong>
              </p>
              <p
                className={`mt-1 font-semibold tabular-nums ${
                  !hasStatement
                    ? "text-[#8d7a5c]"
                    : variance === 0
                      ? "text-[#256542]"
                      : "text-[#9b3d32]"
                }`}
              >
                {!hasStatement
                  ? "No statement rows yet"
                  : variance === 0
                    ? "✓ Tallies with recorded sales"
                    : `${variance > 0 ? "Over" : "Short"} by ${formatMoney(
                        Math.abs(variance) / 100,
                      )}`}
              </p>
            </div>
            <button type="submit" className={BUTTON}>
              Save statement
            </button>
          </div>
          <p className="text-[0.72rem] text-[#8d7a5c]">
            Clear an amount to delete that row. Blank rows are dropped on save.
          </p>
        </form>
      </Section>

      {/* --- Unconfirmed QR ---------------------------------------------- */}
      {awaitingConfirmation.length > 0 ? (
        <Section
          title="Waiting for payment confirmation"
          hint="Manual DuitNow QR carts. Confirm one only when you can see its exact amount on the statement — this marks it paid, decrements stock and emails the receipt."
        >
          <ul className="divide-y divide-black/6">
            {awaitingConfirmation.map((order) => (
              <li
                key={order.sessionId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[0.88rem] font-medium text-[#201d17]">
                    {order.customerName?.trim() || order.customerEmail || "Walk-in"}
                  </p>
                  <p className="text-[0.72rem] text-[#8d7a5c]">
                    {order.sessionId} ·{" "}
                    {PAYMENT_METHODS[resolvePaymentMethod(order) ?? "other"].label}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="tabular-nums text-[0.95rem] font-semibold text-[#201d17]">
                    {formatMoney((order.totalAmount ?? 0) / 100)}
                  </span>
                  <form action={markOrderPaidAction}>
                    <input type="hidden" name="date" value={date} />
                    <input type="hidden" name="location" value={location} />
                    <input type="hidden" name="sessionId" value={order.sessionId} />
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center rounded-full border border-[#8cc8a4] bg-[#e9f7ee] px-4 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#256542] transition hover:bg-[#dcf0e3]"
                    >
                      Mark paid
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* --- Stock ------------------------------------------------------- */}
      <Section
        title="Stock count"
        hint="“On hand” is what the system believes right now, so count the shelf as it is now. A negative variance means stock is short — an unrecorded sale, a miscount, or shrinkage."
      >
        {stockRows.length === 0 ? (
          <p className="text-sm text-[#8d7a5c]">Nothing was sold on this day.</p>
        ) : (
          <form action={saveStockCountAction} className="space-y-3">
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="location" value={location} />

            <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-left text-[0.68rem] uppercase tracking-[0.14em] text-[#8d7a5c]">
                  <th className="pb-2 pr-4 font-semibold">Product</th>
                  <th className="whitespace-nowrap pb-2 pr-4 text-right font-semibold">Sold</th>
                  <th className="whitespace-nowrap pb-2 pr-4 text-right font-semibold">
                    On hand
                  </th>
                  <th className="whitespace-nowrap pb-2 pr-4 text-right font-semibold">
                    Counted
                  </th>
                  <th className="whitespace-nowrap pb-2 text-right font-semibold">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {stockRows.map((row) => {
                  const rowVariance =
                    row.counted !== null && row.expectedOnHand !== null
                      ? row.counted - row.expectedOnHand
                      : null;
                  return (
                    <tr key={row.slug}>
                      <td className="min-w-[12rem] py-2 pr-4 text-[#201d17]">
                        {row.name}
                        <input type="hidden" name="countSlug" value={row.slug} />
                        <input type="hidden" name="countName" value={row.name} />
                        <input type="hidden" name="countSold" value={row.sold} />
                        <input
                          type="hidden"
                          name="countExpected"
                          value={row.expectedOnHand ?? ""}
                        />
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-[#5d574f]">
                        {row.sold}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-[#5d574f]">
                        {row.expectedOnHand ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <input
                          name="countCounted"
                          type="number"
                          min={0}
                          defaultValue={row.counted ?? ""}
                          placeholder="—"
                          className={`${INPUT} w-20 text-right tabular-nums`}
                        />
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums font-semibold ${
                          rowVariance === null
                            ? "text-[#8d7a5c]"
                            : rowVariance === 0
                              ? "text-[#256542]"
                              : "text-[#9b3d32]"
                        }`}
                      >
                        {rowVariance === null
                          ? "—"
                          : rowVariance > 0
                            ? `+${rowVariance}`
                            : rowVariance}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className={BUTTON}>
                Save count
              </button>
            </div>
          </form>
        )}
      </Section>

      {/* --- Notes ------------------------------------------------------- */}
      <Section title="Notes" hint="Why a variance is acceptable, who was on shift, anything worth remembering.">
        <form action={saveReconciliationNotesAction} className="space-y-3">
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="location" value={location} />
          <textarea
            name="notes"
            rows={3}
            defaultValue={record?.notes ?? ""}
            className={INPUT}
            placeholder="e.g. RM20 short — customer paid part in cash, receipt reprinted."
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.72rem] text-[#8d7a5c]">
              {record
                ? `Last saved by ${record.createdBy ?? "unknown"} · status: ${record.status}`
                : "Not started yet."}
            </p>
            <button type="submit" className={BUTTON}>
              Save notes
            </button>
          </div>
        </form>
      </Section>
    </div>
  );
}
