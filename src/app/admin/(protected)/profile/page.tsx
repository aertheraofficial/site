import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/staff-auth";
import { listPayslipsForStaff } from "@/lib/staff";
import { formatMoney } from "@/lib/money";
import { formatPeriod } from "@/lib/payroll";

type ProfilePageProps = {
  searchParams: Promise<{ denied?: string }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const actor = await requireActor("/admin/profile");
  const { denied } = await searchParams;

  // The master admin has no personal staff profile.
  if (actor.type === "admin") redirect("/admin/staff");

  const staff = actor.staff;
  const payslips = (await listPayslipsForStaff(staff.id)).filter(
    (slip) => slip.issuedAt,
  );

  return (
    <div>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8d7a5c]">
        My Profile
      </p>
      <h2 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
        {staff.fullName}
      </h2>
      <p className="mt-2 text-sm text-[#5d574f]">{staff.position || "Staff"}</p>

      {denied ? (
        <p className="mt-6 max-w-xl rounded-[1.25rem] border border-[#e6b4b4] bg-[#fff0ef] px-4 py-3 text-sm text-[#9b3d32]">
          You don&apos;t have access to that page. Ask an admin if you need it.
        </p>
      ) : null}

      <section className="mt-8 grid gap-4 rounded-[1.5rem] border border-black/8 bg-white p-6 sm:grid-cols-2">
        <Detail label="Username" value={`@${staff.username}`} />
        <Detail label="Phone" value={staff.phone || "—"} />
        <Detail label="Email" value={staff.email || "—"} />
        <Detail label="IC number" value={staff.icNumber || "—"} />
        <Detail label="Join date" value={staff.joinDate || "—"} />
        <Detail
          label="Bank"
          value={
            staff.bankName
              ? `${staff.bankName}${staff.bankAccount ? ` · ${staff.bankAccount}` : ""}`
              : "—"
          }
        />
      </section>

      <section className="mt-10">
        <h3 className="font-display text-[1.4rem] tracking-[-0.03em] text-[#201d17]">
          My Payslips
        </h3>
        {payslips.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-black/8 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-black/8 bg-[#faf6ef] text-[0.68rem] uppercase tracking-[0.12em] text-[#8d7a5c]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Period</th>
                    <th className="px-4 py-3 font-semibold">Net pay</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((slip) => (
                    <tr key={slip.id} className="border-b border-black/5 last:border-0">
                      <td className="px-4 py-3 font-medium text-[#201d17]">
                        {formatPeriod(slip.periodMonth, slip.periodYear)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#201d17]">
                        {formatMoney(slip.net)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/payslips/${slip.id}`}
                          className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-semibold text-[#201d17] transition hover:bg-[#f7f2ea]"
                        >
                          Download
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#8d7a5c]">
            No payslips issued yet.
          </p>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#8d7a5c]">
        {label}
      </p>
      <p className="mt-1 text-[#201d17]">{value}</p>
    </div>
  );
}
