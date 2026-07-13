"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#201d17] px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:opacity-92"
    >
      Print Labels
    </button>
  );
}
