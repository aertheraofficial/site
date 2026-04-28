import { redirect } from "next/navigation";
import { loginAction } from "@/app/admin/actions";
import { hasAdminSession, isAdminConfigured } from "@/lib/admin-auth";

type AdminLoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

const LOGIN_ERRORS: Record<string, string> = {
  invalid: "That username or password was not accepted.",
  unconfigured: "Admin access is not configured yet. Add the admin env vars first.",
  "logged-out": "You have been logged out.",
};

export default async function AdminLoginPage({
  searchParams,
}: AdminLoginPageProps) {
  if (await hasAdminSession()) {
    redirect("/admin/orders");
  }

  const { error, next } = await searchParams;
  const isConfigured = isAdminConfigured();
  const nextPath =
    typeof next === "string" && next.startsWith("/admin")
      ? next
      : "/admin/orders";
  const message = error ? LOGIN_ERRORS[error] : null;

  return (
    <div className="page-frame flex min-h-screen items-center py-10">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2.25rem] border border-black/8 bg-[#201d17] p-8 text-white shadow-[0_34px_90px_rgba(32,29,23,0.22)] sm:p-10">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#e2cfb0]">
            Aerthera Admin
          </p>
          <h1 className="mt-4 font-display text-[3rem] leading-[0.94] tracking-[-0.05em] sm:text-[4rem]">
            Order desk.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/74 sm:text-base">
            Manage paid orders, add tracking details, and keep fulfillment notes in one
            place without leaving the storefront.
          </p>
          <div className="mt-10 space-y-4 rounded-[1.75rem] border border-white/10 bg-white/6 p-6">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#d8c7aa]">
                Connected stack
              </p>
              <p className="mt-2 text-sm leading-7 text-white/72">
                Stripe Checkout handles payment, Supabase stores orders, and this admin
                area manages fulfillment status and tracking.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-white/74 sm:grid-cols-2">
              <div className="rounded-[1.25rem] border border-white/10 bg-black/10 p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[#d8c7aa]">
                  Fulfillment
                </p>
                <p className="mt-2 leading-6">
                  Move orders from unfulfilled to packed or fulfilled.
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-black/10 p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[#d8c7aa]">
                  Tracking
                </p>
                <p className="mt-2 leading-6">
                  Record carrier, tracking number, and fulfillment notes.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-black/8 bg-white p-8 shadow-[0_24px_80px_rgba(32,29,23,0.08)] sm:p-10">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
            Sign In
          </p>
          <h2 className="mt-4 font-display text-[2.6rem] leading-[0.96] tracking-[-0.05em] sm:text-[3.2rem]">
            Orders and fulfillment
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#5d574f] sm:text-base">
            Use the private admin credentials configured in the local environment. This
            login is intentionally separate from customer checkout.
          </p>

          {message ? (
            <p className="mt-6 rounded-[1.25rem] border border-[#d6c2a0] bg-[#f8f1e4] px-4 py-3 text-sm leading-6 text-[#8b5e1d]">
              {message}
            </p>
          ) : null}

          {isConfigured ? (
            <form action={loginAction} className="mt-8 space-y-5">
              <input type="hidden" name="next" value={nextPath} />

              <label className="block">
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c]">
                  Username
                </span>
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  defaultValue="admin"
                  className="mt-3 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3.5 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[#8d7a5c]">
                  Password
                </span>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  className="mt-3 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3.5 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
                />
              </label>

              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#201d17] px-6 text-[0.76rem] font-semibold uppercase tracking-[0.2em] text-white transition hover:opacity-92"
              >
                Enter Admin
              </button>
            </form>
          ) : (
            <div className="mt-8 rounded-[1.5rem] border border-black/8 bg-[#f7f2ea] p-6 text-sm leading-7 text-[#5d574f]">
              Add <code>ADMIN_USERNAME</code>, <code>ADMIN_PASSWORD</code>, and optionally{" "}
              <code>ADMIN_SESSION_SECRET</code> to the environment before using this
              area.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
