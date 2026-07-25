"use client";

import { useMemo, useState } from "react";
import { calcPayroll, MONTH_NAMES } from "@/lib/payroll";
import { formatMoney } from "@/lib/money";

const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#a07850] focus:ring-2 focus:ring-[#a07850]/20";
const labelClass = "mb-1.5 block text-[0.8rem] font-medium text-[#201d17]";

type PayslipFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  staffId: string;
  defaultBasic: number;
  currentYear: number;
  currentMonth: number;
};

export function PayslipForm({
  action,
  staffId,
  defaultBasic,
  currentYear,
  currentMonth,
}: PayslipFormProps) {
  const [basic, setBasic] = useState(defaultBasic ? String(defaultBasic) : "");
  const [allowances, setAllowances] = useState("");
  const [pcb, setPcb] = useState("");
  const [otherDeductions, setOtherDeductions] = useState("");

  const result = useMemo(
    () =>
      calcPayroll({
        basic: Number(basic) || 0,
        allowances: Number(allowances) || 0,
        pcb: Number(pcb) || 0,
        otherDeductions: Number(otherDeductions) || 0,
      }),
    [basic, allowances, pcb, otherDeductions],
  );

  return (
    <form action={action} className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <input type="hidden" name="staffId" value={staffId} />

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Month</label>
            <select name="periodMonth" defaultValue={currentMonth} className={inputClass}>
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Year</label>
            <input
              type="number"
              name="periodYear"
              defaultValue={currentYear}
              min={2000}
              max={2100}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Basic salary (RM)</label>
            <input
              type="number"
              name="basic"
              min={0}
              step="0.01"
              value={basic}
              onChange={(e) => setBasic(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Allowances (RM)</label>
            <input
              type="number"
              name="allowances"
              min={0}
              step="0.01"
              value={allowances}
              onChange={(e) => setAllowances(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>PCB / tax (RM)</label>
            <input
              type="number"
              name="pcb"
              min={0}
              step="0.01"
              value={pcb}
              onChange={(e) => setPcb(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Other deductions (RM)</label>
            <input
              type="number"
              name="otherDeductions"
              min={0}
              step="0.01"
              value={otherDeductions}
              onChange={(e) => setOtherDeductions(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Notes (optional)</label>
          <input type="text" name="notes" className={inputClass} />
        </div>

        <label className="flex items-center gap-2.5 text-sm text-[#201d17]">
          <input
            type="checkbox"
            name="issued"
            value="true"
            defaultChecked
            className="h-4 w-4 accent-[#201d17]"
          />
          Mark as issued (staff can download it)
        </label>

        <button
          type="submit"
          className="rounded-xl bg-[#201d17] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2e2a22]"
        >
          Save &amp; View Payslip
        </button>
      </div>

      {/* Live preview */}
      <div className="rounded-2xl border border-black/10 bg-[#faf6ef] p-5">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
          Live preview
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Basic" value={formatMoney(result.basic)} />
          <Row label="Allowances" value={formatMoney(result.allowances)} />
          <div className="my-2 border-t border-black/10" />
          <Row label="Gross" value={formatMoney(result.gross)} strong />
          <Row label="EPF (11%)" value={`- ${formatMoney(result.epfEmployee)}`} muted />
          <Row label="SOCSO" value={`- ${formatMoney(result.socsoEmployee)}`} muted />
          <Row label="EIS" value={`- ${formatMoney(result.eisEmployee)}`} muted />
          <Row label="PCB" value={`- ${formatMoney(result.pcb)}`} muted />
          {result.otherDeductions > 0 ? (
            <Row
              label="Other"
              value={`- ${formatMoney(result.otherDeductions)}`}
              muted
            />
          ) : null}
          <div className="my-2 border-t border-black/10" />
          <Row label="Net pay" value={formatMoney(result.net)} strong />
        </dl>
        <p className="mt-4 text-xs leading-5 text-[#8d7a5c]">
          Employer EPF ({formatMoney(result.epfEmployer)}) is recorded for reference
          and not deducted from the employee.
        </p>
      </div>
    </form>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? "text-[#8d7a5c]" : "text-[#5d574f]"}>{label}</dt>
      <dd
        className={
          strong ? "font-semibold text-[#201d17]" : "text-[#201d17]"
        }
      >
        {value}
      </dd>
    </div>
  );
}
