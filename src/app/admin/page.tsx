import { redirect } from "next/navigation";
import { hasAdminSession } from "@/lib/admin-auth";

export default async function AdminIndexPage() {
  redirect((await hasAdminSession()) ? "/admin/orders" : "/admin/login");
}
