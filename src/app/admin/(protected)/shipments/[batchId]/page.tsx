import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getShippingBatch,
  getShippingBatchDocumentHref,
} from "@/lib/shipping-batches";

type ShipmentBatchPageProps = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ created?: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminShipmentBatchPage({
  params,
  searchParams,
}: ShipmentBatchPageProps) {
  const [{ batchId }, { created }] = await Promise.all([params, searchParams]);
  const batch = await getShippingBatch(batchId);

  if (!batch) {
    notFound();
  }

  const consolidatedHref = batch.consolidatedDocumentId
    ? getShippingBatchDocumentHref(batch.id, batch.consolidatedDocumentId)
    : batch.consolidatedLabelUrl;
  const consolidatedPpodHref = batch.consolidatedPpodDocumentId
    ? getShippingBatchDocumentHref(batch.id, batch.consolidatedPpodDocumentId)
    : batch.consolidatedPpodLabelUrl;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/orders"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c] transition hover:text-[#201d17]"
          >
            ← Back to orders
          </Link>
          <h2 className="mt-3 font-display text-[2.8rem] leading-[0.95] tracking-[-0.05em] text-[#201d17]">
            DHL Shipment Batch
          </h2>
          <p className="mt-2 text-sm leading-7 text-[#5d574f]">
            Batch {batch.id} · {formatDate(batch.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <span className="inline-flex rounded-full border border-black/8 bg-white px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#6a6258]">
            {batch.shipments.length} shipment{batch.shipments.length === 1 ? "" : "s"}
          </span>
          <span className="inline-flex rounded-full border border-[#b8d9c2] bg-[#edf8f0] px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#256542]">
            {batch.courier}
          </span>
        </div>
      </div>

      {created ? (
        <p className="rounded-[1.25rem] border border-[#b8d9c2] bg-[#edf8f0] px-4 py-3 text-sm leading-6 text-[#256542]">
          DHL accepted the batch. Tracking numbers have been written back to the selected
          orders.
        </p>
      ) : null}

      <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
              Print & Handover
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[#201d17]">
              Use the consolidated document when it is available
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5d574f]">
              DHL eCommerce can return a single consolidated label for the batch. If the
              account does not return one, use the individual shipment labels below.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {consolidatedHref ? (
              <a
                href={consolidatedHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#201d17] px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:opacity-92"
              >
                Open Batch Label
              </a>
            ) : null}
            {consolidatedPpodHref ? (
              <a
                href={consolidatedPpodHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/8 px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-black/4"
              >
                Open PPOD
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.4rem] border border-black/8 bg-[#fcfaf6] p-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
              Batch ID
            </p>
            <p className="mt-3 text-sm leading-6 text-[#201d17] [overflow-wrap:anywhere] break-words">
              {batch.id}
            </p>
          </article>

          <article className="rounded-[1.4rem] border border-black/8 bg-[#fcfaf6] p-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
              Pickup Window
            </p>
            <p className="mt-3 text-sm leading-6 text-[#201d17]">
              {batch.pickupStartDateTime && batch.pickupEndDateTime
                ? `${formatDate(batch.pickupStartDateTime)} to ${formatDate(batch.pickupEndDateTime)}`
                : "Not returned by DHL"}
            </p>
          </article>

          <article className="rounded-[1.4rem] border border-black/8 bg-[#fcfaf6] p-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
              Documents
            </p>
            <p className="mt-3 text-sm leading-6 text-[#201d17]">
              {batch.documents.length} file{batch.documents.length === 1 ? "" : "s"} saved
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
          Shipments
        </p>
        <div className="mt-6 space-y-4">
          {batch.shipments.map((shipment) => (
            <article
              key={shipment.sessionId}
              className="rounded-[1.4rem] border border-black/8 bg-[#fcfaf6] p-5"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                    Customer
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[#201d17]">
                    {shipment.customerName ?? "Guest checkout"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#5d574f]">
                    Shipment {shipment.shipmentId}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:min-w-[360px]">
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                      Tracking
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#201d17]">
                      {shipment.trackingNumber ?? shipment.shipmentId}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                      Order
                    </p>
                    <Link
                      href={`/admin/orders/${encodeURIComponent(shipment.sessionId)}`}
                      className="mt-2 inline-flex text-sm leading-6 text-[#201d17] underline decoration-black/20 underline-offset-4 transition hover:decoration-black/70"
                    >
                      Open order
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3 border-t border-black/8 pt-5">
                {shipment.labelDocumentId ? (
                  <a
                    href={getShippingBatchDocumentHref(batch.id, shipment.labelDocumentId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-black/8 bg-white px-4 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-black/4"
                  >
                    Open Shipment Label
                  </a>
                ) : null}
                {shipment.labelUrl ? (
                  <a
                    href={shipment.labelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-black/8 bg-white px-4 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-black/4"
                  >
                    Open DHL Label URL
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
