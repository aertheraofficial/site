/**
 * Telling "the migration has not been run" apart from a real fault.
 *
 * Supabase answers a query against a table that does not exist with a normal
 * error, so without this every Studio screen would show the same unhelpful
 * crash whether the cause was a missing table or a broken key. The tables are
 * new, so this will be the common case until the SQL below has been applied.
 */

export const STUDIO_MIGRATION_FILE = "supabase/add_social_studio.sql";

export function isMissingStudioTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /could not find the table/i.test(message) ||
    /schema cache/i.test(message) ||
    /relation .* does not exist/i.test(message)
  );
}
