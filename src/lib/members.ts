import { getSupabaseAdmin, isSupabaseOrderStoreConfigured } from "@/lib/supabase-admin";

export type Member = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  createdAt: string;
};

type MemberRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  created_at: string;
};

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    location: row.location,
    createdAt: row.created_at,
  };
}

/**
 * Look up walk-in members by name or phone for the counter. Returns [] when the
 * store is not configured so the counter still works without a members table.
 */
export async function searchMembers(query: string, limit = 8): Promise<Member[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2 || !isSupabaseOrderStoreConfigured()) return [];

  const digits = trimmed.replace(/\D/g, "");
  const escaped = trimmed.replace(/[%_,]/g, (match) => `\\${match}`);

  const supabase = getSupabaseAdmin();
  let request = supabase
    .from("members")
    .select("id, full_name, phone, email, location, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  // Match on name OR (when the query looks like a number) phone.
  request =
    digits.length >= 3
      ? request.or(`full_name.ilike.%${escaped}%,phone.ilike.%${digits}%`)
      : request.ilike("full_name", `%${escaped}%`);

  const { data, error } = await request;
  if (error) {
    console.error("Member search failed:", error.message);
    return [];
  }
  return (data as MemberRow[]).map(toMember);
}

/** Every registered walk-in member, newest first. Empty when Supabase is off. */
export async function listMembers(limit = 500): Promise<Member[]> {
  if (!isSupabaseOrderStoreConfigured()) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("members")
    .select("id, full_name, phone, email, location, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Member list failed:", error.message);
    return [];
  }
  return (data as MemberRow[]).map(toMember);
}

export async function getMemberById(id: string): Promise<Member | null> {
  if (!isSupabaseOrderStoreConfigured()) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("members")
    .select("id, full_name, phone, email, location, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Member lookup failed:", error.message);
    return null;
  }
  return data ? toMember(data as MemberRow) : null;
}

export type NewMemberInput = {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
};

/** Register a walk-in member. Reuses an existing row when the phone/email already matches. */
export async function createMember(input: NewMemberInput): Promise<Member | null> {
  const fullName = input.fullName.trim();
  if (!fullName || !isSupabaseOrderStoreConfigured()) return null;

  const phone = input.phone?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;
  const supabase = getSupabaseAdmin();

  // Avoid duplicates: if a member with the same phone or email exists, reuse it.
  if (phone || email) {
    const filters: string[] = [];
    if (phone) filters.push(`phone.eq.${phone}`);
    if (email) filters.push(`email.eq.${email}`);
    const { data: existing } = await supabase
      .from("members")
      .select("id, full_name, phone, email, location, created_at")
      .or(filters.join(","))
      .limit(1);
    if (existing && existing.length > 0) {
      return toMember(existing[0] as MemberRow);
    }
  }

  const { data, error } = await supabase
    .from("members")
    .insert({ full_name: fullName, phone, email, location: input.location?.trim() || null })
    .select("id, full_name, phone, email, location, created_at")
    .single();

  if (error) {
    console.error("Member create failed:", error.message);
    return null;
  }
  return toMember(data as MemberRow);
}
