type ShippingOption = {
  shipping_rate_data: {
    type: "fixed_amount";
    fixed_amount: {
      amount: number;
      currency: "myr";
    };
    display_name: string;
    delivery_estimate: {
      minimum: {
        unit: "business_day";
        value: number;
      };
      maximum: {
        unit: "business_day";
        value: number;
      };
    };
  };
};

const DEFAULT_ALLOWED_SHIPPING_COUNTRIES = [
  "MY",
  "SG",
  "TH",
  "ID",
  "BN",
  "PH",
  "VN",
  "AU",
  "NZ",
  "GB",
  "US",
] as const;

type AllowedShippingCountry = (typeof DEFAULT_ALLOWED_SHIPPING_COUNTRIES)[number];

function parseBoolean(value: string | undefined, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseAmount(value: string | undefined) {
  if (value === undefined || value.trim() === "") {
    return null;
  }

  const amount = Number.parseInt(value, 10);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`Invalid Stripe shipping amount: "${value}". Use minor units.`);
  }

  return amount;
}

function normalizeSiteUrl(value: string | undefined) {
  const fallback = "http://localhost:3000";

  if (!value) {
    return fallback;
  }

  try {
    return new URL(value).origin;
  } catch {
    return fallback;
  }
}

export function getSiteUrl() {
  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined;
  const vercelDeploymentUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : undefined;

  return normalizeSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.SITE_URL ??
      vercelProductionUrl ??
      vercelDeploymentUrl,
  );
}

/**
 * Origin Meta uses to fetch product images and link targets (Instagram requires a public HTTPS URL).
 * When admin runs locally, set this to your deployed site (e.g. https://yourdomain.com) while
 * NEXT_PUBLIC_SITE_URL can stay http://localhost:3000.
 */
export function getMetaPublicSiteUrl() {
  const explicit =
    process.env.META_PUBLIC_SITE_URL?.trim() ||
    process.env.SOCIAL_PUBLIC_SITE_URL?.trim();

  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      // fall through to getSiteUrl()
    }
  }

  return getSiteUrl();
}

export function isPublicHttpsOrigin(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname;

    return (
      url.protocol === "https:" &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1" &&
      !hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

export function getAllowedShippingCountries() {
  const allowedCountrySet = new Set<AllowedShippingCountry>(DEFAULT_ALLOWED_SHIPPING_COUNTRIES);
  const configured = process.env.STRIPE_ALLOWED_SHIPPING_COUNTRIES?.split(",")
    .map((country) => country.trim().toUpperCase())
    .filter((country): country is AllowedShippingCountry =>
      allowedCountrySet.has(country as AllowedShippingCountry),
    );

  return configured && configured.length > 0
    ? configured
    : [...DEFAULT_ALLOWED_SHIPPING_COUNTRIES];
}

export function isAutomaticTaxEnabled() {
  return parseBoolean(process.env.STRIPE_ENABLE_AUTOMATIC_TAX, false);
}

export function getShippingOptions(): ShippingOption[] {
  const standardAmount = parseAmount(process.env.STRIPE_SHIPPING_STANDARD_AMOUNT);
  const expressAmount = parseAmount(process.env.STRIPE_SHIPPING_EXPRESS_AMOUNT);

  const options: ShippingOption[] = [];

  if (standardAmount !== null) {
    options.push({
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: {
          amount: standardAmount,
          currency: "myr",
        },
        display_name:
          process.env.STRIPE_SHIPPING_STANDARD_LABEL?.trim() || "Standard Shipping",
        delivery_estimate: {
          minimum: { unit: "business_day", value: 2 },
          maximum: { unit: "business_day", value: 5 },
        },
      },
    });
  }

  if (expressAmount !== null) {
    options.push({
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: {
          amount: expressAmount,
          currency: "myr",
        },
        display_name:
          process.env.STRIPE_SHIPPING_EXPRESS_LABEL?.trim() || "Express Shipping",
        delivery_estimate: {
          minimum: { unit: "business_day", value: 1 },
          maximum: { unit: "business_day", value: 2 },
        },
      },
    });
  }

  return options;
}

export function getOrderStoragePath() {
  if (process.env.VERCEL === "1") {
    return "/tmp/aerthera-orders.json";
  }

  return process.env.ORDER_STORAGE_PATH?.trim() || "./data/orders.json";
}

export function getSocialStoragePath() {
  if (process.env.VERCEL === "1") {
    return "/tmp/aerthera-social.json";
  }

  return process.env.SOCIAL_STORAGE_PATH?.trim() || "./data/social-content.json";
}
