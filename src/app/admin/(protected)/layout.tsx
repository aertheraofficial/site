import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import { actorHasPermission, requireActor } from "@/lib/staff-auth";
import { ADMIN_PAGES } from "@/lib/staff-permissions";
import { NavDropdown } from "@/components/admin/nav-dropdown";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const actor = await requireActor();

  const visiblePages = ADMIN_PAGES.filter((page) =>
    actorHasPermission(actor, page.key),
  );

  // Group visible pages by their group label, preserving registry order.
  const navGroups: { label: string; items: { href: string; label: string }[] }[] = [];
  for (const page of visiblePages) {
    let group = navGroups.find((g) => g.label === page.group);
    if (!group) {
      group = { label: page.group, items: [] };
      navGroups.push(group);
    }
    group.items.push({ href: page.href, label: page.label });
  }

  const actorName = actor.type === "admin" ? actor.name : actor.staff.fullName;
  const actorRole =
    actor.type === "admin" ? "Administrator" : actor.staff.position || "Staff";

  return (
    <div className="min-h-screen">
      <header className="border-b border-black/8 bg-[rgba(255,253,249,0.92)] backdrop-blur-xl">
        <div className="page-frame">
          <div className="wide-shell flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8d7a5c]">
                Aerthera Admin
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
                  Dashboard
                </h1>
                <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a6258]">
                  {actorName} · {actorRole}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {navGroups.map((group) => (
                <NavDropdown key={group.label} label={group.label} items={group.items} />
              ))}
              {actor.type === "staff" ? (
                <Link
                  href="/admin/profile"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/8 px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-black/4"
                >
                  My Profile
                </Link>
              ) : null}
              <Link
                href="/products"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/8 px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-black/4"
              >
                View Store
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#201d17] px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:opacity-92"
                >
                  Log Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="page-frame py-8 sm:py-10">
        <div className="wide-shell">{children}</div>
      </main>
    </div>
  );
}
