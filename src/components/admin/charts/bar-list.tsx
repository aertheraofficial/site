import Link from "next/link";
import { CHART_INK, CHART_TRACK } from "./tokens";

export type BarListItem = {
  key: string;
  label: string;
  value: number;
  /** Shown under the label — e.g. "12 orders" beside a revenue bar. */
  caption?: string;
  href?: string;
};

type BarListProps = {
  items: BarListItem[];
  formatValue: (value: number) => string;
  emptyMessage?: string;
};

/**
 * Ranked magnitude, drawn as CSS widths rather than SVG so it reflows with the
 * card at any width without measuring the container.
 *
 * Bars are scaled against the largest value, not the total: this answers "how do
 * these compare with each other", which is the question a top-N list is asked.
 * Every bar carries its own value label, so no tooltip is needed to read one.
 */
export function BarList({ items, formatValue, emptyMessage = "No sales yet." }: BarListProps) {
  if (items.length === 0) {
    return <p className="py-6 text-sm text-[#8d7a5c]">{emptyMessage}</p>;
  }

  const max = Math.max(...items.map((item) => item.value), 0);

  return (
    <ol className="space-y-3">
      {items.map((item, index) => {
        // A non-zero value always shows a sliver, so "sold 1" never looks like "sold 0".
        const percent = max > 0 ? Math.max((item.value / max) * 100, item.value > 0 ? 1.5 : 0) : 0;

        const label = (
          <span className="truncate font-medium text-[#201d17]">
            <span className="mr-2 tabular-nums text-[#8d7a5c]">{index + 1}.</span>
            {item.label}
          </span>
        );

        return (
          <li key={item.key} className="group">
            <div className="flex items-baseline justify-between gap-4 text-[0.82rem]">
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex min-w-0 items-baseline transition group-hover:text-[#a85d1c]"
                >
                  {label}
                </Link>
              ) : (
                <span className="flex min-w-0 items-baseline">{label}</span>
              )}
              <span className="shrink-0 tabular-nums font-semibold text-[#201d17]">
                {formatValue(item.value)}
              </span>
            </div>

            <div
              className="mt-1.5 h-2 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: CHART_TRACK }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${percent}%`, backgroundColor: CHART_INK }}
              />
            </div>

            {item.caption ? (
              <p className="mt-1 text-[0.72rem] text-[#8d7a5c]">{item.caption}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
