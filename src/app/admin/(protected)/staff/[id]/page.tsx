import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createPayslipAction,
  setStaffStatusAction,
  updateStaffAction,
} from "@/app/admin/actions";
import { requireAdminActor } from "@/lib/staff-auth";
import { getStaffById, listPayslipsForStaff } from "@/lib/staff";
import { formatShopDateTime, shopYearMonth } from "@/lib/datetime";
import { getRole } from "@/lib/staff-permissions";
import { formatMoney } from "@/lib/money";
import { formatPeriod } from "@/lib/payroll";
import { StaffForm } from "../staff-form";
import { PayslipForm } from "../payslip-form";

type StaffDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  "missing-fields": "Username and full name are required.",
  "weak-password": "Password must be at least 6 characters.",
  "bad-period": "Enter a valid payslip month and year.",
};

export default async function StaffDetailPage({
  params,
  searchParams,
}: StaffDetailPageProps) {
  await requireAdminActor("/admin/staff");
  const { id } = await params;
  const { saved, error } = await searchParams;

  const staff = await getStaffById(id);
  if (!staff) notFound();

  const payslips = await listPayslipsForStaff(id);
  const message = error ? (ERROR_MESSAGES[error] ?? error) : null;

  // Shop time, not server time: on the 1st before 8am the server clock is
  // still in the month that just closed, which would default the payslip to it.
  const { year: currentYear, month: currentMonth } = shopYearMonth();

  return (
    <div>
      <Link href="/admin/staff" className="text-sm text-[#8d7a5c] hover:text-[#201d17]">
        ← Back to staff
      </Link>
      <h2 className="mt-3 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
        {staff.fullName}
      </h2>
      <p className="mt-2 text-sm text-[#5d574f]">
        {staff.position || "Staff"} · @{staff.username}
      </p>

      {saved ? (
        <p className="mt-6 max-w-2xl rounded-[1.25rem] border border-[#8cc8a4] bg-[#e9f7ee] px-4 py-3 text-sm text-[#256542]">
          Saved.
        </p>
      ) : null}
      {message ? (
        <p className="mt-6 max-w-2xl rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-4 py-3 text-sm text-[#8b5e1d]">
          {message}
        </p>
      ) : null}

      {/*
        Approval is its own button, not a side effect of Save. Editing someone's
        phone number and granting them access to the shop's sales are different
        decisions and should take different clicks.
      */}
      <section
        className={`mt-8 rounded-[1.25rem] border p-5 ${
          staff.status === "active"
            ? "border-black/8 bg-white"
            : "border-[#d4b16c] bg-[#faf1df]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
              Account status
            </p>
            <p className="mt-1 text-sm text-[#201d17]">
              {staff.status === "active"
                ? "Approved — this account can log in."
                : staff.status === "pending"
                  ? "Waiting for your approval. It cannot log in yet."
                  : "Suspended. It cannot log in."}
              {staff.approvedBy ? (
                <span className="block text-xs text-[#8d7a5c]">
                  Approved by {staff.approvedBy}
                  {staff.approvedAt ? ` · ${formatShopDateTime(staff.approvedAt)}` : ""}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex gap-2">
            {staff.status === "active" ? (
              <form action={setStaffStatusAction}>
                <input type="hidden" name="id" value={staff.id} />
                <input type="hidden" name="status" value="suspended" />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center rounded-full border border-[#e6b4b4] px-5 text-xs font-semibold text-[#9b3d32] transition hover:bg-[#fff0ef]"
                >
                  Suspend access
                </button>
              </form>
            ) : (
              <form action={setStaffStatusAction}>
                <input type="hidden" name="id" value={staff.id} />
                <input type="hidden" name="status" value="active" />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center rounded-full bg-[#201d17] px-5 text-xs font-semibold text-white transition hover:bg-[#2e2a22]"
                >
                  Approve as {getRole(staff.role).label}
                </button>
              </form>
            )}
          </div>
        </div>
        {staff.status !== "active" ? (
          <p className="mt-3 text-xs leading-5 text-[#8b5e1d]">
            Check the type of staff below first — approving grants whatever that
            role allows.
          </p>
        ) : null}
      </section>

      <section className="mt-8">
        <h3 className="font-display text-[1.4rem] tracking-[-0.03em] text-[#201d17]">
          Account &amp; access
        </h3>
        <StaffForm action={updateStaffAction} staff={staff} submitLabel="Save Changes" />
      </section>

      <section className="mt-12 border-t border-black/8 pt-8">
        <h3 className="font-display text-[1.4rem] tracking-[-0.03em] text-[#201d17]">
          Payslips
        </h3>

        {payslips.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-black/8 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-black/8 bg-[#faf6ef] text-[0.68rem] uppercase tracking-[0.12em] text-[#8d7a5c]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Period</th>
                    <th className="px-4 py-3 font-semibold">Gross</th>
                    <th className="px-4 py-3 font-semibold">Net</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((slip) => (
                    <tr key={slip.id} className="border-b border-black/5 last:border-0">
                      <td className="px-4 py-3 font-medium text-[#201d17]">
                        {formatPeriod(slip.periodMonth, slip.periodYear)}
                      </td>
                      <td className="px-4 py-3 text-[#5d574f]">
                        {formatMoney(slip.gross)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#201d17]">
                        {formatMoney(slip.net)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.66rem] font-semibold uppercase tracking-[0.12em] ${
                            slip.issuedAt
                              ? "bg-[#e9f7ee] text-[#256542]"
                              : "bg-[#f8f1e4] text-[#8b5e1d]"
                          }`}
                        >
                          {slip.issuedAt ? "Issued" : "Draft"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/payslips/${slip.id}`}
                          className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-semibold text-[#201d17] transition hover:bg-[#f7f2ea]"
                        >
                          View / Download
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#8d7a5c]">No payslips yet.</p>
        )}

        <div className="mt-8 rounded-[1.5rem] border border-black/8 bg-white p-6">
          <h4 className="font-semibold text-[#201d17]">Create / update payslip</h4>
          <p className="mt-1 text-xs text-[#8d7a5c]">
            EPF, SOCSO and EIS are calculated automatically. Saving an existing
            month overwrites it.
          </p>
          <PayslipForm
            action={createPayslipAction}
            staffId={staff.id}
            defaultBasic={staff.baseSalary ?? 0}
            currentYear={currentYear}
            currentMonth={currentMonth}
          />
        </div>
      </section>
    </div>
  );
}
