/**
 * Registry of admin pages a staff member can be granted access to.
 * The master admin (env credentials) always has every permission.
 * Staff get an explicit subset stored in `staff.permissions`.
 */

export type PageKey =
  | "dashboard"
  | "sales"
  | "orders"
  | "counter-sale"
  | "customers"
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
  {
    key: "dashboard",
    label: "Sales Dashboard",
    href: "/admin/dashboard",
    group: "Overview",
  },
  {
    key: "sales",
    label: "Daily Cash-up",
    href: "/admin/sales",
    group: "Overview",
  },
  { key: "orders", label: "Orders", href: "/admin/orders", group: "Fulfillment" },
  {
    key: "counter-sale",
    label: "Counter Sale",
    href: "/admin/counter-sale",
    group: "Fulfillment",
  },
  {
    key: "customers",
    label: "Customers",
    href: "/admin/customers",
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

// --- Roles ----------------------------------------------------------------

/**
 * How much of the sales data a role may see. Page access alone was not enough:
 * a cashier granted the Customers page could read every customer's lifetime
 * spend, including the ones their colleagues served.
 */
export type DataScope =
  /** Everything, every shop. */
  | "all"
  /** Only sales at the shop this staff member is assigned to. */
  | "shop"
  /** Only sales this staff member rang up themselves. */
  | "own";

export type RoleKey =
  | "manager"
  | "supervisor"
  | "cashier"
  | "inventory"
  | "marketing";

export type StaffRole = {
  key: RoleKey;
  label: string;
  description: string;
  permissions: PageKey[];
  scope: DataScope;
  /** Supervisors answer for one shop, so the staff form asks which. */
  needsShop?: boolean;
};

export const STAFF_ROLES: StaffRole[] = [
  {
    key: "manager",
    label: "Manager",
    description: "Everything except Staff & Payroll. Sees all shops.",
    permissions: ["orders", "counter-sale", "customers", "products", "stock", "labels", "social"],
    scope: "all",
  },
  {
    key: "supervisor",
    label: "Shop Supervisor",
    description: "Runs one shop: sales, customers and stock for that shop only.",
    permissions: ["orders", "counter-sale", "customers", "stock"],
    scope: "shop",
    needsShop: true,
  },
  {
    key: "cashier",
    label: "Cashier",
    description: "Rings up sales. Sees only what they sold themselves.",
    permissions: ["counter-sale"],
    scope: "own",
  },
  {
    key: "inventory",
    label: "Stock & Catalog",
    description: "Products, stock and labels. No access to sales data.",
    permissions: ["products", "stock", "labels"],
    scope: "own",
  },
  {
    key: "marketing",
    label: "Marketing",
    description: "Social posting only. No access to sales data.",
    permissions: ["social"],
    scope: "own",
  },
];

export const DEFAULT_ROLE: RoleKey = "cashier";

export function isRoleKey(value: unknown): value is RoleKey {
  return STAFF_ROLES.some((role) => role.key === value);
}

export function getRole(key: string): StaffRole {
  return STAFF_ROLES.find((role) => role.key === key) ?? STAFF_ROLES[2];
}

// --- Account status -------------------------------------------------------

/** `pending` accounts exist but cannot log in until an admin approves them. */
export type StaffStatus = "pending" | "active" | "suspended";

export const STAFF_STATUSES: Array<{ key: StaffStatus; label: string }> = [
  { key: "pending", label: "Pending approval — cannot log in" },
  { key: "active", label: "Active — can log in" },
  { key: "suspended", label: "Suspended — cannot log in" },
];

export function isStaffStatus(value: unknown): value is StaffStatus {
  return value === "pending" || value === "active" || value === "suspended";
}

export function getPageByKey(key: string): AdminPage | undefined {
  return ADMIN_PAGES.find((page) => page.key === key);
}
