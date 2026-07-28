import type { Metadata } from "next";
import { MigrationNeeded } from "@/components/admin/migration-needed";
import { SubmitButton } from "@/components/admin/submit-button";
import { CAPTION_LANGUAGES, CAPTION_TONES } from "@/lib/social/caption-options";
import { isMissingStudioTable } from "@/lib/social/studio-errors";
import { requirePermission } from "@/lib/staff-auth";
import {
  getConnectionStatuses,
  isSettingsConfigured,
  readStudioSettings,
} from "@/lib/social/studio-settings";
import { saveSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Social Settings" };

type SettingsPageProps = {
  searchParams: Promise<{ saved?: string }>;
};

const inputClass =
  "mt-2 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white";
const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]";

export default async function SocialSettingsPage({ searchParams }: SettingsPageProps) {
  await requirePermission("social", "/admin/social/settings");
  const { saved } = await searchParams;

  const connections = getConnectionStatuses();

  // Connections come from the environment, so they are worth showing even when
  // the tables are missing — that is exactly when someone is setting this up.
  let settings: Awaited<ReturnType<typeof readStudioSettings>> = {};
  let tablesMissing = false;
  if (isSettingsConfigured()) {
    try {
      settings = await readStudioSettings();
    } catch (readError) {
      if (!isMissingStudioTable(readError)) throw readError;
      tablesMissing = true;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
          Settings
        </p>
        <h3 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
          Connections and defaults
        </h3>
      </div>

      {saved ? (
        <p className="rounded-[1.25rem] border border-[#8cc8a4] bg-[#e9f7ee] px-4 py-3 text-sm leading-6 text-[#256542]">
          Defaults saved.
        </p>
      ) : null}

      <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
          Connections
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5d574f]">
          Keys are set in the deployment environment, not here — this page can
          show you whether something is connected, but never the key itself.
        </p>

        <ul className="mt-5 space-y-3">
          {connections.map((connection) => (
            <li
              key={connection.envVar}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-black/8 bg-[#fcfaf6] p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#201d17]">
                  {connection.label}
                </p>
                <p className="mt-0.5 text-xs text-[#8d7a5c]">
                  <code>{connection.envVar}</code> · {connection.detail}
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.14em] ${
                  connection.connected
                    ? "border-[#8cc8a4] bg-[#e9f7ee] text-[#256542]"
                    : "border-[#d6c2a0] bg-[#f8f1e4] text-[#8b5e1d]"
                }`}
              >
                {connection.connected ? "Connected" : "Not set"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
          Composer defaults
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5d574f]">
          What the caption writer starts from when nobody chooses otherwise.
        </p>

        {!isSettingsConfigured() ? (
          <p className="mt-5 rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-4 py-3 text-sm leading-6 text-[#8b5e1d]">
            Supabase is not configured, so defaults cannot be saved yet.
          </p>
        ) : tablesMissing ? (
          <div className="mt-5">
            <MigrationNeeded />
          </div>
        ) : (
          <form action={saveSettingsAction} className="mt-5 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="settings-tone" className={labelClass}>
                  Default tone
                </label>
                <select
                  id="settings-tone"
                  name="default_tone"
                  defaultValue={settings.default_tone ?? "casual"}
                  className={inputClass}
                >
                  {CAPTION_TONES.map((tone) => (
                    <option key={tone} value={tone} className="capitalize">
                      {tone}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="settings-language" className={labelClass}>
                  Default language
                </label>
                <select
                  id="settings-language"
                  name="default_language"
                  defaultValue={settings.default_language ?? "English"}
                  className={inputClass}
                >
                  {CAPTION_LANGUAGES.map((language) => (
                    <option key={language} value={language}>
                      {language}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="settings-niche" className={labelClass}>
                Default niche
              </label>
              <input
                id="settings-niche"
                name="default_niche"
                type="text"
                defaultValue={settings.default_niche ?? ""}
                placeholder="e.g. wellness, home fragrance"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="settings-voice" className={labelClass}>
                Brand voice notes
              </label>
              <textarea
                id="settings-voice"
                name="brand_voice_notes"
                rows={4}
                defaultValue={settings.brand_voice_notes ?? ""}
                placeholder="Anything the writer should always keep in mind."
                className={inputClass}
              />
            </div>

            <SubmitButton pendingLabel="Saving…">Save Defaults</SubmitButton>
          </form>
        )}
      </section>
    </div>
  );
}
