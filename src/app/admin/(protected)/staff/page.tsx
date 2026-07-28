import Link from "next/link";
import { requireAdminActor } from "@/lib/staff-auth";
import { isStaffStoreConfigured, listStaff } from "@/lib/staff";
import { getRole } from "@/lib/staff-permissions";
import { setStaffStatusAction } from "@/app/admin/actions";

type StaffPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function StaffListPage({ searchParams }: StaffPageProps) {
  await requireAdminActor("/admin/staff");
  const { error } = await searchParams;

  if (!isStaffStoreConfigured()) {
    return (
      <div className="rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-5 py-6 text-sm leading-7 text-[#8b5e1d]">
        Supabase is not configured, so staff accounts are unavailable. Add
        <code className="mx-1">SUPABASE_URL</code> and
        <code className="mx-1">SUPABASE_SERVICE_ROLE_KEY</code>, then run
        <code className="mx-1">supabase/add_staff_payroll.sql</code>.
      </div>
    );
  }

  const staff = await listStaff();
  // Applications waiting on a decision come first — an account nobody has
  // looked at is the one thing on this page that is actually blocking someone.
  const pending = staff.filter((member) => member.status === "pending");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8d7a5c]">
            Team
          </p>
          <h2 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
            Staff &amp; Payroll
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#5d574f]">
            Create staff accounts, choose which admin pages each one can use, and
            issue payslips they can download.
          </p>
        </div>
        <Link
          href="/admin/staff/new"
          className="rounded-full bg-[#201d17] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2e2a22]"
        >
          + Add Staff
        </Link>
      </div>

      {error ? (
        <p className="mt-6 rounded-[1.25rem] border border-[#e6b4b4] bg-[#fff0ef] px-4 py-3 text-sm text-[#9b3d32]">
          {error}
        </p>
      ) : null}

      {pending.length > 0 ? (
        <section className="mt-6 rounded-[1.25rem] border border-[#d4b16c] bg-[#faf1df] p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8b5e1d]">
            Waiting for approval ({pending.length})
          </p>
          <p className="mt-1 text-sm text-[#8b5e1d]">
            These accounts exist but cannot log in. Open one to choose what type
            of staff they are before you approve it.
          </p>
          <ul className="mt-4 space-y-2">
            {pending.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] bg-white px-4 py-3"
              >
                <span className="text-sm text-[#201d17]">
                  <span className="font-semibold">{member.fullName}</span>
                  <span className="text-[#8d7a5c]"> · @{member.username}</span>
                  <span className="text-[#8d7a5c]">
                    {" · asking to join as "}
                    {getRole(member.role).label}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Link
                    href={`/admin/staff/${member.id}`}
                    className="inline-flex h-9 items-center rounded-full border border-black/10 px-4 text-xs font-semibold text-[#201d17] transition hover:bg-[#f7f2ea]"
                  >
                    Review
                  </Link>
                  <form action={setStaffStatusAction}>
                    <input type="hidden" name="id" value={member.id} />
                    <input type="hidden" name="status" value="suspended" />
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center rounded-full border border-[#e6b4b4] px-4 text-xs font-semibold text-[#9b3d32] transition hover:bg-[#fff0ef]"
                    >
                      Reject
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-[1.25rem] border border-black/8 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-black/8 bg-[#faf6ef] text-[0.68rem] uppercase tracking-[0.12em] text-[#8d7a5c]">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Username</th>
                <th className="px-4 py-3 font-semibold">Access</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#201d17]">{member.fullName}</p>
                    <p className="text-xs text-[#8d7a5c]">{member.position || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-[#5d574f]">{member.username}</td>
                  <td className="px-4 py-3 text-[#5d574f]">
                    {getRole(member.role).label}
                    {member.shopLocation ? (
                      <span className="block text-xs text-[#8d7a5c]">
                        {member.shopLocation}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.66rem] font-semibold uppercase tracking-[0.12em] ${
                        member.status === "active"
                          ? "bg-[#e9f7ee] text-[#256542]"
                          : member.status === "pending"
                            ? "bg-[#faf1df] text-[#8b5e1d]"
                            : "bg-[#fff0ef] text-[#9b3d32]"
                      }`}
                    >
                      {member.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/staff/${member.id}`}
                      className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-semibold text-[#201d17] transition hover:bg-[#f7f2ea]"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {staff.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#8d7a5c]">
            No staff yet. Add your first counter staff.
          </p>
        ) : null}
      </div>
    </div>
  );
}
