import siteData from "../../content/site.json";

type SiteSection = {
  title: string;
  body: string[];
};

type SiteData = {
  siteInfo: {
    name: string;
    collection: string;
    company: string;
    email: string;
    phone: string;
    address: string;
    socials: Array<{ label: string; href: string; icon: string }>;
    primaryLinks: Array<{ label: string; href: string }>;
    footerLinks: Array<{ label: string; href: string }>;
  };
  shopListing: {
    name: string;
    eyebrow: string;
    description: string;
    intro: string;
    heroImage: string;
  };
  homeContent: {
    hero: { title: string; buttonLabel: string };
    collection: { title: string; description: string; buttonLabel: string };
    handmade: { title: string; description: string };
    vision: {
      title: string;
      subtitle: string;
      description: string;
      body: string;
      buttonLabel: string;
    };
    services: {
      title: string;
      subtitle: string;
      description: string;
      offerings: Array<{ title: string; subtitle: string }>;
      workshopTitle: string;
      workshopSubtitle: string;
      workshopButtonLabel: string;
    };
    hoursTitle: string;
    hours: Array<{ label: string; value: string }>;
    feature: {
      title: string;
      description: string;
      cards: Array<{
        title: string;
        subtitle: string;
        description: string;
        buttonLabel?: string;
      }>;
    };
    contactTiles: Array<{ title: string; value: string }>;
  };
  privacySections: SiteSection[];
  accessibilitySections: SiteSection[];
};

function assertSectionArray(
  candidate: unknown,
  field: string,
): asserts candidate is SiteSection[] {
  if (!Array.isArray(candidate)) {
    throw new Error(`Invalid "${field}" content.`);
  }

  for (const section of candidate) {
    if (
      !section ||
      typeof section !== "object" ||
      typeof (section as SiteSection).title !== "string" ||
      !Array.isArray((section as SiteSection).body)
    ) {
      throw new Error(`Invalid section entry inside "${field}".`);
    }
  }
}

const data = siteData as SiteData;

if (!data.siteInfo?.name || !data.homeContent?.hero?.title || !data.shopListing?.heroImage) {
  throw new Error("Site content is missing required core fields.");
}

assertSectionArray(data.privacySections, "privacySections");
assertSectionArray(data.accessibilitySections, "accessibilitySections");

export const siteInfo = data.siteInfo;
export const shopListing = data.shopListing;
export const homeContent = data.homeContent;
export const privacySections = data.privacySections;
export const accessibilitySections = data.accessibilitySections;
