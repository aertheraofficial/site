import type { Metadata } from "next";
import { LegalSectionsPage } from "@/components/legal-sections-page";
import { siteInfo } from "@/data/site";

export const metadata: Metadata = {
  title: "Data Deletion Instructions",
  description:
    "How to request deletion of personal data associated with Aerthera website and Meta integrations.",
};

const dataDeletionSections = [
  {
    title: "How to request deletion",
    body: [
      `Email ${siteInfo.email} with the subject line "Data deletion request" and include the email address or social account name connected to your Aerthera interaction.`,
      "We may ask for information needed to verify that you are the account holder or the person connected to the request before deleting or anonymising records.",
    ],
  },
  {
    title: "What we delete",
    body: [
      "Where applicable law allows, Aerthera will delete or anonymise personal data connected to website enquiries, social integrations, and marketing interactions that are no longer required for legitimate business, security, tax, accounting, dispute-resolution, or legal obligations.",
      "Payment information is handled by Stripe, and Meta account information is controlled through Meta. You may also need to use those providers' own privacy tools to remove data held directly by them.",
    ],
  },
  {
    title: "Response timing",
    body: [
      "Aerthera reviews deletion requests as promptly as reasonably possible after verification.",
      `For questions about privacy or deletion, contact ${siteInfo.email}.`,
    ],
  },
];

export default function DataDeletionPage() {
  return (
    <LegalSectionsPage
      eyebrow="Privacy"
      title="Data Deletion"
      description="Instructions for requesting deletion of personal data connected with Aerthera website use and Meta integrations."
      sections={dataDeletionSections}
    />
  );
}
