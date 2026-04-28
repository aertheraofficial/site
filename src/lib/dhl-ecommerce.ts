import { createHash, randomUUID } from "crypto";
import type { StoredOrder } from "@/lib/orders";
import {
  createShippingBatch,
  type ShippingBatch,
  type ShippingBatchDocumentKind,
  type ShippingBatchShipment,
} from "@/lib/shipping-batches";

type DhlEnvironment = "production" | "preprod";
type DhlLabelFormat = "PDF" | "PNG" | "ZPL";

type DhlAddressConfig = {
  companyName: string | null;
  name: string;
  address1: string;
  address2: string | null;
  address3: string | null;
  city: string | null;
  state: string | null;
  district: string | null;
  country: string;
  postCode: string | null;
  phone: string | null;
  email: string | null;
};

type DhlConfig = {
  baseUrl: string;
  clientId: string;
  password: string;
  customerAccountId: string | null;
  pickupAccountId: string;
  soldToAccountId: string;
  productCode: string;
  shipmentIdPrefix: string;
  labelFormat: DhlLabelFormat;
  messageSource: string;
  trackingUrl: string;
  pickupAddress: DhlAddressConfig;
  shipperAddress: DhlAddressConfig;
};

type DhlResponseStatus = {
  code?: string | number;
  message?: string;
  messageDetails?: unknown;
};

type DhlLabelResult = {
  shipmentID?: string;
  deliveryConfirmationNo?: string;
  labelURL?: string;
  ppodLabel?: string;
  content?: string;
  pickupStartDateTime?: string;
  pickupEndDateTime?: string;
};

type PersistedDocumentInput = {
  id: string;
  kind: ShippingBatchDocumentKind;
  filename: string;
  mimeType: string;
  shipmentId?: string | null;
  buffer: Buffer;
};

let tokenCache:
  | {
      token: string;
      expiresAt: number;
      environment: DhlEnvironment;
      clientId: string;
    }
  | null = null;

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function truncateText(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

function getOptionalEnv(name: string) {
  return normalizeText(process.env[name]);
}

function getRequiredEnv(name: string) {
  const value = getOptionalEnv(name);

  if (!value) {
    throw new Error(`Missing ${name} in the environment.`);
  }

  return value;
}

function getEnvironment(): DhlEnvironment {
  return getOptionalEnv("DHL_ECOMMERCE_ENV")?.toLowerCase() === "preprod"
    ? "preprod"
    : "production";
}

function getLabelFormat(): DhlLabelFormat {
  const format = getOptionalEnv("DHL_ECOMMERCE_LABEL_FORMAT")?.toUpperCase() ?? "PDF";

  if (format !== "PDF" && format !== "PNG" && format !== "ZPL") {
    throw new Error("DHL_ECOMMERCE_LABEL_FORMAT must be one of PDF, PNG, or ZPL.");
  }

  return format;
}

function getDhlBaseUrl(environment: DhlEnvironment) {
  return environment === "preprod"
    ? "https://apitest.dhlecommerce.asia"
    : "https://api.dhlecommerce.dhl.com";
}

function getAddressConfig(prefix: string, fallback?: DhlAddressConfig): DhlAddressConfig {
  const name = getOptionalEnv(`${prefix}_NAME`) ?? fallback?.name ?? "";
  const address1 = getOptionalEnv(`${prefix}_ADDRESS1`) ?? fallback?.address1 ?? "";
  const country = (
    getOptionalEnv(`${prefix}_COUNTRY`) ??
    fallback?.country ??
    "MY"
  ).toUpperCase();

  if (!name || !address1) {
    throw new Error(`Missing ${prefix}_NAME or ${prefix}_ADDRESS1 in the environment.`);
  }

  return {
    companyName: getOptionalEnv(`${prefix}_COMPANY`) ?? fallback?.companyName ?? null,
    name,
    address1,
    address2: getOptionalEnv(`${prefix}_ADDRESS2`) ?? fallback?.address2 ?? null,
    address3: getOptionalEnv(`${prefix}_ADDRESS3`) ?? fallback?.address3 ?? null,
    city: getOptionalEnv(`${prefix}_CITY`) ?? fallback?.city ?? null,
    state: getOptionalEnv(`${prefix}_STATE`) ?? fallback?.state ?? null,
    district: getOptionalEnv(`${prefix}_DISTRICT`) ?? fallback?.district ?? null,
    country,
    postCode: getOptionalEnv(`${prefix}_POSTCODE`) ?? fallback?.postCode ?? null,
    phone: getOptionalEnv(`${prefix}_PHONE`) ?? fallback?.phone ?? null,
    email: getOptionalEnv(`${prefix}_EMAIL`) ?? fallback?.email ?? null,
  };
}

function getDhlConfig(): DhlConfig {
  const environment = getEnvironment();
  const pickupAddress = getAddressConfig("DHL_ECOMMERCE_PICKUP");

  return {
    baseUrl: getDhlBaseUrl(environment),
    clientId: getRequiredEnv("DHL_ECOMMERCE_CLIENT_ID"),
    password: getRequiredEnv("DHL_ECOMMERCE_PASSWORD"),
    customerAccountId: getOptionalEnv("DHL_ECOMMERCE_CUSTOMER_ACCOUNT_ID"),
    pickupAccountId: getRequiredEnv("DHL_ECOMMERCE_PICKUP_ACCOUNT_ID"),
    soldToAccountId: getRequiredEnv("DHL_ECOMMERCE_SOLD_TO_ACCOUNT_ID"),
    productCode: getRequiredEnv("DHL_ECOMMERCE_PRODUCT_CODE"),
    shipmentIdPrefix: getRequiredEnv("DHL_ECOMMERCE_SHIPMENT_ID_PREFIX"),
    labelFormat: getLabelFormat(),
    messageSource: getOptionalEnv("DHL_ECOMMERCE_MESSAGE_SOURCE") ?? "AERTHERA",
    trackingUrl:
      getOptionalEnv("DHL_ECOMMERCE_TRACKING_URL") ?? "https://ecommerceportal.dhl.com/track/",
    pickupAddress,
    shipperAddress: getAddressConfig("DHL_ECOMMERCE_SHIPPER", pickupAddress),
  };
}

export function isDhlEcommerceConfigured() {
  return Boolean(
    getOptionalEnv("DHL_ECOMMERCE_CLIENT_ID") &&
      getOptionalEnv("DHL_ECOMMERCE_PASSWORD") &&
      getOptionalEnv("DHL_ECOMMERCE_PICKUP_ACCOUNT_ID") &&
      getOptionalEnv("DHL_ECOMMERCE_SOLD_TO_ACCOUNT_ID") &&
      getOptionalEnv("DHL_ECOMMERCE_PRODUCT_CODE") &&
      getOptionalEnv("DHL_ECOMMERCE_SHIPMENT_ID_PREFIX") &&
      getOptionalEnv("DHL_ECOMMERCE_PICKUP_NAME") &&
      getOptionalEnv("DHL_ECOMMERCE_PICKUP_ADDRESS1"),
  );
}

export function getDhlTrackingPortalUrl() {
  return getDhlConfig().trackingUrl;
}

function buildShipmentId(order: StoredOrder, shipmentIdPrefix: string) {
  const prefix = shipmentIdPrefix.replace(/[^A-Za-z0-9_~.:]+/g, "").slice(0, 11);
  const digest = createHash("sha1").update(order.sessionId).digest("hex").slice(0, 24).toUpperCase();
  return `${prefix}${digest}`.slice(0, 35);
}

function getLabelFileDetails(format: DhlLabelFormat) {
  switch (format) {
    case "PNG":
      return { extension: "png", mimeType: "image/png" };
    case "ZPL":
      return { extension: "zpl", mimeType: "text/plain; charset=utf-8" };
    default:
      return { extension: "pdf", mimeType: "application/pdf" };
  }
}

function decodeLabelContent(content: string, format: DhlLabelFormat) {
  return format === "ZPL" ? Buffer.from(content, "utf8") : Buffer.from(content, "base64");
}

function getResponseStatus(payload: unknown): DhlResponseStatus | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const root = payload as {
    responseStatus?: DhlResponseStatus;
    labelResponse?: {
      responseStatus?: DhlResponseStatus;
      bd?: { responseStatus?: DhlResponseStatus };
    };
  };

  return (
    root.labelResponse?.bd?.responseStatus ??
    root.labelResponse?.responseStatus ??
    root.responseStatus ??
    null
  );
}

function getMessageDetails(value: unknown) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const raw = (value as { messageDetail?: string | string[] }).messageDetail;

  if (typeof raw === "string") {
    return [raw];
  }

  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === "string") : [];
}

function extractDhlError(payload: unknown) {
  const status = getResponseStatus(payload);

  if (!status) {
    return null;
  }

  const details = getMessageDetails(status.messageDetails);
  const parts = [
    typeof status.message === "string" ? status.message : null,
    ...details,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : null;
}

function normalizeLabels(value: unknown): DhlLabelResult[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is DhlLabelResult => Boolean(entry && typeof entry === "object"));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  if ("label" in value && Array.isArray((value as { label?: unknown[] }).label)) {
    return (value as { label: unknown[] }).label.filter(
      (entry): entry is DhlLabelResult => Boolean(entry && typeof entry === "object"),
    );
  }

  return [value as DhlLabelResult];
}

async function getAccessToken(config: DhlConfig) {
  const environment = getEnvironment();

  if (
    tokenCache &&
    tokenCache.environment === environment &&
    tokenCache.clientId === config.clientId &&
    tokenCache.expiresAt > Date.now() + 60_000
  ) {
    return tokenCache.token;
  }

  const url = new URL("/rest/v1/OAuth/AccessToken", config.baseUrl);
  url.searchParams.set("clientId", config.clientId);
  url.searchParams.set("password", config.password);
  url.searchParams.set("returnFormat", "json");

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        token?: string;
        expires_in?: number | string;
      }
    | null;

  if (!response.ok || !payload?.token) {
    throw new Error(
      extractDhlError(payload) ??
        `DHL authentication failed with status ${response.status}.`,
    );
  }

  const expiresIn =
    typeof payload.expires_in === "number"
      ? payload.expires_in
      : Number(payload.expires_in ?? 24 * 60 * 60);

  tokenCache = {
    token: payload.token,
    expiresAt: Date.now() + Math.max(expiresIn - 300, 60) * 1000,
    environment,
    clientId: config.clientId,
  };

  return payload.token;
}

function createPackageDescription(order: StoredOrder) {
  const explicit = normalizeText(order.packageDescription);

  if (explicit) {
    return truncateText(explicit, 50);
  }

  const fallback = order.lines
    .map((line) => line.description.trim())
    .filter(Boolean)
    .join(", ");

  return truncateText(fallback || "Aerthera order", 50);
}

function getShipmentValue(order: StoredOrder) {
  if (typeof order.totalAmount === "number") {
    return Number((order.totalAmount / 100).toFixed(2));
  }

  return 0;
}

function validateOrders(orders: StoredOrder[]) {
  if (orders.length === 0) {
    throw new Error("Select at least one order before generating a DHL batch.");
  }

  const invalidOrders: string[] = [];

  for (const order of orders) {
    const address = order.shippingAddress;
    const country = address?.country?.toUpperCase() ?? "";

    if (order.fulfillmentStatus === "cancelled") {
      invalidOrders.push(`${order.sessionId}: cancelled orders cannot be shipped.`);
      continue;
    }

    if (order.courierShipmentId) {
      invalidOrders.push(`${order.sessionId}: a DHL shipment has already been generated.`);
      continue;
    }

    if (!address?.line1 || !address.postal_code || !country) {
      invalidOrders.push(`${order.sessionId}: shipping address is incomplete.`);
      continue;
    }

    if (country !== "MY") {
      invalidOrders.push(
        `${order.sessionId}: DHL eCommerce Malaysia is configured here for domestic Malaysia shipments only.`,
      );
      continue;
    }

    if (!order.packageWeightGrams || order.packageWeightGrams <= 0) {
      invalidOrders.push(`${order.sessionId}: parcel weight is missing.`);
      continue;
    }

    if (!address.city && !address.state) {
      invalidOrders.push(`${order.sessionId}: city or state is required.`);
      continue;
    }
  }

  if (invalidOrders.length > 0) {
    throw new Error(invalidOrders.slice(0, 4).join(" "));
  }
}

function buildLabelRequest(
  orders: StoredOrder[],
  config: DhlConfig,
  accessToken: string,
) {
  return {
    labelRequest: {
      hdr: {
        messageType: "LABEL",
        messageDateTime: new Date().toISOString(),
        messageVersion: "1.4",
        accessToken,
        messageLanguage: "en",
        messageSource: config.messageSource,
      },
      bd: {
        ...(config.customerAccountId ? { customerAccountId: config.customerAccountId } : {}),
        pickupAccountId: config.pickupAccountId,
        soldToAccountId: config.soldToAccountId,
        consolidatedLabelRequired: "Y",
        inlineLabelReturn: "Y",
        pickupAddress: config.pickupAddress,
        shipperAddress: config.shipperAddress,
        shipmentItems: orders.map((order) => {
          const address = order.shippingAddress;
          const shipmentId = buildShipmentId(order, config.shipmentIdPrefix);

          return {
            consigneeAddress: {
              name: order.shippingName ?? order.customerName ?? order.customerEmail ?? "Customer",
              address1: address?.line1 ?? "",
              ...(address?.line2 ? { address2: address.line2 } : {}),
              ...(address?.city ? { city: address.city } : {}),
              ...(address?.state ? { state: address.state } : {}),
              district: address?.city ?? address?.state ?? "",
              country: address?.country?.toUpperCase() ?? "MY",
              postCode: address?.postal_code ?? "",
              ...(order.customerPhone ? { phone: order.customerPhone } : {}),
              ...(order.customerEmail ? { email: order.customerEmail } : {}),
            },
            shipmentID: shipmentId,
            packageDesc: createPackageDescription(order),
            totalWeight: Math.round(order.packageWeightGrams ?? 0),
            totalWeightUOM: "G",
            ...(order.packageHeightCm && order.packageLengthCm && order.packageWidthCm
              ? {
                  dimensionUOM: "CM",
                  height: Number(order.packageHeightCm.toFixed(2)),
                  length: Number(order.packageLengthCm.toFixed(2)),
                  width: Number(order.packageWidthCm.toFixed(2)),
                }
              : {}),
            productCode: config.productCode,
            totalValue: getShipmentValue(order),
            currency: order.currency.toUpperCase(),
            remarks: truncateText(order.sessionId, 50),
            billingReference1: truncateText(order.sessionId, 80),
            billingReference2: truncateText(order.customerEmail ?? "Aerthera", 80),
          };
        }),
      },
    },
  };
}

async function requestLabels(config: DhlConfig, payload: Record<string, unknown>) {
  const response = await fetch(`${config.baseUrl}/rest/v2/Label`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | {
        labelResponse?: {
          bd?: {
            consolidatedLabel?: string;
            consolidatedPpodLabel?: string;
            consolidatedLabelURL?: string;
            consolidatedPpodLabelURL?: string;
            labels?: unknown;
            pickupStartDateTime?: string;
            pickupEndDateTime?: string;
          };
        };
      }
    | null;

  if (!response.ok) {
    throw new Error(
      extractDhlError(data) ?? `DHL label request failed with status ${response.status}.`,
    );
  }

  const responseStatus = getResponseStatus(data);

  if (responseStatus && String(responseStatus.code ?? "") !== "200") {
    throw new Error(extractDhlError(data) ?? "DHL rejected the label request.");
  }

  return data;
}

export async function createDhlShipmentBatch(orders: StoredOrder[]): Promise<ShippingBatch> {
  validateOrders(orders);

  const config = getDhlConfig();
  const accessToken = await getAccessToken(config);
  const shipmentIdMap = new Map(
    orders.map((order) => [buildShipmentId(order, config.shipmentIdPrefix), order]),
  );
  const requestPayload = buildLabelRequest(orders, config, accessToken);
  const responsePayload = await requestLabels(config, requestPayload);
  const body = responsePayload?.labelResponse?.bd;
  const labels = normalizeLabels(body?.labels);

  if (labels.length === 0) {
    throw new Error("DHL did not return any labels for the selected orders.");
  }

  const { extension, mimeType } = getLabelFileDetails(config.labelFormat);
  const documents: PersistedDocumentInput[] = [];
  let consolidatedDocumentId: string | null = null;
  let consolidatedPpodDocumentId: string | null = null;

  if (body?.consolidatedLabel) {
    consolidatedDocumentId = randomUUID();
    documents.push({
      id: consolidatedDocumentId,
      kind: "consolidated-label",
      filename: `dhl-batch-label.${extension}`,
      mimeType,
      buffer: decodeLabelContent(body.consolidatedLabel, config.labelFormat),
    });
  }

  if (body?.consolidatedPpodLabel) {
    consolidatedPpodDocumentId = randomUUID();
    documents.push({
      id: consolidatedPpodDocumentId,
      kind: "consolidated-ppod",
      filename: `dhl-batch-ppod.${extension}`,
      mimeType,
      buffer: decodeLabelContent(body.consolidatedPpodLabel, config.labelFormat),
    });
  }

  const shipments: ShippingBatchShipment[] = [];

  for (const label of labels) {
    const shipmentId = normalizeText(label.shipmentID);

    if (!shipmentId) {
      continue;
    }

    const order = shipmentIdMap.get(shipmentId);

    if (!order) {
      continue;
    }

    let labelDocumentId: string | null = null;

    if (label.content) {
      labelDocumentId = randomUUID();
      documents.push({
        id: labelDocumentId,
        kind: "shipment-label",
        filename: `shipment-${shipmentId}.${extension}`,
        mimeType,
        shipmentId,
        buffer: decodeLabelContent(label.content, config.labelFormat),
      });
    }

    if (label.ppodLabel) {
      documents.push({
        id: randomUUID(),
        kind: "shipment-ppod",
        filename: `shipment-${shipmentId}-ppod.${extension}`,
        mimeType,
        shipmentId,
        buffer: decodeLabelContent(label.ppodLabel, config.labelFormat),
      });
    }

    shipments.push({
      sessionId: order.sessionId,
      customerName: order.customerName,
      shipmentId,
      trackingNumber: normalizeText(label.deliveryConfirmationNo) ?? shipmentId,
      labelDocumentId,
      labelUrl: normalizeText(label.labelURL),
    });
  }

  if (shipments.length !== orders.length) {
    throw new Error(
      `DHL returned ${shipments.length} labels for ${orders.length} selected orders. No local batch was saved.`,
    );
  }

  return createShippingBatch({
    courier: "dhl-ecommerce",
    orderSessionIds: orders.map((order) => order.sessionId),
    consolidatedDocumentId,
    consolidatedPpodDocumentId,
    consolidatedLabelUrl: normalizeText(body?.consolidatedLabelURL),
    consolidatedPpodLabelUrl: normalizeText(body?.consolidatedPpodLabelURL),
    pickupStartDateTime:
      normalizeText(body?.pickupStartDateTime) ??
      normalizeText(labels[0]?.pickupStartDateTime),
    pickupEndDateTime:
      normalizeText(body?.pickupEndDateTime) ??
      normalizeText(labels[0]?.pickupEndDateTime),
    shipments,
    documents,
  });
}
