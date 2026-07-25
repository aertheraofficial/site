import "server-only";

import {
  getSupabaseAdmin,
  isSupabaseOrderStoreConfigured,
} from "@/lib/supabase-admin";
import { isPageKey, type PageKey } from "@/lib/staff-permissions";

export type StaffRecord = {
  id: string;
  username: string;
  fullName: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  icNumber: string | null;
  bankName: string | null;
  bankAccount: string | null;
  joinDate: string | null;
  baseSalary: number | null;
  permissions: PageKey[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PayslipRecord = {
  id: string;
  staffId: string;
  periodMonth: number;
  periodYear: number;
  basic: number;
  allowances: number;
  epfEmployee: number;
  epfEmployer: number;
  socsoEmployee: number;
  eisEmployee: number;
  pcb: number;
  otherDeductions: number;
  gross: number;
  net: number;
  notes: string | null;
  issuedAt: string | null;
  createdAt: string;
};

type StaffRow = {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  ic_number: string | null;
  bank_name: string | null;
  bank_account: string | null;
  join_date: string | null;
  base_salary: number | string | null;
  permissions: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type PayslipRow = {
  id: string;
  staff_id: string;
  period_month: number;
  period_year: number;
  basic: number | string;
  allowances: number | string;
  epf_employee: number | string;
  epf_employer: number | string;
  socso_employee: number | string;
  eis_employee: number | string;
  pcb: number | string;
  other_deductions: number | string;
  gross: number | string;
  net: number | string;
  notes: string | null;
  issued_at: string | null;
  created_at: string;
};

function num(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapStaff(row: StaffRow): StaffRecord {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    position: row.position,
    phone: row.phone,
    email: row.email,
    icNumber: row.ic_number,
    bankName: row.bank_name,
    bankAccount: row.bank_account,
    joinDate: row.join_date,
    baseSalary: row.base_salary === null ? null : num(row.base_salary),
    permissions: (row.permissions ?? []).filter(isPageKey),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPayslip(row: PayslipRow): PayslipRecord {
  return {
    id: row.id,
    staffId: row.staff_id,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    basic: num(row.basic),
    allowances: num(row.allowances),
    epfEmployee: num(row.epf_employee),
    epfEmployer: num(row.epf_employer),
    socsoEmployee: num(row.socso_employee),
    eisEmployee: num(row.eis_employee),
    pcb: num(row.pcb),
    otherDeductions: num(row.other_deductions),
    gross: num(row.gross),
    net: num(row.net),
    notes: row.notes,
    issuedAt: row.issued_at,
    createdAt: row.created_at,
  };
}

export function isStaffStoreConfigured() {
  return isSupabaseOrderStoreConfigured();
}

function requireStore() {
  if (!isSupabaseOrderStoreConfigured()) {
    throw new Error("Supabase is not configured — staff accounts are unavailable.");
  }
  return getSupabaseAdmin();
}

const STAFF_COLUMNS =
  "id, username, password_hash, full_name, position, phone, email, ic_number, bank_name, bank_account, join_date, base_salary, permissions, is_active, created_at, updated_at";

export async function listStaff(): Promise<StaffRecord[]> {
  const supabase = requireStore();
  const { data, error } = await supabase
    .from("staff")
    .select(STAFF_COLUMNS)
    .order("full_name", { ascending: true });
  if (error) throw new Error(`Unable to load staff: ${error.message}`);
  return (data as StaffRow[]).map(mapStaff);
}

export async function getStaffById(id: string): Promise<StaffRecord | null> {
  const supabase = requireStore();
  const { data, error } = await supabase
    .from("staff")
    .select(STAFF_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Unable to load staff: ${error.message}`);
  return data ? mapStaff(data as StaffRow) : null;
}

/** Auth lookup — includes the password hash. Case-insensitive on username. */
export async function getStaffAuthByUsername(
  username: string,
): Promise<{ id: string; passwordHash: string; isActive: boolean } | null> {
  const supabase = requireStore();
  const { data, error } = await supabase
    .from("staff")
    .select("id, password_hash, is_active")
    .ilike("username", username.trim())
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  const row = data as { id: string; password_hash: string; is_active: boolean };
  return { id: row.id, passwordHash: row.password_hash, isActive: row.is_active };
}

export type StaffWriteInput = {
  username: string;
  fullName: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  icNumber: string | null;
  bankName: string | null;
  bankAccount: string | null;
  joinDate: string | null;
  baseSalary: number | null;
  permissions: PageKey[];
  isActive: boolean;
};

export async function createStaff(
  input: StaffWriteInput & { passwordHash: string },
): Promise<StaffRecord> {
  const supabase = requireStore();
  const { data, error } = await supabase
    .from("staff")
    .insert({
      username: input.username,
      password_hash: input.passwordHash,
      full_name: input.fullName,
      position: input.position,
      phone: input.phone,
      email: input.email,
      ic_number: input.icNumber,
      bank_name: input.bankName,
      bank_account: input.bankAccount,
      join_date: input.joinDate,
      base_salary: input.baseSalary,
      permissions: input.permissions,
      is_active: input.isActive,
    })
    .select(STAFF_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("That username is already taken.");
    throw new Error(`Unable to create staff: ${error.message}`);
  }
  return mapStaff(data as StaffRow);
}

export async function updateStaff(id: string, input: StaffWriteInput): Promise<void> {
  const supabase = requireStore();
  const { error } = await supabase
    .from("staff")
    .update({
      username: input.username,
      full_name: input.fullName,
      position: input.position,
      phone: input.phone,
      email: input.email,
      ic_number: input.icNumber,
      bank_name: input.bankName,
      bank_account: input.bankAccount,
      join_date: input.joinDate,
      base_salary: input.baseSalary,
      permissions: input.permissions,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("That username is already taken.");
    throw new Error(`Unable to update staff: ${error.message}`);
  }
}

export async function setStaffPassword(id: string, passwordHash: string): Promise<void> {
  const supabase = requireStore();
  const { error } = await supabase
    .from("staff")
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Unable to update password: ${error.message}`);
}

export async function listPayslipsForStaff(staffId: string): Promise<PayslipRecord[]> {
  const supabase = requireStore();
  const { data, error } = await supabase
    .from("payslips")
    .select("*")
    .eq("staff_id", staffId)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false });
  if (error) throw new Error(`Unable to load payslips: ${error.message}`);
  return (data as PayslipRow[]).map(mapPayslip);
}

export async function getPayslipById(
  id: string,
): Promise<{ payslip: PayslipRecord; staff: StaffRecord } | null> {
  const supabase = requireStore();
  const { data, error } = await supabase
    .from("payslips")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Unable to load payslip: ${error.message}`);
  if (!data) return null;
  const payslip = mapPayslip(data as PayslipRow);
  const staff = await getStaffById(payslip.staffId);
  if (!staff) return null;
  return { payslip, staff };
}

export type PayslipWriteInput = {
  staffId: string;
  periodMonth: number;
  periodYear: number;
  basic: number;
  allowances: number;
  epfEmployee: number;
  epfEmployer: number;
  socsoEmployee: number;
  eisEmployee: number;
  pcb: number;
  otherDeductions: number;
  gross: number;
  net: number;
  notes: string | null;
  issued: boolean;
};

export async function upsertPayslip(input: PayslipWriteInput): Promise<PayslipRecord> {
  const supabase = requireStore();
  const { data, error } = await supabase
    .from("payslips")
    .upsert(
      {
        staff_id: input.staffId,
        period_month: input.periodMonth,
        period_year: input.periodYear,
        basic: input.basic,
        allowances: input.allowances,
        epf_employee: input.epfEmployee,
        epf_employer: input.epfEmployer,
        socso_employee: input.socsoEmployee,
        eis_employee: input.eisEmployee,
        pcb: input.pcb,
        other_deductions: input.otherDeductions,
        gross: input.gross,
        net: input.net,
        notes: input.notes,
        issued_at: input.issued ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "staff_id,period_year,period_month" },
    )
    .select("*")
    .single();
  if (error) throw new Error(`Unable to save payslip: ${error.message}`);
  return mapPayslip(data as PayslipRow);
}
