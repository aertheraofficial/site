import type { Metadata } from "next";
import { LegalSectionsPage } from "@/components/legal-sections-page";
import { privacySections } from "@/data/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Aerthera privacy policy covering website use, guest checkout, payments, fulfillment, and personal data handling.",
};

export default function PrivacyPage() {
  return (
    <LegalSectionsPage
      eyebrow="Legal"
      title="Privacy Policy"
      description="How Aerthera handles personal data when you browse the website, use guest checkout, and purchase from the Lemongrass Malaya collection."
      sections={privacySections}
    />
  );
}
