import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { searchMembers } from "@/lib/members";

// Typeahead for the counter: staff searches walk-in members by name or phone.
export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const members = await searchMembers(query);
  return NextResponse.json({ members });
}
