import { CHART_INK } from "./tokens";

type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
};

/**
 * Shape-only trend for a metric card — no axes, no labels, no interaction. The
 * exact numbers live in the card beside it; this only answers "rising or not".
 * Rendered at a fixed pixel size so the 2px stroke is never scaled out of spec.
 */
export function Sparkline({ values, width = 104, height = 28 }: SparklineProps) {
  if (values.length < 2) {
    return <div style={{ width, height }} aria-hidden="true" />;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  // 1px inset top and bottom so the stroke is never clipped at the extremes.
  const toY = (value: number) => height - 1 - ((value - min) / span) * (height - 2);

  const points = values.map((value, index) => `${index * stepX},${toY(value)}`);
  const lastValue = values[values.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="overflow-visible"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={CHART_INK}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
      />
      <circle cx={width} cy={toY(lastValue)} r={2.5} fill={CHART_INK} />
    </svg>
  );
}
