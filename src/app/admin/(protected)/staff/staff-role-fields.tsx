"use client";

import { useState } from "react";
import {
  STAFF_ROLES,
  STAFF_STATUSES,
  getRole,
  type RoleKey,
  type StaffStatus,
} from "@/lib/staff-permissions";

type StaffRoleFieldsProps = {
  defaultRole: RoleKey;
  defaultShopLocation: string;
  defaultStatus: StaffStatus;
  shops: Array<{ id: string; name: string }>;
};

const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59]";
const labelClass =
  "mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#8d7a5c]";

/**
 * Role picker for a staff account.
 *
 * Replaces a grid of per-page tick boxes. Ticking six boxes one at a time is
 * where an admin accidentally hands a cashier the Social account — which posts
 * publicly and spends the ad budget. A named role cannot be half-ticked, and
 * what it grants is spelled out on screen before the form is saved.
 */
export function StaffRoleFields({
  defaultRole,
  defaultShopLocation,
  defaultStatus,
  shops,
}: StaffRoleFieldsProps) {
  const [roleKey, setRoleKey] = useState<RoleKey>(defaultRole);
  const [status, setStatus] = useState<StaffStatus>(defaultStatus);

  const role = getRole(roleKey);
  // Only a live account with sight beyond its own sales is worth an extra
  // confirmation — a pending cashier can see nothing yet.
  const needsConfirmation = status === "active" && role.scope !== "own";

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass} htmlFor="staff-role">
          Type of staff
        </label>
        <select
          id="staff-role"
          name="role"
          value={roleKey}
          onChange={(event) => setRoleKey(event.target.value as RoleKey)}
          className={inputClass}
        >
          {STAFF_ROLES.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="mt-3 rounded-2xl border border-black/8 bg-[#faf6ef] p-4">
          <p className="text-sm text-[#201d17]">{role.description}</p>
          <p className="mt-2 text-xs leading-5 text-[#5d574f]">
            <span className="font-semibold">Can open:</span>{" "}
            {role.permissions.length > 0
              ? role.permissions.join(", ")
              : "nothing yet"}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#5d574f]">
            <span className="font-semibold">Sales they can see:</span>{" "}
            {role.scope === "all"
              ? "every sale, every shop"
              : role.scope === "shop"
                ? "every sale at their shop"
                : "only the sales they made themselves"}
          </p>
        </div>
      </div>

      {role.needsShop ? (
        <div>
          <label className={labelClass} htmlFor="staff-shop">
            Shop they are responsible for
          </label>
          <select
            id="staff-shop"
            name="shopLocation"
            defaultValue={defaultShopLocation}
            className={inputClass}
          >
            <option value="">Choose a shop…</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-[#8d7a5c]">
            Without a shop, a supervisor falls back to seeing only their own
            sales.
          </p>
        </div>
      ) : null}

      <div>
        <label className={labelClass} htmlFor="staff-status">
          Account status
        </label>
        <select
          id="staff-status"
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as StaffStatus)}
          className={inputClass}
        >
          {STAFF_STATUSES.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {needsConfirmation ? (
        <label className="flex items-start gap-3 rounded-2xl border border-[#d4b16c] bg-[#faf1df] p-4 text-sm leading-6 text-[#8b5e1d]">
          <input
            type="checkbox"
            name="confirmElevated"
            required
            className="mt-1 h-4 w-4 accent-[#8b5e1d]"
          />
          <span>
            I understand this account will be able to see{" "}
            {role.scope === "all" ? "every sale in every shop" : "every sale at its shop"}
            , including customers&apos; contact details and what they spent.
          </span>
        </label>
      ) : null}
    </div>
  );
}
