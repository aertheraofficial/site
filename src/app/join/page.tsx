import { notFound } from "next/navigation";
import { submitStaffApplicationAction } from "@/app/admin/actions";
import {
  isStaffSelfRegistrationEnabled,
  isValidStaffInviteCode,
} from "@/lib/staff-signup";

type JoinPageProps = {
  searchParams: Promise<{ code?: string; error?: string; submitted?: string }>;
};

const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59]";
const labelClass = "mb-1.5 block text-[0.8rem] font-medium text-[#201d17]";

/**
 * Staff sign-up, reachable only with a valid invite code and only while the
 * feature is switched on. A wrong or missing code renders the same 404 as a
 * page that does not exist — telling a stranger "wrong code" would confirm the
 * form is there and invite guessing.
 */
export default async function JoinPage({ searchParams }: JoinPageProps) {
  if (!isStaffSelfRegistrationEnabled()) notFound();

  const { code = "", error, submitted } = await searchParams;
  if (!isValidStaffInviteCode(code)) notFound();

  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8d7a5c]">
        Aerthera
      </p>
      <h1 className="mt-2 font-display text-[2.2rem] leading-none tracking-[-0.05em] text-[#201d17]">
        Join the team
      </h1>
      <p className="mt-3 text-sm leading-6 text-[#5d574f]">
        Fill this in and an admin will review it. You will not be able to log in
        until your account is approved.
      </p>

      {submitted ? (
        <p className="mt-6 rounded-[1.25rem] border border-[#8cc8a4] bg-[#e9f7ee] px-4 py-3 text-sm leading-6 text-[#256542]">
          Thank you — your details have been sent to the admin. You will be able
          to log in once your account is approved.
        </p>
      ) : null}
      {error ? (
        <p className="mt-6 rounded-[1.25rem] border border-[#e6b4b4] bg-[#fff0ef] px-4 py-3 text-sm leading-6 text-[#9b3d32]">
          {error === "missing-fields"
            ? "Full name, username and a password of at least 6 characters are required."
            : error}
        </p>
      ) : null}

      <form action={submitStaffApplicationAction} className="mt-8 space-y-5">
        <input type="hidden" name="code" value={code} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="join-fullName">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              id="join-fullName"
              type="text"
              name="fullName"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="join-position">
              Position you are applying for
            </label>
            <input
              id="join-position"
              type="text"
              name="position"
              placeholder="e.g. Counter Staff"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="join-username">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              id="join-username"
              type="text"
              name="username"
              required
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="join-password">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="join-password"
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Min 6 characters"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="join-phone">
              Phone
            </label>
            <input id="join-phone" type="tel" name="phone" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="join-email">
              Email
            </label>
            <input id="join-email" type="email" name="email" className={inputClass} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="join-ic">
              IC number
            </label>
            <input id="join-ic" type="text" name="icNumber" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="join-bank">
              Bank name
            </label>
            <input id="join-bank" type="text" name="bankName" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="join-account">
              Bank account no.
            </label>
            <input
              id="join-account"
              type="text"
              name="bankAccount"
              className={inputClass}
            />
          </div>
        </div>

        <button
          type="submit"
          className="rounded-full bg-[#201d17] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2e2a22]"
        >
          Send for approval
        </button>
      </form>
    </main>
  );
}
