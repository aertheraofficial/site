import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServer();
    await supabase.auth.signOut();
  } catch {
    // Ignore sign-out errors — redirect anyway
  }

  const origin = new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/`, { status: 302 });
}
