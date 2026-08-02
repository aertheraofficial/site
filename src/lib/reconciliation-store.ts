import {
  type DailyReconciliation,
  type ReconciliationStatus,
  type StatementLine,
  type StockCountRow,
} from "@/lib/reconciliation";
import { getSupabaseAdmin, isSupabaseOrderStoreConfigured } from "@/lib/supabase-admin";

/**
 * Persistence for the daily cash-up.
 *
 * Statement screenshots go in a PRIVATE bucket and are read back through short
 * signed URLs — unlike product images, which are public by design. A bank
 * statement leaks transaction amounts, counterparty names and account tails, so
 * it must never sit behind a guessable public URL.
 */

const BUCKET = "bank-statements";
const SIGNED_URL_TTL_SECONDS = 60 * 10;

type ReconciliationRow = {
  id: string;
  business_date: string;
  location: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  expected_bank_amount: number | null;
  statement_amount: number | null;
  money_variance: number | null;
  statement_image_paths: string[] | null;
  statement_lines: StatementLine[] | null;
  stock_counts: StockCountRow[] | null;
  stock_variance_units: number | null;
  status: ReconciliationStatus;
  notes: string | null;
};

function fromRow(row: ReconciliationRow): DailyReconciliation {
  return {
    id: row.id,
    businessDate: row.business_date,
    location: row.location,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    expectedBankAmount: row.expected_bank_amount,
    statementAmount: row.statement_amount,
    moneyVariance: row.money_variance,
    statementImagePaths: row.statement_image_paths ?? [],
    statementLines: row.statement_lines ?? [],
    stockCounts: row.stock_counts ?? [],
    stockVarianceUnits: row.stock_variance_units,
    status: row.status,
    notes: row.notes,
  };
}

/** Created on first use so setting the feature up needs no dashboard clicking. */
async function ensureBucket() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;

  const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
  // A parallel request may have won the race; only a real failure matters.
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`Unable to create the ${BUCKET} bucket: ${error.message}`);
  }
}

export async function uploadStatementImage(
  file: File,
  businessDate: string,
  location: string,
): Promise<string> {
  if (!isSupabaseOrderStoreConfigured()) {
    throw new Error("Supabase is not configured — cannot upload statements.");
  }

  await ensureBucket();

  const supabase = getSupabaseAdmin();
  const extension = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${businessDate}/${location}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "image/png" });

  if (error) {
    throw new Error(`Unable to upload statement: ${error.message}`);
  }

  return path;
}

/** Short-lived links for the review screen. Null for anything that has gone missing. */
export async function getStatementUrls(paths: string[]): Promise<Array<string | null>> {
  if (paths.length === 0 || !isSupabaseOrderStoreConfigured()) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return paths.map(() => null);
  return data.map((entry) => entry.signedUrl ?? null);
}

export async function getReconciliation(
  businessDate: string,
  location: string,
): Promise<DailyReconciliation | null> {
  if (!isSupabaseOrderStoreConfigured()) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("daily_reconciliations")
    .select("*")
    .eq("business_date", businessDate)
    .eq("location", location)
    .maybeSingle();

  if (error || !data) return null;
  return fromRow(data as ReconciliationRow);
}

export async function listReconciliations(limit = 30): Promise<DailyReconciliation[]> {
  if (!isSupabaseOrderStoreConfigured()) return [];

  const { data, error } = await getSupabaseAdmin()
    .from("daily_reconciliations")
    .select("*")
    .order("business_date", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as ReconciliationRow[]).map(fromRow);
}

export type ReconciliationPatch = Partial<
  Omit<DailyReconciliation, "id" | "businessDate" | "location" | "createdAt" | "updatedAt">
>;

/** Upsert keyed on (business date, location) — one cash-up per day per till. */
export async function saveReconciliation(
  businessDate: string,
  location: string,
  patch: ReconciliationPatch,
): Promise<DailyReconciliation> {
  if (!isSupabaseOrderStoreConfigured()) {
    throw new Error("Supabase is not configured — cannot save the cash-up.");
  }

  const existing = await getReconciliation(businessDate, location);
  const now = new Date().toISOString();

  const merged = {
    id: existing?.id ?? `REC-${businessDate}-${location}`,
    business_date: businessDate,
    location,
    created_at: existing?.createdAt ?? now,
    updated_at: now,
    created_by: patch.createdBy ?? existing?.createdBy ?? null,
    expected_bank_amount: patch.expectedBankAmount ?? existing?.expectedBankAmount ?? null,
    statement_amount: patch.statementAmount ?? existing?.statementAmount ?? null,
    money_variance: patch.moneyVariance ?? existing?.moneyVariance ?? null,
    statement_image_paths: patch.statementImagePaths ?? existing?.statementImagePaths ?? [],
    statement_lines: patch.statementLines ?? existing?.statementLines ?? [],
    stock_counts: patch.stockCounts ?? existing?.stockCounts ?? [],
    stock_variance_units: patch.stockVarianceUnits ?? existing?.stockVarianceUnits ?? null,
    status: patch.status ?? existing?.status ?? "draft",
    notes: patch.notes ?? existing?.notes ?? null,
  };

  const { data, error } = await getSupabaseAdmin()
    .from("daily_reconciliations")
    .upsert(merged, { onConflict: "business_date,location" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Unable to save the cash-up: ${error?.message ?? "no row returned"}`);
  }

  return fromRow(data as ReconciliationRow);
}
