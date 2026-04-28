import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_COOKIE_NAME = "aerthera_admin_session";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 14;

function getAdminConfig() {
  return {
    username: process.env.ADMIN_USERNAME?.trim() || "admin",
    password: process.env.ADMIN_PASSWORD?.trim() || "",
    sessionSecret:
      process.env.ADMIN_SESSION_SECRET?.trim() ||
      process.env.ADMIN_PASSWORD?.trim() ||
      "",
  };
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function buildSessionSignature(username: string) {
  const { sessionSecret } = getAdminConfig();

  if (!sessionSecret) {
    return "";
  }

  return createHmac("sha256", sessionSecret)
    .update(`aerthera-admin:${username}`)
    .digest("hex");
}

function getExpectedSessionValue() {
  const { username } = getAdminConfig();
  return `${username}:${buildSessionSignature(username)}`;
}

export function getAdminUsername() {
  return getAdminConfig().username;
}

export function isAdminConfigured() {
  const { password, sessionSecret } = getAdminConfig();
  return Boolean(password && sessionSecret);
}

export function validateAdminCredentials(username: string, password: string) {
  const config = getAdminConfig();

  if (!config.password) {
    return false;
  }

  return (
    safeCompare(username.trim(), config.username) &&
    safeCompare(password, config.password)
  );
}

export async function hasAdminSession() {
  if (!isAdminConfigured()) {
    return false;
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const expectedValue = getExpectedSessionValue();

  return Boolean(
    cookieValue && expectedValue && safeCompare(cookieValue, expectedValue),
  );
}

export async function createAdminSession() {
  if (!isAdminConfigured()) {
    throw new Error("Admin login is not configured.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, getExpectedSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: "/admin",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/admin",
  });
}

export async function requireAdminSession(nextPath = "/admin/orders") {
  if (!(await hasAdminSession())) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }
}
