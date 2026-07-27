import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { readOrders } from "@/lib/orders";
import { requirePermission } from "@/lib/staff-auth";
import { CounterSaleForm } from "@/components/admin/counter-sale-form";
import { SHOP_LOCATIONS, getProductsWithStockAtLocation } from "@/lib/product-stock";

/** Malaysian shop day, so "today" matches what the counter staff sees. */
const dayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur",
  dateStyle: "short",
});

const timeOfDay = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  timeStyle: "short",
});

type CounterSalePageProps = {
  searchParams: Promise<{ location?: string }>;
};

export default async function CounterSalePage({ searchParams }: CounterSalePageProps) {
  await requirePermission("counter-sale");
  const { location } = await searchParams;
  const activeLocation =
    SHOP_LOCATIONS.find((loc) => loc.id === location)?.id ?? SHOP_LOCATIONS[0].id;

  const products = await getProductsWithStockAtLocation(activeLocation);

  // Today's takings at this shop, so staff can see what has been rung up here
  // without leaving the till.
  const today = dayKey.format(new Date());
  const orders = await readOrders();
  const todaySales = orders
    .filter(
      (order) =>
        order.recordedFrom === "admin-walk-in" &&
        order.location === activeLocation &&
        dayKey.format(new Date(order.createdAt)) === today,
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const todayTotal = todaySales.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0);

  const pickerProducts = products.map((product) => ({
    slug: product.slug,
    name: product.name,
    size: product.size,
    price: product.price,
    quantity: typeof product.quantity === "number" ? product.quantity : null,
  }));

  return (
    <div>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8d7a5c]">
        Fulfillment
      </p>
      <h2 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
        Counter Sale
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#5d574f]">
        Record a sale made in person at the counter. Payment happens
        physically (cash, card, or DuitNow QR) — this just records the sale and
        automatically keeps that shop&apos;s stock in sync.
      </p>

      <div className="mt-6 flex flex-wrap gap-2.5">
        {SHOP_LOCATIONS.map((loc) => {
          const isActive = loc.id === activeLocation;
          return (
            <Link
              key={loc.id}
              href={`/admin/counter-sale?location=${loc.id}`}
              className={`inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-[0.76rem] font-semibold uppercase tracking-[0.16em] transition ${
                isActive
                  ? "border-[#201d17] bg-[#201d17] text-white"
                  : "border-black/8 bg-white text-[#201d17] hover:border-black/20"
              }`}
            >
              {loc.name}
            </Link>
          );
        })}
      </div>

      <section className="mt-6 rounded-[1.5rem] border border-black/8 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
              Today at {SHOP_LOCATIONS.find((loc) => loc.id === activeLocation)?.name}
            </p>
            <p className="mt-1 text-sm text-[#5d574f]">
              {todaySales.length} {todaySales.length === 1 ? "sale" : "sales"} ·{" "}
              <span className="font-semibold text-[#201d17]">
                {formatMoney(todayTotal / 100)}
              </span>
            </p>
          </div>
          <Link
            href={`/admin/orders?shop=${activeLocation}&type=in-store`}
            className="inline-flex h-9 items-center rounded-full border border-black/10 px-4 text-xs font-semibold text-[#201d17] transition hover:bg-[#f7f2ea]"
          >
            All sales at this shop
          </Link>
        </div>

        {todaySales.length > 0 ? (
          <ul className="mt-4 divide-y divide-black/5 border-t border-black/5">
            {todaySales.slice(0, 8).map((order) => (
              <li
                key={order.sessionId}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <span className="text-[#5d574f]">
                  {timeOfDay.format(new Date(order.createdAt))}
                  {" · "}
                  <span className="text-[#201d17]">
                    {order.customerName ?? "Walk-in"}
                  </span>
                  {order.soldByName ? (
                    <span className="text-[#8d7a5c]"> · by {order.soldByName}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-[#201d17]">
                    {formatMoney((order.totalAmount ?? 0) / 100)}
                  </span>
                  <Link
                    href={`/receipt/${order.sessionId}`}
                    target="_blank"
                    className="text-xs font-semibold text-[#8d7a5c] underline-offset-2 hover:underline"
                  >
                    Receipt
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[#8d7a5c]">
            No sales recorded at this shop today yet.
          </p>
        )}
      </section>

      <div className="mt-8">
        <CounterSaleForm
          products={pickerProducts}
          location={activeLocation}
          locationName={SHOP_LOCATIONS.find((loc) => loc.id === activeLocation)?.name ?? ""}
        />
      </div>
    </div>
  );
}
