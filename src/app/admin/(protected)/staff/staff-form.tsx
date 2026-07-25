import { ASSIGNABLE_PAGES } from "@/lib/staff-permissions";
import type { StaffRecord } from "@/lib/staff";

const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#a07850] focus:ring-2 focus:ring-[#a07850]/20";
const labelClass = "mb-1.5 block text-[0.8rem] font-medium text-[#201d17]";

type StaffFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  staff?: StaffRecord;
  submitLabel: string;
};

export function StaffForm({ action, staff, submitLabel }: StaffFormProps) {
  const isEdit = Boolean(staff);
  // New staff default to Counter Sale access (their main duty).
  const defaultPermissions = staff?.permissions ?? ["counter-sale"];

  return (
    <form action={action} className="mt-8 max-w-2xl space-y-5">
      {staff ? <input type="hidden" name="id" value={staff.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>
            Username <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="username"
            required
            autoComplete="off"
            defaultValue={staff?.username ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>
            Password{" "}
            {isEdit ? (
              <span className="text-[#8d7a5c]">(leave blank to keep)</span>
            ) : (
              <span className="text-red-500">*</span>
            )}
          </label>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder={isEdit ? "••••••" : "Min 6 characters"}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="fullName"
            required
            defaultValue={staff?.fullName ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Position</label>
          <input
            type="text"
            name="position"
            placeholder="e.g. Counter Staff"
            defaultValue={staff?.position ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Phone</label>
          <input
            type="text"
            name="phone"
            defaultValue={staff?.phone ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            name="email"
            defaultValue={staff?.email ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>IC number</label>
          <input
            type="text"
            name="icNumber"
            defaultValue={staff?.icNumber ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Join date</label>
          <input
            type="date"
            name="joinDate"
            defaultValue={staff?.joinDate ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Bank name</label>
          <input
            type="text"
            name="bankName"
            defaultValue={staff?.bankName ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Bank account no.</label>
          <input
            type="text"
            name="bankAccount"
            defaultValue={staff?.bankAccount ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Basic salary (RM)</label>
          <input
            type="number"
            name="baseSalary"
            min={0}
            step="0.01"
            defaultValue={staff?.baseSalary ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <fieldset className="rounded-2xl border border-black/10 p-4">
        <legend className="px-2 text-[0.8rem] font-semibold text-[#201d17]">
          Page access
        </legend>
        <p className="mb-3 px-1 text-xs text-[#8d7a5c]">
          Tick the admin pages this staff can open and use.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {ASSIGNABLE_PAGES.map((page) => (
            <label
              key={page.key}
              className="flex items-center gap-2.5 rounded-xl border border-black/8 px-3 py-2.5 text-sm text-[#201d17]"
            >
              <input
                type="checkbox"
                name="permissions"
                value={page.key}
                defaultChecked={defaultPermissions.includes(page.key)}
                className="h-4 w-4 accent-[#201d17]"
              />
              <span>{page.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {isEdit ? (
        <div>
          <label className={labelClass}>Account status</label>
          <select
            name="isActive"
            defaultValue={staff?.isActive ? "true" : "false"}
            className={inputClass}
          >
            <option value="true">Active — can log in</option>
            <option value="false">Disabled — cannot log in</option>
          </select>
        </div>
      ) : null}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="rounded-xl bg-[#201d17] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2e2a22]"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
