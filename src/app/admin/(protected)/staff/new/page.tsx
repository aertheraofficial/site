import Link from "next/link";
import { createStaffAction } from "@/app/admin/actions";
import { requireAdminActor } from "@/lib/staff-auth";
import { StaffForm } from "../staff-form";

type NewStaffPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  "missing-fields":
    "Username, full name and a password of at least 6 characters are required.",
};

export default async function NewStaffPage({ searchParams }: NewStaffPageProps) {
  await requireAdminActor("/admin/staff");
  const { error } = await searchParams;
  const message = error ? (ERROR_MESSAGES[error] ?? error) : null;

  return (
    <div>
      <Link href="/admin/staff" className="text-sm text-[#8d7a5c] hover:text-[#201d17]">
        ← Back to staff
      </Link>
      <h2 className="mt-3 font-display text-[2rem] leading-none tracking-[-0.05em] text-[#201d17]">
        Add Staff
      </h2>

      {message ? (
        <p className="mt-6 max-w-2xl rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-4 py-3 text-sm text-[#8b5e1d]">
          {message}
        </p>
      ) : null}

      <StaffForm action={createStaffAction} submitLabel="Create Staff" />
    </div>
  );
}
