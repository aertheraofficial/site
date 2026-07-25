import { redirect } from "next/navigation";
import { getActor } from "@/lib/staff-auth";
import { ADMIN_PAGES } from "@/lib/staff-permissions";

export default async function AdminIndexPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");

  if (actor.type === "admin") {
    redirect("/admin/orders");
  }

  // Staff: send them to their first allowed page, else their profile.
  const firstAllowed = ADMIN_PAGES.find((page) =>
    actor.staff.permissions.includes(page.key),
  );
  redirect(firstAllowed ? firstAllowed.href : "/admin/profile");
}
