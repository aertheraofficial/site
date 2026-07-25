import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActor } from "@/lib/staff-auth";
import { getPayslipById } from "@/lib/staff";
import { formatMoney } from "@/lib/money";
import { formatPeriod } from "@/lib/payroll";
import { PrintButton } from "./print-button";

type PayslipPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PayslipPage({ params }: PayslipPageProps) {
  const { id } = await params;
  const actor = await requireActor(`/admin/payslips/${id}`);

  const record = await getPayslipById(id);
  if (!record) notFound();

  const { payslip, staff } = record;
  const isOwner = actor.type === "staff" && actor.staff.id === staff.id;

  // Staff can only see their own, issued payslips. Admin sees everything.
  if (actor.type !== "admin" && !isOwner) redirect("/admin/profile?denied=1");
  if (actor.type !== "admin" && !payslip.issuedAt) redirect("/admin/profile?denied=1");

  const backHref = actor.type === "admin" ? `/admin/staff/${staff.id}` : "/admin/profile";

  const earnings = [
    { label: "Basic salary", value: payslip.basic },
    { label: "Allowances", value: payslip.allowances },
  ].filter((row) => row.value > 0 || row.label === "Basic salary");

  const deductions = [
    { label: "EPF (employee, 11%)", value: payslip.epfEmployee },
    { label: "SOCSO", value: payslip.socsoEmployee },
    { label: "EIS", value: payslip.eisEmployee },
    { label: "PCB / income tax", value: payslip.pcb },
    { label: "Other deductions", value: payslip.otherDeductions },
  ].filter((row) => row.value > 0);

  const totalDeductions =
    payslip.epfEmployee +
    payslip.socsoEmployee +
    payslip.eisEmployee +
    payslip.pcb +
    payslip.otherDeductions;

  return (
    <div>
      <style>{`@media print {
        header, .no-print { display: none !important; }
        main { padding: 0 !important; }
        body { background: #fff !important; }
        .payslip-sheet { border: none !important; box-shadow: none !important; }
      }`}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="text-sm text-[#8d7a5c] hover:text-[#201d17]">
          ← Back
        </Link>
        <PrintButton />
      </div>

      <div className="payslip-sheet mx-auto mt-6 max-w-2xl rounded-[1.25rem] border border-black/10 bg-white p-8 sm:p-10">
        {/* Company header */}
        <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-6">
          <div>
            <p className="font-display text-[1.7rem] leading-none tracking-[-0.04em] text-[#201d17]">
              Aerthera Sdn Bhd
            </p>
            <p className="mt-2 text-xs leading-5 text-[#8d7a5c]">
              Salary Slip · Private &amp; Confidential
            </p>
          </div>
          <div className="text-right">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#8d7a5c]">
              Pay period
            </p>
            <p className="mt-1 font-semibold text-[#201d17]">
              {formatPeriod(payslip.periodMonth, payslip.periodYear)}
            </p>
            {!payslip.issuedAt ? (
              <span className="mt-2 inline-flex rounded-full bg-[#f8f1e4] px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[#8b5e1d]">
                Draft — not issued
              </span>
            ) : null}
          </div>
        </div>

        {/* Employee details */}
        <div className="grid gap-4 border-b border-black/10 py-6 text-sm sm:grid-cols-2">
          <Detail label="Employee" value={staff.fullName} />
          <Detail label="Position" value={staff.position || "—"} />
          <Detail label="IC number" value={staff.icNumber || "—"} />
          <Detail label="Join date" value={staff.joinDate || "—"} />
          <Detail label="Bank" value={staff.bankName || "—"} />
          <Detail label="Account no." value={staff.bankAccount || "—"} />
        </div>

        {/* Earnings + deductions */}
        <div className="grid gap-8 py-6 sm:grid-cols-2">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#8d7a5c]">
              Earnings
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              {earnings.map((row) => (
                <LineRow key={row.label} label={row.label} value={row.value} />
              ))}
              <div className="border-t border-black/10 pt-2">
                <LineRow label="Gross pay" value={payslip.gross} strong />
              </div>
            </dl>
          </div>
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#8d7a5c]">
              Deductions
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              {deductions.length > 0 ? (
                deductions.map((row) => (
                  <LineRow key={row.label} label={row.label} value={row.value} />
                ))
              ) : (
                <p className="text-sm text-[#8d7a5c]">No deductions</p>
              )}
              <div className="border-t border-black/10 pt-2">
                <LineRow label="Total deductions" value={totalDeductions} strong />
              </div>
            </dl>
          </div>
        </div>

        {/* Net pay */}
        <div className="flex items-center justify-between rounded-2xl bg-[#201d17] px-6 py-5 text-white">
          <span className="text-sm font-semibold uppercase tracking-[0.16em] text-white/80">
            Net pay
          </span>
          <span className="font-display text-[1.8rem] tracking-[-0.03em]">
            {formatMoney(payslip.net)}
          </span>
        </div>

        <p className="mt-4 text-xs leading-5 text-[#8d7a5c]">
          Employer EPF contribution: {formatMoney(payslip.epfEmployer)} (not deducted
          from employee). {payslip.notes ? `Note: ${payslip.notes}` : ""}
        </p>
        <p className="mt-2 text-xs leading-5 text-[#b3a894]">
          This is a computer-generated payslip. Statutory figures are computed at
          standard Malaysian rates and may be adjusted for your exact contribution
          bracket.
        </p>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#8d7a5c]">
        {label}
      </p>
      <p className="mt-1 text-[#201d17]">{value}</p>
    </div>
  );
}

function LineRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[#5d574f]">{label}</dt>
      <dd className={strong ? "font-semibold text-[#201d17]" : "text-[#201d17]"}>
        {formatMoney(value)}
      </dd>
    </div>
  );
}
