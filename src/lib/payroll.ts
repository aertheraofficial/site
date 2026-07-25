/**
 * Malaysian payroll statutory calculations for staff payslips.
 *
 * Rates approximate the official schedules (EPF, SOCSO, EIS). SOCSO/EIS
 * officially use contribution bands; here we apply the standard employee
 * percentages against the wage ceiling, which is accurate enough for a payslip
 * and easy to reason about. PCB (monthly tax deduction) is entered manually.
 */

export type PayrollInput = {
  basic: number;
  allowances: number;
  /** Monthly tax deduction (PCB/MTD) — entered by admin, not auto-derived. */
  pcb?: number;
  /** Any additional deductions (advances, unpaid leave, ...). */
  otherDeductions?: number;
};

export type PayrollResult = {
  basic: number;
  allowances: number;
  gross: number;
  epfEmployee: number;
  epfEmployer: number;
  socsoEmployee: number;
  eisEmployee: number;
  pcb: number;
  otherDeductions: number;
  totalDeductions: number;
  net: number;
};

const SOCSO_WAGE_CEILING = 6000;
const EIS_WAGE_CEILING = 6000;

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** EPF employee share is 11%, rounded up to the next ringgit. */
export function calcEpfEmployee(gross: number) {
  return Math.ceil(gross * 0.11);
}

/** EPF employer share: 13% for wages up to RM5,000, otherwise 12%. */
export function calcEpfEmployer(gross: number) {
  const rate = gross <= 5000 ? 0.13 : 0.12;
  return Math.ceil(gross * rate);
}

/** SOCSO employee share ~0.5% of wages, capped at the RM6,000 ceiling. */
export function calcSocsoEmployee(gross: number) {
  return round2(Math.min(gross, SOCSO_WAGE_CEILING) * 0.005);
}

/** EIS employee share ~0.2% of wages, capped at the RM6,000 ceiling. */
export function calcEisEmployee(gross: number) {
  return round2(Math.min(gross, EIS_WAGE_CEILING) * 0.002);
}

export function calcPayroll(input: PayrollInput): PayrollResult {
  const basic = Math.max(0, input.basic || 0);
  const allowances = Math.max(0, input.allowances || 0);
  const pcb = Math.max(0, input.pcb || 0);
  const otherDeductions = Math.max(0, input.otherDeductions || 0);

  const gross = round2(basic + allowances);
  const epfEmployee = calcEpfEmployee(gross);
  const epfEmployer = calcEpfEmployer(gross);
  const socsoEmployee = calcSocsoEmployee(gross);
  const eisEmployee = calcEisEmployee(gross);

  const totalDeductions = round2(
    epfEmployee + socsoEmployee + eisEmployee + pcb + otherDeductions,
  );
  const net = round2(gross - totalDeductions);

  return {
    basic,
    allowances,
    gross,
    epfEmployee,
    epfEmployer,
    socsoEmployee,
    eisEmployee,
    pcb,
    otherDeductions,
    totalDeductions,
    net,
  };
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatPeriod(month: number, year: number) {
  const name = MONTH_NAMES[month - 1] ?? `M${month}`;
  return `${name} ${year}`;
}
