import "server-only";

import { timingSafeEqual } from "crypto";

/**
 * Public staff sign-up, off by default.
 *
 * A registration form on a live shop is a door: while there is only one person
 * running the shop there is nothing to gain from it and a spam queue to lose,
 * so `/join` answers 404 until this is switched on. The code is not commented
 * out — it stays type-checked and linted so it still works the day it is needed.
 */
export function isStaffSelfRegistrationEnabled() {
  const value = process.env.STAFF_SELF_REGISTRATION?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function getInviteCode() {
  return process.env.STAFF_INVITE_CODE?.trim() ?? "";
}

/**
 * Compared in constant time: a plain `===` leaks the code one character at a
 * time to anyone willing to measure how long the answer takes.
 */
export function isValidStaffInviteCode(candidate: string) {
  const expected = getInviteCode();
  // No code configured means nobody can join, rather than everybody.
  if (!expected) return false;

  const a = Buffer.from(candidate.trim());
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
