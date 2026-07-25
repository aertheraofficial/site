import QRCode from "qrcode";
import { requirePermission } from "@/lib/staff-auth";
import { getProductsWithStock } from "@/lib/product-stock";
import { PrintButton } from "./print-button";

async function buildLabels() {
  const products = await getProductsWithStock();
  return Promise.all(
    products.map(async (product) => ({
      slug: product.slug,
      name: product.name,
      size: product.size,
      sku: product.sku ?? product.slug,
      qrDataUrl: await QRCode.toDataURL(product.slug, {
        margin: 1,
        width: 240,
      }),
    })),
  );
}

export default async function ProductLabelsPage() {
  await requirePermission("labels");
  const labels = await buildLabels();

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-labels, #print-labels * { visibility: visible; }
          #print-labels { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8d7a5c]">
            Products
          </p>
          <h2 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
            Print Product Labels
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#5d574f]">
            Each label has a QR code encoding the product&apos;s slug. Print this
            page, cut out the labels, and stick one on every bottle during
            bottling/packing. Staff scan this same QR at pickup to verify the
            order.
          </p>
        </div>
        <PrintButton />
      </div>

      <div
        id="print-labels"
        className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      >
        {labels.map((label) => (
          <div
            key={label.slug}
            className="flex flex-col items-center gap-2 rounded-[1.25rem] border border-black/8 bg-white p-4 text-center break-inside-avoid"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={label.qrDataUrl}
              alt={`QR code for ${label.name}`}
              width={140}
              height={140}
              className="h-auto w-[140px]"
            />
            <p className="text-sm font-semibold leading-tight text-[#201d17]">
              {label.name}
            </p>
            <p className="text-xs text-[#8d7a5c]">{label.size}</p>
            <p className="font-mono text-[0.65rem] text-[#8d7a5c]">{label.sku}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
