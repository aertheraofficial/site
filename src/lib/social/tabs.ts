/**
 * Sub-tabs inside the Social section.
 *
 * "Ads" is the paid-ad system that already lived at /admin/social; its URL is
 * unchanged so the main nav entry and every existing link still land on it. The
 * rest are the tools brought over from the standalone medsoc service.
 *
 * Only shipped tabs belong here — an entry with no page is a 404 with a
 * confident label on it.
 */
export type SocialTab = {
  href: string;
  label: string;
  description: string;
};

export const SOCIAL_TABS: SocialTab[] = [
  {
    href: "/admin/social",
    label: "Ads",
    description: "AI ad drafts, approval queue, and paid campaigns on Meta.",
  },
  {
    href: "/admin/social/posts",
    label: "Posts",
    description: "Write and schedule organic posts across your channels.",
  },
  {
    href: "/admin/social/studio",
    label: "Studio",
    description: "Turn a plain product photo into a styled scene, with captions.",
  },
  {
    href: "/admin/social/captions",
    label: "Captions",
    description: "One idea, a caption for every network.",
  },
  {
    href: "/admin/social/linktree",
    label: "Link Tree",
    description: "The links behind your Instagram bio.",
  },
  {
    href: "/admin/social/analytics",
    label: "Analytics",
    description: "Which links people actually tap.",
  },
  {
    href: "/admin/social/settings",
    label: "Settings",
    description: "Connections and composer defaults.",
  },
];
