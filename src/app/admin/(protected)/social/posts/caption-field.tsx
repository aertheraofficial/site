"use client";

import { useState, useTransition } from "react";
import { CAPTION_LANGUAGES, CAPTION_TONES } from "@/lib/social/caption-options";
import { generateCaptionAction } from "./actions";

const inputClass =
  "mt-2 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white";
const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]";

type CaptionFieldProps = {
  /** Whether the Kimi key is present, decided on the server. */
  aiAvailable: boolean;
};

/**
 * The caption box plus its "write it for me" button.
 *
 * Only this part of the composer is a client component. The rest of the form
 * stays server-rendered and posts normally, so if this JavaScript never loads
 * staff can still type a caption and save the post.
 */
export function CaptionField({ aiAvailable }: CaptionFieldProps) {
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function generate() {
    setError("");

    // Read the sibling fields straight off the form rather than lifting the
    // whole composer into client state for the sake of one button.
    const form = document.getElementById("studio-post-form") as HTMLFormElement | null;
    if (!form) return;

    const data = new FormData(form);
    const platform = data.getAll("platforms").map(String)[0] ?? "";

    startTransition(async () => {
      const result = await generateCaptionAction({
        topic: String(data.get("content") ?? ""),
        platform,
        niche: String(data.get("niche") ?? ""),
        tone: String(data.get("tone") ?? ""),
        language: String(data.get("language") ?? ""),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCaption(result.caption);
      setHashtags(result.hashtags);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="post-tone" className={labelClass}>
            Tone
          </label>
          <select id="post-tone" name="tone" defaultValue="casual" className={inputClass}>
            {CAPTION_TONES.map((tone) => (
              <option key={tone} value={tone} className="capitalize">
                {tone}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="post-language" className={labelClass}>
            Language
          </label>
          <select
            id="post-language"
            name="language"
            defaultValue="English"
            className={inputClass}
          >
            {CAPTION_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="post-caption" className={labelClass}>
            Caption
          </label>
          {aiAvailable ? (
            <button
              type="button"
              onClick={generate}
              disabled={pending}
              aria-disabled={pending}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-black/8 bg-[#f7f2ea] px-4 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#201d17] transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? (
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full border-2 border-[#8d7a5c]/40 border-t-[#201d17] motion-safe:animate-spin"
                />
              ) : null}
              {pending ? "Writing…" : "Write with AI"}
            </button>
          ) : null}
        </div>

        <textarea
          id="post-caption"
          name="caption"
          rows={4}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="The words that go out with the post."
          className={inputClass}
        />

        <p aria-live="polite" className="sr-only">
          {pending ? "Writing a caption" : ""}
        </p>

        {hashtags.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {hashtags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-black/8 bg-white px-3 py-1 text-xs text-[#5d574f]"
              >
                {tag}
              </span>
            ))}
            <button
              type="button"
              onClick={() =>
                setCaption((current) =>
                  `${current.trimEnd()}\n\n${hashtags.join(" ")}`.trim(),
                )
              }
              className="text-xs font-semibold text-[#8d7a5c] underline underline-offset-2 transition hover:text-[#201d17]"
            >
              Add to caption
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-[1rem] border border-[#e6b4b4] bg-[#fff0ef] px-4 py-2.5 text-sm leading-6 text-[#9b3d32]">
            {error}
          </p>
        ) : null}

        {!aiAvailable ? (
          <p className="mt-2 text-xs leading-5 text-[#8d7a5c]">
            Connect Kimi to have captions written for you.
          </p>
        ) : null}
      </div>
    </div>
  );
}
