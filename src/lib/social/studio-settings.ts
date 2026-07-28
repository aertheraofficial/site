import "server-only";

import { isGeminiImageConfigured, getGeminiImageModel } from "@/lib/social/gemini-image";
import { getKimiModel, isKimiConfigured } from "@/lib/social/kimi";
import { getSupabaseAdmin, isSupabaseOrderStoreConfigured } from "@/lib/supabase-admin";

/**
 * Studio preferences.
 *
 * The medsoc `SettingsService` kept API keys — Gemini, Meta, TikTok, Threads —
 * as plaintext rows readable and writable through the admin API. That is not
 * ported. Secrets stay in environment variables here, which is where the rest of
 * this site already reads them from; putting them back in a table would create a
 * second source of truth and a plaintext secret store that any `social` user
 * could read.
 *
 * What is left is the part that genuinely belongs to the shop rather than the
 * deployment: defaults the composer starts from.
 */

const ALLOWED_KEYS = [
  "default_niche",
  "default_tone",
  "default_language",
  "brand_voice_notes",
] as const;

export type StudioSettingKey = (typeof ALLOWED_KEYS)[number];

export type StudioSettings = Partial<Record<StudioSettingKey, string>>;

export function isStudioSettingKey(value: unknown): value is StudioSettingKey {
  return ALLOWED_KEYS.includes(value as StudioSettingKey);
}

export function isSettingsConfigured() {
  return isSupabaseOrderStoreConfigured();
}

export async function readStudioSettings(): Promise<StudioSettings> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("studio_settings").select("key, value");

  if (error) {
    throw new Error(`Unable to read settings: ${error.message}`);
  }

  const settings: StudioSettings = {};
  for (const row of (data ?? []) as Array<{ key: string; value: string | null }>) {
    if (isStudioSettingKey(row.key) && row.value != null) {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

export async function saveStudioSettings(values: StudioSettings) {
  const supabase = getSupabaseAdmin();
  const rows = Object.entries(values)
    .filter(([key]) => isStudioSettingKey(key))
    .map(([key, value]) => ({
      key,
      value: value ?? null,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("studio_settings")
    .upsert(rows, { onConflict: "key" });

  if (error) {
    throw new Error(`Unable to save settings: ${error.message}`);
  }
}

export type ConnectionStatus = {
  label: string;
  envVar: string;
  connected: boolean;
  detail: string;
};

/**
 * Read-only view of what is wired up, so staff can see why a button is missing
 * without needing shell access — and without the page ever showing a key.
 */
export function getConnectionStatuses(): ConnectionStatus[] {
  return [
    {
      label: "Kimi — captions and art direction",
      envVar: "MOONSHOT_API_KEY",
      connected: isKimiConfigured(),
      detail: isKimiConfigured() ? `Model: ${getKimiModel()}` : "Not connected.",
    },
    {
      label: "Gemini — scene images",
      envVar: "GEMINI_API_KEY",
      connected: isGeminiImageConfigured(),
      detail: isGeminiImageConfigured()
        ? `Model: ${getGeminiImageModel()}`
        : "Not connected.",
    },
    {
      label: "Supabase — posts, links and analytics",
      envVar: "SUPABASE_SERVICE_ROLE_KEY",
      connected: isSupabaseOrderStoreConfigured(),
      detail: isSupabaseOrderStoreConfigured() ? "Connected." : "Not connected.",
    },
  ];
}
