/**
 * Every date the shop reads — admin screens, receipts, payslips — is a
 * Malaysian business date. These pages render on the server, so an
 * `Intl.DateTimeFormat` without an explicit `timeZone` silently formats in the
 * *server's* zone (UTC on Vercel). A sale rung up at 9pm in Kuala Lumpur then
 * prints as the previous day, which is wrong on a receipt and wrong in the
 * daily takings. Format through this module so the zone is never left to the
 * deployment environment.
 */

export const SHOP_TIME_ZONE = "Asia/Kuala_Lumpur";

const dateTime = new Intl.DateTimeFormat("en-MY", {
  timeZone: SHOP_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const dateOnly = new Intl.DateTimeFormat("en-MY", {
  timeZone: SHOP_TIME_ZONE,
  dateStyle: "medium",
});

const longDate = new Intl.DateTimeFormat("en-MY", {
  timeZone: SHOP_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const receiptDate = new Intl.DateTimeFormat("en-MY", {
  timeZone: SHOP_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeOnly = new Intl.DateTimeFormat("en-MY", {
  timeZone: SHOP_TIME_ZONE,
  timeStyle: "short",
});

/** `2026-07-28` in shop time — sortable, and safe to compare as a string. */
const isoDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TIME_ZONE,
  dateStyle: "short",
});

/** `2026-07` in shop time. */
const isoMonth = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
});

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Placeholder for a missing or unparseable timestamp. */
export const NO_DATE = "—";

/** "28 Jul 2026, 9:15 pm" */
export function formatShopDateTime(value: string | Date | null | undefined) {
  const date = value == null ? null : toDate(value);
  return date ? dateTime.format(date) : NO_DATE;
}

/** "28 Jul 2026" */
export function formatShopDate(value: string | Date | null | undefined) {
  const date = value == null ? null : toDate(value);
  return date ? dateOnly.format(date) : NO_DATE;
}

/** "28 July 2026" */
export function formatShopLongDate(value: string | Date | null | undefined) {
  const date = value == null ? null : toDate(value);
  return date ? longDate.format(date) : NO_DATE;
}

/** "28 Jul 2026" — the fixed-width form used on printed receipts. */
export function formatReceiptDate(value: string | Date | null | undefined) {
  const date = value == null ? null : toDate(value);
  return date ? receiptDate.format(date) : NO_DATE;
}

/** "9:15 pm" */
export function formatShopTime(value: string | Date | null | undefined) {
  const date = value == null ? null : toDate(value);
  return date ? timeOnly.format(date) : NO_DATE;
}

/** "2026-07-28" — for grouping "today's sales" by the day staff actually worked. */
export function shopDayKey(value: string | Date = new Date()) {
  const date = toDate(value);
  return date ? isoDay.format(date) : NO_DATE;
}

/** "2026-07" — for grouping by payroll/sales month. */
export function shopMonthKey(value: string | Date = new Date()) {
  const date = toDate(value);
  return date ? isoMonth.format(date) : NO_DATE;
}

/** "20260728" — the compact stamp receipt numbers are built from. */
export function shopDateStamp(value: string | Date = new Date()) {
  return shopDayKey(value).replaceAll("-", "");
}

/**
 * Today's calendar year and month *in Malaysia*, for defaulting form fields.
 * `new Date().getMonth()` reads the server clock, so on the 1st of the month
 * before 8am local the payroll form would default to the month just closed.
 */
export function shopYearMonth(value: string | Date = new Date()): {
  year: number;
  month: number;
} {
  const [year, month] = shopMonthKey(value).split("-");
  return { year: Number(year), month: Number(month) };
}
