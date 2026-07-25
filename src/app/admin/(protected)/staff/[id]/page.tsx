import Link from "next/link";
import { notFound } from "next/navigation";
import { createPayslipAction, updateStaffAction } from "@/app/admin/actions";
import { requireAdminActor } from "@/lib/staff-auth";
import { getStaffById, listPayslipsForStaff } from "@/lib/staff";
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

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

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
