import { CounterSaleForm } from "@/components/admin/counter-sale-form";
import { getProductsWithStock } from "@/lib/product-stock";

export default async function CounterSalePage() {
  const products = await getProductsWithStock();

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
        Record a sale made in person at the mall counter. Payment happens
        physically (cash, card, or DuitNow QR) — this just records the sale and
        automatically keeps stock in sync, the same way an online order does.
      </p>

      <div className="mt-8">
        <CounterSaleForm products={pickerProducts} />
      </div>
    </div>
  );
}
