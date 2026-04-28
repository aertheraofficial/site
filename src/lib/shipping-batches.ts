import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export type ShippingBatchDocumentKind =
  | "consolidated-label"
  | "consolidated-ppod"
  | "shipment-label"
  | "shipment-ppod";

export type ShippingBatchDocument = {
  id: string;
  kind: ShippingBatchDocumentKind;
  filename: string;
  mimeType: string;
  size: number;
  relativePath: string;
  shipmentId: string | null;
};

export type ShippingBatchShipment = {
  sessionId: string;
  customerName: string | null;
  shipmentId: string;
  trackingNumber: string | null;
  labelDocumentId: string | null;
  labelUrl: string | null;
};

export type ShippingBatch = {
  id: string;
  courier: "dhl-ecommerce";
  createdAt: string;
  orderSessionIds: string[];
  consolidatedDocumentId: string | null;
  consolidatedPpodDocumentId: string | null;
  consolidatedLabelUrl: string | null;
  consolidatedPpodLabelUrl: string | null;
  pickupStartDateTime: string | null;
  pickupEndDateTime: string | null;
  shipments: ShippingBatchShipment[];
  documents: ShippingBatchDocument[];
};

type CreateShippingBatchDocumentInput = {
  id?: string;
  kind: ShippingBatchDocumentKind;
  filename: string;
  mimeType: string;
  shipmentId?: string | null;
  buffer: Buffer;
};

type CreateShippingBatchInput = {
  courier: "dhl-ecommerce";
  createdAt?: string;
  orderSessionIds: string[];
  consolidatedDocumentId?: string | null;
  consolidatedPpodDocumentId?: string | null;
  consolidatedLabelUrl?: string | null;
  consolidatedPpodLabelUrl?: string | null;
  pickupStartDateTime?: string | null;
  pickupEndDateTime?: string | null;
  shipments: ShippingBatchShipment[];
  documents: CreateShippingBatchDocumentInput[];
};

type ShippingBatchDocumentRecord = {
  batch: ShippingBatch;
  document: ShippingBatchDocument;
  absolutePath: string;
};

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getShippingBatchesDirectory() {
  if (process.env.VERCEL === "1") {
    return "/tmp/aerthera-shipping-batches";
  }

  return path.resolve(process.cwd(), "./data/shipping-batches");
}

function getBatchDirectory(batchId: string) {
  return path.join(getShippingBatchesDirectory(), batchId);
}

function getBatchMetadataPath(batchId: string) {
  return path.join(getBatchDirectory(batchId), "batch.json");
}

function sanitizeFilename(value: string) {
  const normalized = value.trim().replace(/[^A-Za-z0-9._-]+/g, "-");
  return normalized || "document.bin";
}

export function getShippingBatchDocumentHref(batchId: string, documentId: string) {
  return `/admin/shipments/${encodeURIComponent(batchId)}/documents/${encodeURIComponent(documentId)}`;
}

export async function createShippingBatch(input: CreateShippingBatchInput) {
  const batchId = randomUUID();
  const batchDirectory = getBatchDirectory(batchId);
  const documentsDirectory = path.join(batchDirectory, "documents");

  await fs.mkdir(documentsDirectory, { recursive: true });

  const documents: ShippingBatchDocument[] = [];

  for (const document of input.documents) {
    const documentId = document.id ?? randomUUID();
    const filename = sanitizeFilename(document.filename);
    const storedFilename = `${documentId}-${filename}`;
    const absolutePath = path.join(documentsDirectory, storedFilename);

    await fs.writeFile(absolutePath, document.buffer);

    documents.push({
      id: documentId,
      kind: document.kind,
      filename,
      mimeType: document.mimeType,
      size: document.buffer.byteLength,
      relativePath: path.relative(batchDirectory, absolutePath),
      shipmentId: normalizeText(document.shipmentId) ?? null,
    });
  }

  const batch: ShippingBatch = {
    id: batchId,
    courier: input.courier,
    createdAt: input.createdAt ?? new Date().toISOString(),
    orderSessionIds: [...input.orderSessionIds],
    consolidatedDocumentId: normalizeText(input.consolidatedDocumentId) ?? null,
    consolidatedPpodDocumentId: normalizeText(input.consolidatedPpodDocumentId) ?? null,
    consolidatedLabelUrl: normalizeText(input.consolidatedLabelUrl) ?? null,
    consolidatedPpodLabelUrl: normalizeText(input.consolidatedPpodLabelUrl) ?? null,
    pickupStartDateTime: normalizeText(input.pickupStartDateTime) ?? null,
    pickupEndDateTime: normalizeText(input.pickupEndDateTime) ?? null,
    shipments: input.shipments.map((shipment) => ({
      sessionId: shipment.sessionId,
      customerName: normalizeText(shipment.customerName),
      shipmentId: shipment.shipmentId,
      trackingNumber: normalizeText(shipment.trackingNumber),
      labelDocumentId: normalizeText(shipment.labelDocumentId),
      labelUrl: normalizeText(shipment.labelUrl),
    })),
    documents,
  };

  await fs.writeFile(
    getBatchMetadataPath(batchId),
    `${JSON.stringify(batch, null, 2)}\n`,
    "utf8",
  );

  return batch;
}

export async function getShippingBatch(batchId: string) {
  try {
    const raw = await fs.readFile(getBatchMetadataPath(batchId), "utf8");
    const parsed = JSON.parse(raw) as ShippingBatch;
    return parsed;
  } catch {
    return null;
  }
}

export async function getShippingBatchDocument(
  batchId: string,
  documentId: string,
): Promise<ShippingBatchDocumentRecord | null> {
  const batch = await getShippingBatch(batchId);

  if (!batch) {
    return null;
  }

  const document = batch.documents.find((entry) => entry.id === documentId);

  if (!document) {
    return null;
  }

  return {
    batch,
    document,
    absolutePath: path.join(getBatchDirectory(batchId), document.relativePath),
  };
}
