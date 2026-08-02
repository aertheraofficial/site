"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/money";
import type { DailyPoint } from "@/lib/sales-analytics";
import {
  CHART_FILL,
  CHART_GRID,
  CHART_INK,
  formatDayLabel,
  formatShortMoney,
} from "./tokens";

type SalesAreaChartProps = {
  points: DailyPoint[];
  height?: number;
};

const PAD = { top: 14, right: 10, bottom: 24, left: 54 };

/**
 * Daily revenue. One series, so no legend — the card title names it.
 *
 * The SVG is drawn at the measured pixel width instead of being scaled from a
 * fixed viewBox: a non-uniform scale would stretch the 2px stroke and the axis
 * text along with the geometry.
 */
export function SalesAreaChart({ points, height = 240 }: SalesAreaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const plotWidth = Math.max(width - PAD.left - PAD.right, 10);
  const plotHeight = Math.max(height - PAD.top - PAD.bottom, 10);

  // Always include 0 so the area is read against a true baseline, and give a
  // flat all-zero series a nominal top rather than dividing by zero.
  const maxRevenue = Math.max(...points.map((point) => point.revenue), 0) || 1;

  const xAt = useCallback(
    (index: number) =>
      PAD.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth),
    [points.length, plotWidth],
  );
  const yAt = useCallback(
    (revenue: number) => PAD.top + plotHeight - (revenue / maxRevenue) * plotHeight,
    [maxRevenue, plotHeight],
  );

  const handleMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const ratio = (x - PAD.left) / plotWidth;
    const index = Math.round(ratio * (points.length - 1));
    setActiveIndex(Math.min(Math.max(index, 0), points.length - 1));
  };

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-[#8d7a5c]"
        style={{ height }}
      >
        No paid orders in this period.
      </div>
    );
  }

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${xAt(index)},${yAt(point.revenue)}`)
    .join(" ");
  const areaPath =
    `M${xAt(0)},${PAD.top + plotHeight} ` +
    points.map((point, index) => `L${xAt(index)},${yAt(point.revenue)}`).join(" ") +
    ` L${xAt(points.length - 1)},${PAD.top + plotHeight} Z`;

  const gridValues = [0, maxRevenue / 2, maxRevenue];

  // Enough x labels to orient without colliding at narrow widths.
  const labelCount = Math.min(points.length, Math.max(2, Math.floor(plotWidth / 90)));
  const labelIndexes = Array.from({ length: labelCount }, (_, i) =>
    Math.round((i / Math.max(labelCount - 1, 1)) * (points.length - 1)),
  );

  const active = activeIndex === null ? null : points[activeIndex];
  const tooltipLeft = activeIndex === null ? 0 : xAt(activeIndex);
  const tooltipFlipped = tooltipLeft > width - 150;

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        width={width}
        height={height}
        onPointerMove={handleMove}
        onPointerLeave={() => setActiveIndex(null)}
        role="img"
        aria-label={`Daily revenue from ${formatDayLabel(points[0].day)} to ${formatDayLabel(
          points[points.length - 1].day,
        )}`}
        className="touch-none"
      >
        {gridValues.map((value) => (
          <g key={value}>
            <line
              x1={PAD.left}
              x2={PAD.left + plotWidth}
              y1={yAt(value)}
              y2={yAt(value)}
              stroke={CHART_GRID}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={yAt(value) + 3.5}
              textAnchor="end"
              className="fill-[#8d7a5c] text-[10px] tabular-nums"
            >
              {formatShortMoney(value)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={CHART_FILL} />
        <path
          d={linePath}
          fill="none"
          stroke={CHART_INK}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {labelIndexes.map((index) => (
          <text
            key={index}
            x={xAt(index)}
            y={height - 6}
            textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
            className="fill-[#8d7a5c] text-[10px]"
          >
            {formatDayLabel(points[index].day)}
          </text>
        ))}

        {activeIndex !== null && active ? (
          <g pointerEvents="none">
            <line
              x1={xAt(activeIndex)}
              x2={xAt(activeIndex)}
              y1={PAD.top}
              y2={PAD.top + plotHeight}
              stroke={CHART_INK}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.5}
            />
            {/* Surface ring keeps the marker legible where it sits on the line. */}
            <circle
              cx={xAt(activeIndex)}
              cy={yAt(active.revenue)}
              r={5}
              fill={CHART_INK}
              stroke="#ffffff"
              strokeWidth={2}
            />
          </g>
        ) : null}
      </svg>

      {activeIndex !== null && active ? (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[9rem] rounded-xl border border-black/8 bg-white px-3 py-2 shadow-lg"
          style={{
            left: tooltipFlipped ? undefined : tooltipLeft + 12,
            right: tooltipFlipped ? width - tooltipLeft + 12 : undefined,
          }}
        >
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[#8d7a5c]">
            {formatDayLabel(active.day)}
          </p>
          <p className="mt-1 text-[0.95rem] font-semibold tabular-nums text-[#201d17]">
            {formatMoney(active.revenue / 100)}
          </p>
          <p className="text-[0.72rem] text-[#5d574f]">
            {active.orders} {active.orders === 1 ? "order" : "orders"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
