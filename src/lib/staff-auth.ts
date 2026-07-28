import "server-only";

import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminUsername, hasAdminSession } from "@/lib/admin-auth";
import {
  getStaffAuthByUsername,
  getStaffById,
  isStaffStoreConfigured,
  type StaffRecord,
} from "@/lib/staff";
import { getRole, type PageKey } from "@/lib/staff-permissions";

const STAFF_COOKIE_NAME = "aerthera_staff_session";
const STAFF_SESSION_MAX_AGE = 60 * 60 * 24 * 14;

function getSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    ""
  );
}

// --- Password hashing (Node scrypt, no external deps) ---

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  const expected = Buffer.from(hash, "hex");
  const test = scryptSync(password, salt, 64);
  return test.length === expected.length && timingSafeEqual(test, expected);
}

// --- Staff session cookie ---

function signStaff(staffId: string): string {
  const secret = getSessionSecret();
  if (!secret) return "";
  return createHmac("sha256", secret)
    .update(`aerthera-staff:${staffId}`)
    .digest("hex");
}

function safeCompare(left: string, right: string): boolean {
  const l = Buffer.from(left);
  const r = Buffer.from(right);
  return l.length === r.length && timingSafeEqual(l, r);
}

export async function createStaffSession(staffId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(STAFF_COOKIE_NAME, `${staffId}:${signStaff(staffId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: STAFF_SESSION_MAX_AGE,
    path: "/admin",
  });
}

export async function clearStaffSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(STAFF_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/admin",
  });
}

async function getStaffIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(STAFF_COOKIE_NAME)?.value;
  if (!value) return null;
  const [id, signature] = value.split(":");
  if (!id || !signature) return null;
  const expected = signStaff(id);
  if (!expected || !safeCompare(signature, expected)) return null;
  return id;
}

/** Verify staff credentials for login. Returns the staff id or null. */
export async function authenticateStaff(
  username: string,
  password: string,
): Promise<string | null> {
  if (!isStaffStoreConfigured()) return null;
  try {
    const auth = await getStaffAuthByUsername(username);
    // Only an approved account may log in. A pending sign-up has a real
    // password but no access until an admin says so.
    if (!auth || auth.status !== "active") return null;
    if (!verifyPassword(password, auth.passwordHash)) return null;
    return auth.id;
  } catch {
    return null;
  }
}

// --- Actor (who is logged in) + permission guards ---

export type Actor =
  | { type: "admin"; name: string }
  | { type: "staff"; staff: StaffRecord };

export async function getActor(): Promise<Actor | null> {
  if (await hasAdminSession()) {
    return { type: "admin", name: getAdminUsername() };
  }
  const staffId = await getStaffIdFromCookie();
  if (!staffId) return null;
  try {
    // Checked on every request, not just at login, so suspending an account
    // ends the session that is already open rather than waiting for it to expire.
    const staff = await getStaffById(staffId);
    if (staff && staff.status === "active") return { type: "staff", staff };
  } catch {
    // fall through
  }
  return null;
}

export function actorHasPermission(actor: Actor, key: PageKey): boolean {
  return actor.type === "admin" || actor.staff.permissions.includes(key);
}

/**
 * How much of the sales data this actor may see.
 *
 * Page permissions alone were not enough: a cashier who was granted the
 * Customers page could read every customer's lifetime spend, including the ones
 * their colleagues served. The role decides the scope, and the pages enforce it,
 * so an over-generous tick box can no longer leak the whole book.
 */
export type ActorScope =
  | { kind: "all" }
  | { kind: "shop"; location: string }
  | { kind: "own"; staffId: string };

export function getActorScope(actor: Actor): ActorScope {
  if (actor.type === "admin") return { kind: "all" };

  const role = getRole(actor.staff.role);

  if (role.scope === "all") return { kind: "all" };

  // A supervisor with no shop assigned would otherwise see everything, so fall
  // back to their own sales rather than opening it up.
  if (role.scope === "shop" && actor.staff.shopLocation) {
    return { kind: "shop", location: actor.staff.shopLocation };
  }

  return { kind: "own", staffId: actor.staff.id };
}

/** Whether a single order is inside this actor's scope. */
export function scopeAllowsOrder(
  scope: ActorScope,
  order: { soldById: string | null; location: string | null },
): boolean {
  switch (scope.kind) {
    case "all":
      return true;
    case "shop":
      return order.location === scope.location;
    case "own":
      return order.soldById === scope.staffId;
  }
}

export function isAdminActor(actor: Actor): boolean {
  return actor.type === "admin";
}

/** Ensure someone (admin or active staff) is logged in. */
export async function requireActor(nextPath = "/admin"): Promise<Actor> {
  const actor = await getActor();
  if (!actor) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }
  return actor;
}

/** Ensure the logged-in actor may access a specific page. */
export async function requirePermission(
  key: PageKey,
  nextPath = "/admin",
): Promise<Actor> {
  const actor = await requireActor(nextPath);
  if (!actorHasPermission(actor, key)) {
    redirect("/admin/profile?denied=1");
  }
  return actor;
}

/** Admin-only guard (master admin credentials, not staff). */
export async function requireAdminActor(nextPath = "/admin"): Promise<Actor> {
  const actor = await requireActor(nextPath);
  if (actor.type !== "admin") {
    redirect("/admin/profile?denied=1");
  }
  return actor;
}
