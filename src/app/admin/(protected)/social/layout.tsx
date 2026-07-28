import { SocialTabs } from "@/components/admin/social-tabs";
import { requirePermission } from "@/lib/staff-auth";

/**
 * One guard for the whole Social section. Each page still calls
 * `requirePermission` itself — the layout is not a security boundary in the App
 * Router, since a page can be requested on its own — but doing it here too
 * keeps an unauthorised request from rendering the tab bar first.
 */
export default async function SocialLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePermission("social");

  return (
    <div className="space-y-6">
      <div className="border-b border-black/8 pb-5">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8d7a5c]">
          Marketing
        </p>
        <h2 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
          Social
        </h2>
        <div className="mt-5">
          <SocialTabs />
        </div>
      </div>

      {children}
    </div>
  );
}
