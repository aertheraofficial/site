import { products } from "@/data/products";
import { homeContent, siteInfo } from "@/data/site";
import { formatMoney } from "@/lib/money";

export type SocialPlatform = "instagram" | "tiktok" | "facebook" | "x";

export type ContentPillar = {
  id: string;
  label: string;
  description: string;
  guardrail: string;
};

export type BrandProductFact = {
  slug: string;
  name: string;
  shortName: string;
  categoryLabel: string;
  categorySlugs: string[];
  priceLabel: string;
  availability: string;
  leadTime: string | null;
  scentNotes: string[];
  rituals: string[];
  urlPath: string;
  imagePath: string;
};

export type SocialBrandContext = {
  brandName: string;
  company: string;
  collection: string;
  positioning: string;
  mission: string[];
  voice: string[];
  audience: string[];
  contentPillars: ContentPillar[];
  prohibitedClaims: string[];
  claimRules: string[];
  platforms: Array<{
    platform: SocialPlatform;
    priority: number;
    role: string;
    defaultFormats: string[];
    cadence: string;
  }>;
  productFacts: BrandProductFact[];
  categoryStories: Array<{
    slug: string;
    name: string;
    description: string;
  }>;
};

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "instagram",
  "tiktok",
  "facebook",
  "x",
];

export const CONTENT_PILLARS: ContentPillar[] = [
  {
    id: "product-rituals",
    label: "Product Rituals",
    description:
      "Show how a product fits into a real morning, home, body-care, sleep, or gifting ritual.",
    guardrail: "Keep usage practical and sensory; avoid implying medical treatment.",
  },
  {
    id: "scent-education",
    label: "Scent Education",
    description:
      "Explain notes, scent families, formats, and when to use each aroma profile.",
    guardrail: "Describe mood and atmosphere, not clinical outcomes.",
  },
  {
    id: "sustainable-craft",
    label: "Sustainable Craft",
    description:
      "Connect Aerthera's nature-led sourcing, community values, and careful making.",
    guardrail: "Do not invent certifications, farm names, or measurable impact claims.",
  },
  {
    id: "mood-moments",
    label: "Mood and Moments",
    description:
      "Build posts around everyday moments: morning reset, bedtime calm, travel, hosting, and home refresh.",
    guardrail: "Use soft wellness language; do not promise anxiety, sleep, or stress cures.",
  },
  {
    id: "launch-availability",
    label: "Launch and Availability",
    description:
      "Promote collections, pre-order windows, bundles, product formats, and product links.",
    guardrail: "Only use prices, availability, and lead times from the catalog.",
  },
  {
    id: "trust-builders",
    label: "Trust Builders",
    description:
      "Share usage notes, care guidance, behind-the-scenes, founder perspective, and brand proof points.",
    guardrail: "Escalate ingredient, safety, or regulatory claims for human review.",
  },
];

export const PROHIBITED_SOCIAL_CLAIMS = [
  "cure",
  "treat",
  "heal",
  "prevent disease",
  "medical grade",
  "clinically proven",
  "guaranteed sleep",
  "anti-anxiety",
  "antidepressant",
  "antibacterial",
  "antiviral",
  "100% organic",
  "zero impact",
  "carbon neutral",
];

const PLATFORM_STRATEGY: SocialBrandContext["platforms"] = [
  {
    platform: "instagram",
    priority: 1,
    role: "Primary visual storefront for polished rituals, carousels, Reels, and product discovery.",
    defaultFormats: ["Reel", "carousel", "single image"],
    cadence: "3 posts/week",
  },
  {
    platform: "tiktok",
    priority: 2,
    role: "Short-form discovery channel for ritual demos, founder clips, behind-the-scenes, and sensory hooks.",
    defaultFormats: ["vertical video script", "UGC-style demo"],
    cadence: "2 posts/week",
  },
  {
    platform: "facebook",
    priority: 3,
    role: "Trust and community channel for product education, offers, local updates, and longer-form captions.",
    defaultFormats: ["link post", "photo post", "short video"],
    cadence: "2 posts/week",
  },
  {
    platform: "x",
    priority: 4,
    role: "Lightweight announcement and founder-note channel; lower priority unless audience traction appears.",
    defaultFormats: ["short text", "link post", "thread starter"],
    cadence: "2 posts/week",
  },
];

function toProductFact(product: (typeof products)[number]): BrandProductFact {
  return {
    slug: product.slug,
    name: product.name,
    shortName: product.shortName,
    categoryLabel: product.categoryLabel,
    categorySlugs: product.categorySlugs,
    priceLabel: formatMoney(product.price),
    availability: product.availability,
    leadTime: product.leadTime ?? null,
    scentNotes: product.scentNotes,
    rituals: product.ritual,
    urlPath: `/product-page/${product.slug}`,
    imagePath: product.image,
  };
}

export function getSocialBrandContext(): SocialBrandContext {
  const prioritizedProducts = [
    ...products.filter((product) =>
      product.categorySlugs.includes("lemongrass-collection"),
    ),
    ...products.filter((product) =>
      product.categorySlugs.includes("pineapple-collection"),
    ),
    ...products.filter((product) =>
      product.categorySlugs.includes("aromatherapy"),
    ),
  ];
  const uniqueProducts = [...new Map(
    prioritizedProducts.map((product) => [product.slug, product]),
  ).values()];

  return {
    brandName: siteInfo.name,
    company: siteInfo.company,
    collection: siteInfo.collection,
    positioning: "Sustainable wellness aromatherapy for body, fabric, room, and everyday ritual.",
    mission: [
      homeContent.vision.description,
      homeContent.vision.body,
      homeContent.feature.description,
    ],
    voice: [
      "sensory but specific",
      "warm and calm",
      "nature-led",
      "premium without being clinical",
      "grounded in real product facts",
    ],
    audience: [
      "wellness-minded shoppers",
      "home-fragrance and body-care buyers",
      "gift shoppers",
      "sustainability-conscious customers",
      "Malaysia and international DTC customers",
    ],
    contentPillars: CONTENT_PILLARS,
    prohibitedClaims: PROHIBITED_SOCIAL_CLAIMS,
    claimRules: [
      "Use product facts from the catalog for prices, availability, sizes, scent notes, and lead times.",
      "Use wellness, atmosphere, and ritual language instead of medical or therapeutic promises.",
      "Do not invent certifications, testing, farms, impact metrics, ingredients, awards, or customer testimonials.",
      "Flag pre-order products clearly when availability is Pre-order.",
      "Prefer soft calls to action such as Shop the ritual, Explore the collection, or Save this for your next reset.",
    ],
    platforms: PLATFORM_STRATEGY,
    productFacts: uniqueProducts.slice(0, 18).map(toProductFact),
    categoryStories: [...new Set(products.map((product) => product.categoryLabel))].map(
      (label) => ({
        slug: label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "catalog",
        name: label,
        description: `Products grouped under the ${label} lane in the catalog.`,
      }),
    ),
  };
}

export function getProductFactsBySlugs(slugs: string[]) {
  const slugSet = new Set(slugs);
  return getSocialBrandContext().productFacts.filter((product) =>
    slugSet.has(product.slug),
  );
}
