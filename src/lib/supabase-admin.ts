import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseAdminClient: SupabaseClient | null = null;

export function isSupabaseOrderStoreConfigured() {
  return Boolean(
    process.env.SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase order store is not configured.");
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseAdminClient;
}
