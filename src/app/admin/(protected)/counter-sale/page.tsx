import Link from "next/link";
import { CounterSaleForm } from "@/components/admin/counter-sale-form";
import { SHOP_LOCATIONS, getProductsWithStockAtLocation } from "@/lib/product-stock";

type CounterSalePageProps = {
  searchParams: Promise<{ location?: string }>;
};

export default async function CounterSalePage({ searchParams }: CounterSalePageProps) {
  const { location } = await searchParams;
  const activeLocation =
    SHOP_LOCATIONS.find((loc) => loc.id === location)?.id ?? SHOP_LOCATIONS[0].id;

  const products = await getProductsWithStockAtLocation(activeLocation);

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
