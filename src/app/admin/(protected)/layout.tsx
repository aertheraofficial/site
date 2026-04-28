import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import { getAdminUsername, requireAdminSession } from "@/lib/admin-auth";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminSession();
  const adminUsername = getAdminUsername();

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
                  Order Management
                </h1>
                <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a6258]">
                  {adminUsername}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/orders"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/8 bg-white px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-[#f7f2ea]"
              >
                Orders
              </Link>
              <Link
                href="/admin/social"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/8 bg-white px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-[#f7f2ea]"
              >
                Social
              </Link>
              <Link
                href="/category/all-products"
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
