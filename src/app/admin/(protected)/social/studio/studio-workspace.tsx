"use client";

import { useState } from "react";
import { SceneComposer, type StudioProduct } from "./scene-composer";
import { SequenceComposer } from "./sequence-composer";

/**
 * The two ways to use Studio, kept apart.
 *
 * A single scene and a sequence answer different questions — "what does this
 * product look like in a room" against "what is the ad" — and they need
 * different inputs. Putting both on one screen made the single-scene path, which
 * is the one staff run every day, scroll past a plan they had not asked for.
 */

type Mode = "scene" | "sequence";

const MODES: Array<{ key: Mode; label: string; blurb: string }> = [
  {
    key: "scene",
    label: "One scene",
    blurb: "A single styled shot, and a clip from it",
  },
  {
    key: "sequence",
    label: "Sequence",
    blurb: "A planned five-stage ad for one product",
  },
];

export function StudioWorkspace({ products }: { products: StudioProduct[] }) {
  const [mode, setMode] = useState<Mode>("scene");

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-2">
        {MODES.map((entry) => {
          const isActive = mode === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setMode(entry.key)}
              aria-pressed={isActive}
              className={`rounded-[1.25rem] border px-5 py-4 text-left transition ${
                isActive
                  ? "border-[#201d17] bg-[#faf7f1]"
                  : "border-black/8 bg-white hover:border-black/20"
              }`}
            >
              <span className="block text-sm font-semibold text-[#201d17]">
                {entry.label}
              </span>
              <span className="mt-0.5 block text-xs text-[#8d7a5c]">
                {entry.blurb}
              </span>
            </button>
          );
        })}
      </div>

      {/*
        Unmounted rather than hidden: each side holds generated images as data
        URLs and an open poll against a running render, and keeping the other one
        alive behind a display:none would carry both.
      */}
      {mode === "scene" ? (
        <SceneComposer products={products} />
      ) : (
        <SequenceComposer products={products} />
      )}
    </div>
  );
}
