import "server-only";

import {
  getSupabaseAdmin,
  isSupabaseOrderStoreConfigured,
} from "@/lib/supabase-admin";
import {
  DEFAULT_ROLE,
  isPageKey,
  isRoleKey,
  isStaffStatus,
  type PageKey,
  type RoleKey,
  type StaffStatus,
} from "@/lib/staff-permissions";

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
  role: RoleKey;
  /** `pending` accounts exist but cannot log in until an admin approves. */
  status: StaffStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  /** Shop a supervisor answers for. Null unless the role is scoped to one. */
  shopLocation: string | null;
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
  role: string | null;
  status: string | null;
  approved_by: string | null;
  approved_at: string | null;
  shop_location: string | null;
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
    role: isRoleKey(row.role) ? row.role : DEFAULT_ROLE,
    // Accounts predating the status column fall back to the old boolean, so a
    // deploy that lands before the migration cannot lock the shop out.
    status: isStaffStatus(row.status)
      ? row.status
      : row.is_active
        ? "active"
        : "suspended",
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at ?? null,
    shopLocation: row.shop_location ?? null,
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

const STAFF_COLUMNS_BASE =
  "id, username, password_hash, full_name, position, phone, email, ic_number, bank_name, bank_account, join_date, base_salary, permissions, is_active, created_at, updated_at";

/** Columns added by supabase/add_staff_roles_and_approval.sql. */
const ROLE_COLUMNS = [
  "role",
  "status",
  "approved_by",
  "approved_at",
  "shop_location",
] as const;

const STAFF_COLUMNS_WITH_ROLES = `${STAFF_COLUMNS_BASE}, ${ROLE_COLUMNS.join(", ")}`;

/**
 * Deploys run ahead of migrations, and locking every staff member out of the
 * admin is a far worse failure than losing role data for one request, so the
 * first query against a database without these columns turns them off.
 */
let roleColumnsAvailable = true;

function staffColumns() {
  return roleColumnsAvailable ? STAFF_COLUMNS_WITH_ROLES : STAFF_COLUMNS_BASE;
}

function isMissingRoleColumn(message: string | undefined) {
  return Boolean(message && ROLE_COLUMNS.some((column) => message.includes(column)));
}

export async function listStaff(): Promise<StaffRecord[]> {
  const supabase = requireStore();
  const { data, error } = await supabase
    .from("staff")
    .select(staffColumns())
    .order("full_name", { ascending: true });
  if (error) {
    if (roleColumnsAvailable && isMissingRoleColumn(error.message)) {
      roleColumnsAvailable = false;
      return listStaff();
    }
    throw new Error(`Unable to load staff: ${error.message}`);
  }
  return (data as unknown as StaffRow[]).map(mapStaff);
}

export async function getStaffById(id: string): Promise<StaffRecord | null> {
  const supabase = requireStore();
  const { data, error } = await supabase
    .from("staff")
    .select(staffColumns())
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (roleColumnsAvailable && isMissingRoleColumn(error.message)) {
      roleColumnsAvailable = false;
      return getStaffById(id);
    }
    throw new Error(`Unable to load staff: ${error.message}`);
  }
  return data ? mapStaff(data as unknown as StaffRow) : null;
}

/**
 * Auth lookup — includes the password hash. Case-insensitive on username.
 *
 * `status` is what decides whether the account may log in: a pending sign-up
 * has a real password but no access until an admin approves it.
 */
export async function getStaffAuthByUsername(
  username: string,
): Promise<{
  id: string;
  passwordHash: string;
  isActive: boolean;
  status: StaffStatus;
} | null> {
  const supabase = requireStore();
  const columns = roleColumnsAvailable
    ? "id, password_hash, is_active, status"
    : "id, password_hash, is_active";
  const { data, error } = await supabase
    .from("staff")
    .select(columns)
    .ilike("username", username.trim())
    .maybeSingle();
  if (error) {
    if (roleColumnsAvailable && isMissingRoleColumn(error.message)) {
      roleColumnsAvailable = false;
      return getStaffAuthByUsername(username);
    }
    return null;
  }
  if (!data) return null;
  const row = data as unknown as {
    id: string;
    password_hash: string;
    is_active: boolean;
    status?: string | null;
  };
  return {
    id: row.id,
    passwordHash: row.password_hash,
    isActive: row.is_active,
    status: isStaffStatus(row.status)
      ? row.status
      : row.is_active
        ? "active"
        : "suspended",
  };
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
  role: RoleKey;
  status: StaffStatus;
  shopLocation: string | null;
  isActive: boolean;
};

/** Strips the role columns when the migration has not been applied yet. */
function withRoleColumns(row: Record<string, unknown>) {
  if (roleColumnsAvailable) return row;
  const stripped = { ...row };
  for (const column of ROLE_COLUMNS) delete stripped[column];
  return stripped;
}

export async function createStaff(
  input: StaffWriteInput & { passwordHash: string },
): Promise<StaffRecord> {
  const supabase = requireStore();
  const { data, error } = await supabase
    .from("staff")
    .insert(
      withRoleColumns({
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
        role: input.role,
        status: input.status,
        shop_location: input.shopLocation,
        is_active: input.isActive,
      }),
    )
    .select(staffColumns())
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("That username is already taken.");
    if (roleColumnsAvailable && isMissingRoleColumn(error.message)) {
      roleColumnsAvailable = false;
      return createStaff(input);
    }
    throw new Error(`Unable to create staff: ${error.message}`);
  }
  return mapStaff(data as unknown as StaffRow);
}

export async function updateStaff(id: string, input: StaffWriteInput): Promise<void> {
  const supabase = requireStore();
  const { error } = await supabase
    .from("staff")
    .update(
      withRoleColumns({
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
        role: input.role,
        status: input.status,
        shop_location: input.shopLocation,
        is_active: input.isActive,
        updated_at: new Date().toISOString(),
      }),
    )
    .eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("That username is already taken.");
    if (roleColumnsAvailable && isMissingRoleColumn(error.message)) {
      roleColumnsAvailable = false;
      return updateStaff(id, input);
    }
    throw new Error(`Unable to update staff: ${error.message}`);
  }
}

/**
 * Approve or suspend an account. Separate from updateStaff on purpose: granting
 * access and editing someone's bank details are different decisions, and an
 * admin should not be able to do the first by accident while doing the second.
 */
export async function setStaffStatus(
  id: string,
  status: StaffStatus,
  approvedBy: string,
): Promise<void> {
  const supabase = requireStore();
  const { error } = await supabase
    .from("staff")
    .update(
      withRoleColumns({
        status,
        is_active: status === "active",
        approved_by: status === "active" ? approvedBy : null,
        approved_at: status === "active" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }),
    )
    .eq("id", id);
  if (error) {
    if (roleColumnsAvailable && isMissingRoleColumn(error.message)) {
      roleColumnsAvailable = false;
      return setStaffStatus(id, status, approvedBy);
    }
    throw new Error(`Unable to update account status: ${error.message}`);
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
