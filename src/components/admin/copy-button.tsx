"use client";

import { useEffect, useState } from "react";

type CopyButtonProps = {
  value: string;
  label?: string;
};

/**
 * Copy text to the clipboard, for the hand-off to Instagram.
 *
 * Posting is done by hand, so this is the step staff take on every single post;
 * selecting a caption out of a card by dragging is the thing it replaces.
 */
export function CopyButton({ value, label = "Copy caption" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access is refused on insecure origins and in some in-app
      // browsers; say so rather than looking like nothing happened.
      window.prompt("Copy the caption:", value);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-[#f7f2ea]"
    >
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}
