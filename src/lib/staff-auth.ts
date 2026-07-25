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
import type { PageKey } from "@/lib/staff-permissions";

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
    if (!auth || !auth.isActive) return null;
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
    const staff = await getStaffById(staffId);
    if (staff && staff.isActive) return { type: "staff", staff };
  } catch {
    // fall through
  }
  return null;
}

export function actorHasPermission(actor: Actor, key: PageKey): boolean {
  return actor.type === "admin" || actor.staff.permissions.includes(key);
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
