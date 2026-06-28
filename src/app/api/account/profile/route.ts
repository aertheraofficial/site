import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

async function resolveUser(request: Request) {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const { data: { user } } = await getSupabaseAdmin().auth.getUser(token);
  return user ?? null;
}

export async function GET(request: Request) {
  const user = await resolveUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await getSupabaseAdmin()
    .from("customer_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data ?? null });
}

export async function PATCH(request: Request) {
  const user = await resolveUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const allowed = ["full_name", "phone", "address_line1", "address_line2", "city", "state", "postcode", "country"];
  const patch: Record<string, string> = { user_id: user.id, updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (typeof body[key] === "string") patch[key] = body[key].trim();
  }

  const { data, error } = await getSupabaseAdmin()
    .from("customer_profiles")
    .upsert(patch, { onConflict: "user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
