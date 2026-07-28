"use client";

import { useState, useTransition } from "react";
import {
  CAPTION_PLATFORMS,
  PLATFORM_META,
  type CaptionPlatform,
} from "@/lib/social/platform-rules";
import type { PlatformCaption } from "@/lib/social/studio-platform-captions";
import type { ProductAnalysis } from "@/lib/social/studio-scenes";
import { generateSceneCaptionsAction } from "./actions";

const LANGUAGES = ["Bahasa Malaysia", "English", "Manglish"];

type SceneCaptionsProps = {
  analysis: ProductAnalysis;
  scenePrompt: string;
};

/**
 * Captions for the scene above, one per network.
 *
 * Each platform is generated separately so a writer can redo just the TikTok one
 * without losing the Instagram caption they were happy with.
 */
export function SceneCaptions({ analysis, scenePrompt }: SceneCaptionsProps) {
  const [captions, setCaptions] = useState<Partial<Record<CaptionPlatform, PlatformCaption>>>({});
  const [active, setActive] = useState<CaptionPlatform>("instagram");
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [busy, setBusy] = useState<CaptionPlatform | "all" | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [, startTransition] = useTransition();

  function run(platform?: CaptionPlatform) {
    setError("");
    setBusy(platform ?? "all");
    startTransition(async () => {
      const result = await generateSceneCaptionsAction({
        analysis,
        scenePrompt,
        language,
        ...(platform ? { platform } : {}),
      });

      setBusy(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCaptions((current) => {
        const next = { ...current };
        for (const caption of result.captions) next[caption.platform] = caption;
        return next;
      });
      setActive(result.captions[0].platform);

      if (result.failed.length > 0) {
        setError(
          `Could not write: ${result.failed.map((f) => PLATFORM_META[f.platform as CaptionPlatform]?.label ?? f.platform).join(", ")}.`,
        );
      }
    });
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      window.prompt("Copy this:", text);
    }
  }

  const current = captions[active];

  return (
    <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
            Captions
          </p>
          <h4 className="mt-2 font-display text-[1.6rem] leading-none tracking-[-0.04em] text-[#201d17]">
            Written for the image above
          </h4>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="caption-language">
            Language
          </label>
          <select
            id="caption-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="min-h-11 rounded-full border border-black/8 bg-[#f7f2ea] px-4 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59]"
          >
            {LANGUAGES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => run()}
            disabled={busy !== null}
            className="inline-flex min-h-11 items-center justify-center gap-2.5 rounded-full bg-[#201d17] px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:opacity-92 disabled:cursor-wait disabled:opacity-60"
          >
            {busy === "all" ? (
              <span
                aria-hidden="true"
                className="size-3.5 rounded-full border-2 border-white/35 border-t-white motion-safe:animate-spin"
              />
            ) : null}
            {busy === "all" ? "Writing all…" : "Write All Platforms"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {CAPTION_PLATFORMS.map((platform) => {
          const meta = PLATFORM_META[platform];
          const done = Boolean(captions[platform]);
          const isActive = active === platform && done;

          return (
            <button
              key={platform}
              type="button"
              onClick={() => (done ? setActive(platform) : run(platform))}
              disabled={busy !== null}
              aria-pressed={isActive}
              className={`relative flex flex-col items-center gap-1.5 rounded-[1.4rem] border px-4 py-4 transition disabled:opacity-50 ${
                isActive
                  ? "border-[#201d17] bg-[#201d17] text-white"
                  : "border-black/8 bg-[#fcfaf6] text-[#201d17] hover:border-black/20"
              }`}
            >
              {busy === platform ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 m-auto size-5 self-center rounded-full border-2 border-[#8d7a5c]/40 border-t-[#201d17] motion-safe:animate-spin"
                />
              ) : null}
              <span className="text-xl" aria-hidden="true">
                {meta.icon}
              </span>
              <span className="text-sm font-semibold">{meta.label}</span>
              <span
                className={`text-[0.66rem] ${isActive ? "text-white/70" : "text-[#8d7a5c]"}`}
              >
                {done ? "Ready ✓" : meta.hint}
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="mt-5 rounded-[1.25rem] border border-[#e6b4b4] bg-[#fff0ef] px-4 py-3 text-sm leading-6 text-[#9b3d32]">
          {error}
        </p>
      ) : null}

      {current ? (
        <article className="mt-6 rounded-[1.75rem] border border-black/8 bg-[#fcfaf6] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true">{PLATFORM_META[current.platform].icon}</span>
              <p className="font-semibold text-[#201d17]">
                {PLATFORM_META[current.platform].label}
              </p>
              <span className="text-xs text-[#8d7a5c]">
                {current.charCount} characters
              </span>
            </div>
            <div className="flex items-center gap-4">
              {/*
                Posting is done by hand, so this is the step staff take on every
                post. Dragging to select a caption out of a card is what it
                replaces — and on a phone that selection is close to unusable.
              */}
              <button
                type="button"
                onClick={() => copy(current.caption, "caption")}
                className="text-xs font-semibold text-[#8d7a5c] underline underline-offset-2 transition hover:text-[#201d17]"
              >
                {copied === "caption" ? "Copied" : "Copy caption"}
              </button>
              <button
                type="button"
                onClick={() => run(current.platform)}
                disabled={busy !== null}
                className="text-xs font-semibold text-[#8d7a5c] underline underline-offset-2 transition hover:text-[#201d17] disabled:opacity-50"
              >
                Write again
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-[1.25rem] border border-black/8 bg-white p-4">
            <p className="whitespace-pre-wrap text-sm leading-7 text-[#201d17]">
              {current.caption}
            </p>
            <button
              type="button"
              onClick={() =>
                copy(
                  current.hashtags.length > 0
                    ? `${current.caption}\n\n${current.hashtags.join(" ")}`
                    : current.caption,
                  "all",
                )
              }
              className="mt-3 inline-flex h-9 items-center rounded-full border border-black/10 bg-[#f7f2ea] px-4 text-xs font-semibold text-[#201d17] transition hover:bg-black/4"
            >
              {copied === "all" ? "Copied ✓" : "Copy caption + hashtags"}
            </button>
          </div>

          {current.hashtags.length > 0 ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  Hashtags
                </p>
                <button
                  type="button"
                  onClick={() => copy(current.hashtags.join(" "), "tags")}
                  className="text-xs font-semibold text-[#8d7a5c] underline underline-offset-2 transition hover:text-[#201d17]"
                >
                  {copied === "tags" ? "Copied" : "Copy hashtags"}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {current.hashtags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => copy(tag, tag)}
                    title="Copy this hashtag"
                    className="rounded-full border border-black/8 bg-white px-3 py-1 text-xs text-[#5d574f] transition hover:border-black/20"
                  >
                    {copied === tag ? "Copied" : tag}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {current.tips.length > 0 ? (
            <div className="mt-4 border-t border-black/8 pt-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                Why this works on {PLATFORM_META[current.platform].label}
              </p>
              <ul className="mt-2 space-y-1.5">
                {current.tips.map((tip) => (
                  <li key={tip} className="flex gap-2 text-sm leading-6 text-[#5d574f]">
                    <span aria-hidden="true" className="text-[#b38a59]">
                      •
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() =>
              copy(
                `${current.caption}\n\n${current.hashtags.join(" ")}`.trim(),
                "all",
              )
            }
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#201d17] px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:opacity-92"
          >
            {copied === "all" ? "Copied" : "Copy Caption + Hashtags"}
          </button>
        </article>
      ) : (
        <p className="mt-6 rounded-[1.75rem] border border-dashed border-black/10 bg-[#f7f2ea] px-6 py-8 text-center text-sm leading-7 text-[#5d574f]">
          Pick a platform above, or write all four at once.
        </p>
      )}
    </section>
  );
}
