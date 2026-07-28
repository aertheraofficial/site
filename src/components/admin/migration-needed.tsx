import { STUDIO_MIGRATION_FILE } from "@/lib/social/studio-errors";

/**
 * Shown when Supabase is connected but the Studio tables are not there yet.
 * Names the exact file to run, because "something went wrong" would send
 * someone reading logs for a one-line fix.
 */
export function MigrationNeeded() {
  return (
    <div className="rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-5 py-6 text-sm leading-7 text-[#8b5e1d]">
      <p className="font-semibold">One setup step left.</p>
      <p className="mt-2">
        Supabase is connected, but the Social Studio tables have not been created
        yet. Run <code className="mx-1">{STUDIO_MIGRATION_FILE}</code> against the
        database, then reload this page.
      </p>
    </div>
  );
}
