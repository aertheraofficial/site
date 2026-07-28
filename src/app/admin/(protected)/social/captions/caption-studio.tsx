"use client";

import { useState, useTransition } from "react";
import { CAPTION_TONES } from "@/lib/social/caption-options";
import { PLATFORM_META, type CaptionPlatform } from "@/lib/social/platform-rules";
import type { PlatformCaption } from "@/lib/social/studio-platform-captions";
import { generateTopicCaptionsAction } from "./actions";

const inputClass =
  "mt-2 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white";
const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]";

/** Suggestions, not a fixed list — staff can type any language. */
const LANGUAGE_SUGGESTIONS = ["Bahasa Malaysia", "English", "Manglish", "Mandarin"];

export function CaptionStudio() {
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [tone, setTone] = useState<string>(CAPTION_TONES[0]);
  const [language, setLanguage] = useState("Bahasa Malaysia");
  const [captions, setCaptions] = useState<PlatformCaption[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await generateTopicCaptionsAction({
        topic,
        niche,
        tone,
        language,
      });
      if (!result.ok) {
        setError(result.error);
        setCaptions([]);
        return;
      }
      setCaptions(result.captions);
      if (result.failed.length > 0) {
        setError(
          `Could not write: ${result.failed
            .map((f) => PLATFORM_META[f.platform as CaptionPlatform]?.label ?? f.platform)
            .join(", ")}.`,
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

  return (
    <div className="space-y-6">
      <form
        onSubmit={submit}
        className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7"
      >
        <div>
          <label htmlFor="caption-topic" className={labelClass}>
            Topic / content idea
          </label>
          <textarea
            id="caption-topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            required
            rows={3}
            placeholder="New pandan balm launch, restock of the Calm collection…"
            className={inputClass}
          />
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <div>
            <label htmlFor="caption-niche" className={labelClass}>
              Niche
            </label>
            <input
              id="caption-niche"
              value={niche}
              onChange={(event) => setNiche(event.target.value)}
              placeholder="wellness, gifting…"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="caption-tone" className={labelClass}>
              Tone
            </label>
            <select
              id="caption-tone"
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              className={inputClass}
            >
              {CAPTION_TONES.map((option) => (
                <option key={option} value={option} className="capitalize">
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="caption-lang" className={labelClass}>
              Language
            </label>
            <input
              id="caption-lang"
              list="caption-lang-options"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className={inputClass}
            />
            <datalist id="caption-lang-options">
              {LANGUAGE_SUGGESTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#201d17] px-6 text-[0.76rem] font-semibold uppercase tracking-[0.2em] text-white transition hover:opacity-92 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? (
            <span
              aria-hidden="true"
              className="size-4 rounded-full border-2 border-white/35 border-t-white motion-safe:animate-spin"
            />
          ) : null}
          {pending ? "Writing all four…" : "Write for All Platforms"}
        </button>

        <p aria-live="polite" className="mt-3 min-h-5 text-xs leading-5 text-[#8d7a5c]">
          {pending ? "Kimi is writing one caption per network." : ""}
        </p>
      </form>

      {error ? (
        <p className="rounded-[1.25rem] border border-[#e6b4b4] bg-[#fff0ef] px-4 py-3 text-sm leading-6 text-[#9b3d32]">
          {error}
        </p>
      ) : null}

      {captions.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {captions.map((caption) => {
            const meta = PLATFORM_META[caption.platform];
            const full = `${caption.caption}\n\n${caption.hashtags.join(" ")}`.trim();

            return (
              <article
                key={caption.platform}
                className="rounded-[1.75rem] border border-black/8 bg-white p-5 shadow-[0_16px_48px_rgba(32,29,23,0.04)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden="true">{meta.icon}</span>
                    <p className="font-semibold text-[#201d17]">{meta.label}</p>
                    <span className="text-xs text-[#8d7a5c]">
                      {caption.charCount} chars
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(full, caption.platform)}
                    className="inline-flex min-h-9 items-center rounded-full border border-black/10 bg-[#f7f2ea] px-4 text-xs font-semibold text-[#201d17] transition hover:bg-white"
                  >
                    {copied === caption.platform ? "Copied" : "Copy"}
                  </button>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#201d17]">
                  {caption.caption}
                </p>

                {caption.hashtags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {caption.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-black/8 bg-[#f7f2ea] px-2.5 py-0.5 text-xs text-[#5d574f]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {caption.tips.length > 0 ? (
                  <ul className="mt-4 space-y-1.5 border-t border-black/8 pt-3">
                    {caption.tips.map((tip) => (
                      <li
                        key={tip}
                        className="flex gap-2 text-xs leading-5 text-[#8d7a5c]"
                      >
                        <span aria-hidden="true" className="text-[#b38a59]">
                          •
                        </span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
