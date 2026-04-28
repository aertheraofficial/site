import Link from "next/link";

export default function NotFound() {
  return (
    <section className="rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-6 py-10 text-center shadow-[0_24px_70px_rgba(42,33,24,0.12)] sm:px-8 sm:py-14">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-[color:var(--olive)]">
        Not Found
      </p>
      <h1 className="font-display mt-4 text-[3rem] leading-[0.9] tracking-[-0.04em] text-[color:var(--ink)] sm:text-[4.2rem]">
        That page does not exist.
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[color:var(--muted)]">
        The route is outside the current public Aerthera page set. Use the home
        page or the product catalog to continue browsing.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[color:var(--olive-deep)] px-6 text-sm font-semibold tracking-[0.08em] text-stone-50 transition hover:-translate-y-0.5 hover:bg-[#2d3d2f]"
      >
        Return home
      </Link>
    </section>
  );
}
