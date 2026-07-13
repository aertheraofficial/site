"use client";

import Link from "next/link";
import { useState } from "react";

type NavDropdownItem = {
  href: string;
  label: string;
};

type NavDropdownProps = {
  label: string;
  items: NavDropdownItem[];
};

export function NavDropdown({ label, items }: NavDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-black/8 bg-white px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-[#f7f2ea]"
      >
        {label}
        <svg
          viewBox="0 0 12 8"
          aria-hidden="true"
          className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M1 1.5L6 6.5L11 1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 min-w-[11rem] rounded-[1.25rem] border border-black/8 bg-white p-2 shadow-[0_18px_40px_rgba(32,29,23,0.12)]">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-[0.85rem] px-4 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#201d17] transition hover:bg-[#f7f2ea]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
