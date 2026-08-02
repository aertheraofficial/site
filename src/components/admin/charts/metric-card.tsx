import { Sparkline } from "./sparkline";

type MetricCardProps = {
  label: string;
  value: string;
  /** Percent change vs the previous period. Null when there is no baseline. */
  delta: number | null;
  /** Shape for the trend line. Omit for metrics with no meaningful daily series. */
  trend?: number[];
  caption?: string;
  /** Inverts the good/bad reading for metrics where a fall is the win. */
  lowerIsBetter?: boolean;
};

export function MetricCard({
  label,
  value,
  delta,
  trend,
  caption,
  lowerIsBetter = false,
}: MetricCardProps) {
  const isFlat = delta === null || Math.abs(delta) < 0.05;
  const isUp = delta !== null && delta > 0;
  const isGood = lowerIsBetter ? !isUp : isUp;

  // Arrow + sign carry the direction, so the colour is reinforcement rather than
  // the only cue — the same reason status chips elsewhere in admin ship a label.
  const deltaClasses = isFlat
    ? "text-[#8d7a5c]"
    : isGood
      ? "text-[#256542]"
      : "text-[#9b3d32]";

  return (
    <article className="rounded-[1.5rem] border border-black/8 bg-white p-5">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c]">
        {label}
      </p>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="font-display text-[1.7rem] leading-none tracking-[-0.03em] tabular-nums text-[#201d17]">
          {value}
        </p>
        {trend && trend.length > 1 ? <Sparkline values={trend} /> : null}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[0.74rem]">
        {delta === null ? (
          <span className="text-[#8d7a5c]">No earlier period to compare</span>
        ) : (
          <>
            <span className={`font-semibold tabular-nums ${deltaClasses}`}>
              {isFlat ? "→" : isUp ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}%
            </span>
            <span className="text-[#8d7a5c]">vs previous period</span>
          </>
        )}
      </div>

      {caption ? <p className="mt-1 text-[0.72rem] text-[#8d7a5c]">{caption}</p> : null}
    </article>
  );
}
