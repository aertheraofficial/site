import Link from "next/link";
import { formatShopDate } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { readOrders, type StoredOrder } from "@/lib/orders";
import { PREORDER_THRESHOLD } from "@/lib/product-availability";
import {
  ALL_LOCATIONS,
  getLocationName,
  getProductsWithStock,
  isLocationId,
} from "@/lib/product-stock";
import {
  DEFAULT_RANGE,
  RANGE_OPTIONS,
  biggestOrders,
  isPaidOrder,
  isRangeKey,
  isWithin,
  orderLocation,
  percentChange,
  resolveRange,
  revenueByCategory,
  revenueByDay,
  revenueByFulfillment,
  revenueByLocation,
  revenueBySeller,
  summarize,
  topCustomers,
  topProducts,
  type ProductMetric,
} from "@/lib/sales-analytics";
import { requirePermission } from "@/lib/staff-auth";
import { BarList } from "@/components/admin/charts/bar-list";
import { MetricCard } from "@/components/admin/charts/metric-card";
import { SalesAreaChart } from "@/components/admin/charts/sales-area-chart";

type DashboardPageProps = {
  searchParams: Promise<{
    range?: string;
    location?: string;
    metric?: string;
  }>;
};

// min-w-0 is load-bearing: these sections are grid items, whose default
// min-width:auto lets a `truncate` label (which implies white-space:nowrap)
// push the whole card wider than the phone viewport instead of ellipsing.
const CARD = "min-w-0 rounded-[1.75rem] border border-black/8 bg-white p-6";

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={CARD}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[1.15rem] leading-none tracking-[-0.02em] text-[#201d17]">
            {title}
          </h2>
          {hint ? <p className="mt-1.5 text-[0.75rem] text-[#8d7a5c]">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function FilterPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-[0.7rem] font-semibold uppercase tracking-[0.14em] transition ${
        active
          ? "bg-[#201d17] text-white"
          : "border border-black/10 bg-white text-[#201d17] hover:bg-[#f7f2ea]"
      }`}
    >
      {label}
    </Link>
  );
}

export default async function SalesDashboardPage({ searchParams }: DashboardPageProps) {
  await requirePermission("dashboard");
  const params = await searchParams;

  const rangeKey = isRangeKey(params.range) ? params.range : DEFAULT_RANGE;
  const locationFilter = isLocationId(params.location) ? params.location : null;
  const productMetric: ProductMetric = params.metric === "revenue" ? "revenue" : "units";

  const [allOrders, products] = await Promise.all([readOrders(), getProductsWithStock()]);

  const names = new Map(products.map((product) => [product.slug, product.name]));
  const categories = new Map(
    products.map((product) => [product.slug, product.categoryLabel]),
  );

  const scoped = locationFilter
    ? allOrders.filter((order) => orderLocation(order) === locationFilter)
    : allOrders;

  const range = resolveRange(rangeKey);

  const current = scoped.filter((order) => isWithin(order, range.fromDay, range.toDay));
  const previous =
    range.previousFromDay && range.previousToDay
      ? scoped.filter((order) =>
          isWithin(order, range.previousFromDay, range.previousToDay!),
        )
      : [];

  const summary = summarize(current);
  const priorSummary = summarize(previous);
  const hasBaseline = previous.length > 0;

  const daily = revenueByDay(current, range.fromDay, range.toDay);
  const trend = daily.map((point) => point.revenue);

  const buildHref = (next: Partial<Record<"range" | "location" | "metric", string>>) => {
    const query = new URLSearchParams();
    const merged = {
      range: rangeKey,
      location: locationFilter ?? "",
      metric: productMetric,
      ...next,
    };
    if (merged.range !== DEFAULT_RANGE) query.set("range", merged.range);
    if (merged.location) query.set("location", merged.location);
    if (merged.metric !== "units") query.set("metric", merged.metric);
    const suffix = query.toString();
    return suffix ? `/admin/dashboard?${suffix}` : "/admin/dashboard";
  };

  const delta = (pick: (s: typeof summary) => number) =>
    hasBaseline ? percentChange(pick(summary), pick(priorSummary)) : null;

  const bestSellers = topProducts(current, names, productMetric, 8);
  const categoryStats = revenueByCategory(current, categories);
  const locationStats = revenueByLocation(current, getLocationName);
  const sellerStats = revenueBySeller(current);
  const fulfillmentStats = revenueByFulfillment(current);
  const largestOrders = biggestOrders(current, 5);
  const bestCustomers = topCustomers(current, 5);

  // Operational counters are deliberately not scoped to the date range — an
  // unfulfilled order from two months ago is more urgent, not less.
  const paidAll = scoped.filter(isPaidOrder);
  const unfulfilled = paidAll.filter(
    (order: StoredOrder) => order.fulfillmentStatus === "unfulfilled",
  ).length;
  const awaitingPayment = scoped.filter(
    (order) => order.paymentStatus === "pending" && order.checkoutStatus === "open",
  ).length;
  const tracked = products.filter((product) => typeof product.quantity === "number");
  const lowStock = tracked.filter(
    (product) => (product.quantity ?? 0) > 0 && (product.quantity ?? 0) <= PREORDER_THRESHOLD,
  ).length;
  const soldOut = tracked.filter((product) => (product.quantity ?? 0) <= 0).length;

  const ops = [
    {
      label: "Unfulfilled orders",
      value: unfulfilled,
      href: "/admin/orders?status=unfulfilled",
      tone: unfulfilled > 0 ? "warning" : "calm",
    },
    {
      label: "Awaiting payment",
      value: awaitingPayment,
      href: "/admin/orders",
      tone: awaitingPayment > 0 ? "warning" : "calm",
    },
    {
      label: `Low stock (≤ ${PREORDER_THRESHOLD})`,
      value: lowStock,
      href: "/admin/stock?status=low-stock",
      tone: lowStock > 0 ? "warning" : "calm",
    },
    {
      label: "Sold out",
      value: soldOut,
      href: "/admin/stock?status=sold-out",
      tone: soldOut > 0 ? "critical" : "calm",
    },
  ] as const;

  const toneClasses: Record<"calm" | "warning" | "critical", string> = {
    calm: "border-black/8 bg-white text-[#201d17]",
    warning: "border-[#e7d3a8] bg-[#fbf4e6] text-[#8b5e1d]",
    critical: "border-[#eec4c1] bg-[#fdf1f0] text-[#9b3d32]",
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-[#8d7a5c]">
          Overview
        </p>
        <h1 className="font-display text-[2.1rem] leading-none tracking-[-0.04em] text-[#201d17]">
          Sales Dashboard
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-[#5d574f]">
          Paid orders only — carts that never completed checkout are excluded from
          revenue, and counted separately as the completion rate.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-black/8 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <FilterPill
              key={option.key}
              href={buildHref({ range: option.key })}
              label={option.label}
              active={option.key === rangeKey}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterPill
            href={buildHref({ location: "" })}
            label="All locations"
            active={locationFilter === null}
          />
          {ALL_LOCATIONS.map((location) => (
            <FilterPill
              key={location.id}
              href={buildHref({ location: location.id })}
              label={location.name}
              active={locationFilter === location.id}
            />
          ))}
        </div>
      </div>

      {/* Headline metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Revenue"
          value={formatMoney(summary.revenue / 100)}
          delta={delta((s) => s.revenue)}
          trend={trend}
        />
        <MetricCard
          label="Paid orders"
          value={String(summary.paidOrders)}
          delta={delta((s) => s.paidOrders)}
          trend={daily.map((point) => point.orders)}
        />
        <MetricCard
          label="Avg order value"
          value={formatMoney(summary.averageOrderValue / 100)}
          delta={delta((s) => s.averageOrderValue)}
        />
        <MetricCard
          label="Units sold"
          value={String(summary.unitsSold)}
          delta={delta((s) => s.unitsSold)}
        />
        <MetricCard
          label="Checkout completion"
          value={`${Math.round(summary.completionRate * 100)}%`}
          delta={delta((s) => s.completionRate)}
          caption={`${summary.paidOrders} paid of ${summary.checkoutsStarted} started`}
        />
      </div>

      <Section
        title="Revenue over time"
        hint={
          range.fromDay
            ? `${formatShopDate(range.fromDay)} — ${formatShopDate(range.toDay)}, by day`
            : "All time, by day"
        }
      >
        <SalesAreaChart points={daily} />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Best sellers"
          hint="The top item by units is often not the top item by ringgit — switch and compare."
          action={
            <div className="flex gap-2">
              <FilterPill
                href={buildHref({ metric: "units" })}
                label="Units"
                active={productMetric === "units"}
              />
              <FilterPill
                href={buildHref({ metric: "revenue" })}
                label="Ringgit"
                active={productMetric === "revenue"}
              />
            </div>
          }
        >
          <BarList
            items={bestSellers.map((product) => ({
              key: product.slug || product.name,
              label: product.name,
              value: product[productMetric],
              caption:
                productMetric === "units"
                  ? formatMoney(product.revenue / 100)
                  : `${product.units} units`,
              href: product.slug ? `/product-page/${product.slug}` : undefined,
            }))}
            formatValue={(value) =>
              productMetric === "units" ? `${value} units` : formatMoney(value / 100)
            }
          />
        </Section>

        <Section title="Revenue by category" hint="Where the money actually comes from.">
          <BarList
            items={categoryStats.map((stat) => ({
              key: stat.key,
              label: stat.label,
              value: stat.revenue,
              caption: `${stat.orders} units sold`,
            }))}
            formatValue={(value) => formatMoney(value / 100)}
          />
        </Section>

        <Section title="Revenue by location" hint="Online warehouse vs each shop counter.">
          <BarList
            items={locationStats.map((stat) => ({
              key: stat.key,
              label: stat.label,
              value: stat.revenue,
              caption: `${stat.orders} orders`,
            }))}
            formatValue={(value) => formatMoney(value / 100)}
          />
        </Section>

        <Section title="Revenue by seller" hint="Counter sales credited to the staff who rang them up.">
          <BarList
            items={sellerStats.map((stat) => ({
              key: stat.key,
              label: stat.label,
              value: stat.revenue,
              caption: `${stat.orders} orders`,
            }))}
            formatValue={(value) => formatMoney(value / 100)}
          />
        </Section>

        <Section title="Largest orders" hint="Single baskets worth following up on.">
          {largestOrders.length === 0 ? (
            <p className="py-6 text-sm text-[#8d7a5c]">No paid orders in this period.</p>
          ) : (
            <ol className="divide-y divide-black/6">
              {largestOrders.map((order) => (
                <li key={order.sessionId} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/orders/${encodeURIComponent(order.sessionId)}`}
                      className="block truncate text-[0.85rem] font-medium text-[#201d17] hover:text-[#a85d1c]"
                    >
                      {order.customer}
                    </Link>
                    <p className="text-[0.72rem] text-[#8d7a5c]">
                      {formatShopDate(order.day)} · {order.items} items
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-[0.9rem] font-semibold text-[#201d17]">
                    {formatMoney(order.total / 100)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title="Top customers" hint="Ranked by spend in this period.">
          {bestCustomers.length === 0 ? (
            <p className="py-6 text-sm text-[#8d7a5c]">No paid orders in this period.</p>
          ) : (
            <ol className="divide-y divide-black/6">
              {bestCustomers.map((customer) => (
                <li key={customer.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[0.85rem] font-medium text-[#201d17]">
                      {customer.name}
                    </p>
                    <p className="truncate text-[0.72rem] text-[#8d7a5c]">
                      {customer.orders} {customer.orders === 1 ? "order" : "orders"}
                      {customer.contact ? ` · ${customer.contact}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-[0.9rem] font-semibold text-[#201d17]">
                    {formatMoney(customer.spent / 100)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>

      <Section
        title="Delivery vs pickup"
        hint="How customers take their orders — the split that drives packing and courier volume."
      >
        <BarList
          items={fulfillmentStats.map((stat) => ({
            key: stat.key,
            label: stat.label,
            value: stat.revenue,
            caption: `${stat.orders} orders`,
          }))}
          formatValue={(value) => formatMoney(value / 100)}
        />
      </Section>

      {/* Needs attention — not date-filtered on purpose. */}
      <div>
        <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-[#8d7a5c]">
          Needs attention
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ops.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`rounded-[1.25rem] border p-5 transition hover:opacity-90 ${toneClasses[item.tone]}`}
            >
              <p className="font-display text-[1.7rem] leading-none tabular-nums">
                {item.value}
              </p>
              <p className="mt-2 text-[0.75rem] font-medium">{item.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
