/**
 * Registry of admin pages a staff member can be granted access to.
 * The master admin (env credentials) always has every permission.
 * Staff get an explicit subset stored in `staff.permissions`.
 */

export type PageKey =
  | "orders"
  | "counter-sale"
  | "products"
  | "stock"
  | "labels"
  | "social"
  | "staff";

export type AdminPage = {
  key: PageKey;
  label: string;
  href: string;
  group: string;
  /** Only the master admin can hold this permission (never assignable to staff). */
  adminOnly?: boolean;
};

export const ADMIN_PAGES: AdminPage[] = [
  { key: "orders", label: "Orders", href: "/admin/orders", group: "Fulfillment" },
  {
    key: "counter-sale",
    label: "Counter Sale",
    href: "/admin/counter-sale",
    group: "Fulfillment",
  },
  { key: "products", label: "Products", href: "/admin/products", group: "Catalog" },
  { key: "stock", label: "Manage Stock", href: "/admin/stock", group: "Catalog" },
  { key: "labels", label: "Print Labels", href: "/admin/labels", group: "Catalog" },
  { key: "social", label: "Social", href: "/admin/social", group: "Marketing" },
  {
    key: "staff",
    label: "Staff & Payroll",
    href: "/admin/staff",
    group: "Admin",
    adminOnly: true,
  },
];

/** Permissions that can be assigned to a staff member (everything except admin-only). */
export const ASSIGNABLE_PAGES = ADMIN_PAGES.filter((page) => !page.adminOnly);

export const PAGE_KEYS = ADMIN_PAGES.map((page) => page.key);

export function isPageKey(value: unknown): value is PageKey {
  return typeof value === "string" && PAGE_KEYS.includes(value as PageKey);
}

export function getPageByKey(key: string): AdminPage | undefined {
  return ADMIN_PAGES.find((page) => page.key === key);
}
