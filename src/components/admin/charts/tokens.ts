/**
 * Chart tokens for the admin dashboard.
 *
 * Every chart here plots a single series, so magnitude is carried by bar length
 * or line position and colour carries no meaning beyond "this is data". That is
 * why there is one data hue rather than a categorical set: with no two hues to
 * tell apart there is no colour-vision failure mode to design around.
 *
 * CHART_INK was picked by running the palette validator against the white card
 * surface — the softer brand brown (#a07850) failed the chroma floor at 0.075
 * and read as grey when used as a fill.
 */
export const CHART_INK = "#a85d1c";

/** Area fill under the trend line. Same hue, low alpha — never a second colour. */
export const CHART_FILL = "rgba(168, 93, 28, 0.14)";

/** Recessive furniture: grid lines and axis rules sit behind the data. */
export const CHART_GRID = "#e7dccd";
export const CHART_TRACK = "#f2ece2";

/** Money comes in as sen; charts label in whole ringgit to keep axes short. */
export function formatShortMoney(minorUnits: number) {
  const ringgit = minorUnits / 100;
  if (Math.abs(ringgit) >= 1000) {
    return `RM${(ringgit / 1000).toFixed(ringgit % 1000 === 0 ? 0 : 1)}k`;
  }
  return `RM${Math.round(ringgit)}`;
}

/** "2026-08-01" -> "1 Aug" for compact axis and tooltip labels. */
export function formatDayLabel(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(date);
}
