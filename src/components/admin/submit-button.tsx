"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  /** Shown while the action is in flight. Defaults to the idle label. */
  pendingLabel?: string;
  variant?: "solid" | "outline" | "danger";
  className?: string;
};

const VARIANTS = {
  solid:
    "bg-[#201d17] text-white hover:opacity-92 disabled:opacity-60",
  outline:
    "border border-black/10 bg-white text-[#201d17] hover:bg-[#f7f2ea] disabled:opacity-60",
  danger:
    "border border-[#e6b4b4] bg-white text-[#9b3d32] hover:bg-[#fff0ef] disabled:opacity-60",
} as const;

/**
 * A submit button that disables itself while its form's action runs.
 *
 * Without this, every mutation in the admin is a plain button that looks idle
 * for the whole round trip, so staff click it again — and a double click on
 * something like "Sold 1" or a courier batch is a real duplicate, not a
 * cosmetic glitch.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "solid",
  className = "",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`inline-flex min-h-11 items-center justify-center gap-2.5 rounded-full px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] transition disabled:cursor-wait ${VARIANTS[variant]} ${className}`}
    >
      {pending ? (
        <span
          aria-hidden="true"
          className="size-3.5 rounded-full border-2 border-current/35 border-t-current motion-safe:animate-spin"
        />
      ) : null}
      <span>{pending ? (pendingLabel ?? children) : children}</span>
    </button>
  );
}
