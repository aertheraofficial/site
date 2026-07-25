"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-full bg-[#201d17] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2e2a22]"
    >
      Download / Print PDF
    </button>
  );
}
