"use client";

import { useEffect, useState } from "react";
import type { Orientation } from "@/lib/social/orientation";
import type { SceneReading } from "@/lib/social/studio-motion";
import type { ProductAnalysis } from "@/lib/social/studio-scenes";
import {
  DEFAULT_SHOT_TYPE,
  DEFAULT_VIDEO_DURATION,
  SHOT_TYPES,
  SHOT_TYPE_META,
  VIDEO_ASPECT_RATIO,
  VIDEO_DURATIONS,
  type ShotType,
  type VideoDuration,
} from "@/lib/social/video-options";

const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]";

function ReadingRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <p className="mt-1">{value || "—"}</p>
    </div>
  );
}

/** Veo takes a minute or two; checking faster only burns requests. */
const POLL_MS = 10_000;

type Phase = "idle" | "starting" | "working" | "ready" | "error";

type SceneVideoProps = {
  analysis: ProductAnalysis;
  scenePrompt: string;
  /** data: URL of the scene above — the frame Veo animates. */
  imageUrl: string;
  orientation: Orientation;
};

/**
 * Animate the scene above.
 *
 * The still is sent back to the server rather than regenerated: Veo animates the
 * pixels it is handed, so the label that survived the image pass is the one that
 * ends up in the clip. Nothing is stored here either — Google keeps the file for
 * two days and staff download it.
 */
export function SceneVideo({
  analysis,
  scenePrompt,
  imageUrl,
  orientation,
}: SceneVideoProps) {
  const [shotType, setShotType] = useState<ShotType>(DEFAULT_SHOT_TYPE);
  const [duration, setDuration] = useState<VideoDuration>(DEFAULT_VIDEO_DURATION);
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [operation, setOperation] = useState("");
  const [motionPrompt, setMotionPrompt] = useState("");
  const [reading, setReading] = useState<SceneReading | null>(null);
  const [error, setError] = useState("");
  const [waited, setWaited] = useState(0);

  // Poll while a job is open. Keyed on the operation so a second run replaces
  // the first rather than leaving two timers checking different jobs.
  useEffect(() => {
    if (phase !== "working" || !operation) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function check() {
      try {
        const response = await fetch(
          `/admin/social/studio/video?operation=${encodeURIComponent(operation)}`,
        );
        const data = await response.json().catch(() => null);
        if (cancelled) return;

        if (!response.ok) {
          setError(data?.error ?? "Could not check the clip.");
          setPhase("error");
          return;
        }

        if (data?.state === "ready") {
          setPhase("ready");
          return;
        }

        if (data?.state === "failed") {
          setError(data.error ?? "Veo could not make this clip.");
          setPhase("error");
          return;
        }

        timer = setTimeout(check, POLL_MS);
      } catch {
        if (cancelled) return;
        setError("Lost contact while the clip was rendering.");
        setPhase("error");
      }
    }

    timer = setTimeout(check, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, operation]);

  // A blank panel for two minutes reads as a hang, so the wait is counted out.
  useEffect(() => {
    if (phase !== "working") return;
    const tick = setInterval(() => setWaited((value) => value + 1), 1000);
    return () => clearInterval(tick);
  }, [phase]);

  async function start() {
    setError("");
    setMotionPrompt("");
    setReading(null);
    setOperation("");
    setWaited(0);
    setPhase("starting");

    try {
      // The scene only exists as a data: URL in this component, so it is turned
      // back into bytes here rather than kept on the server between steps.
      const sceneBlob = await fetch(imageUrl).then((response) => response.blob());

      const formData = new FormData();
      formData.append("sceneImage", sceneBlob, "scene.png");
      formData.append("analysis", JSON.stringify(analysis));
      formData.append("scenePrompt", scenePrompt);
      formData.append("orientation", orientation);
      formData.append("shotType", shotType);
      formData.append("duration", duration);
      formData.append("notes", notes);

      const response = await fetch("/admin/social/studio/video", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "Could not start the clip.");
        setPhase("error");
        return;
      }

      setOperation(data.operation);
      setMotionPrompt(data.motionPrompt ?? "");
      setReading(data.reading ?? null);
      setPhase("working");
    } catch {
      setError("Could not start the clip.");
      setPhase("error");
    }
  }

  const fileName = `${analysis.productName || "scene"}-${duration}s`;
  const videoSrc = operation
    ? `/admin/social/studio/video/file?operation=${encodeURIComponent(
        operation,
      )}&name=${encodeURIComponent(fileName)}`
    : "";
  const busy = phase === "starting" || phase === "working";

  return (
    <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
            Video
          </p>
          <h4 className="mt-2 font-display text-[1.6rem] leading-none tracking-[-0.04em] text-[#201d17]">
            Set the scene moving
          </h4>
        </div>
        <p className="text-xs text-[#8d7a5c]">
          Frames at {VIDEO_ASPECT_RATIO[orientation]}
          {orientation === "square"
            ? " — a square scene is cropped to vertical, so check the edges"
            : ""}
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          {/*
            First choice, because it decides every other rule. Ambience keeps
            hands off the product to protect the label; Demo does the opposite
            and only works where the label is out of the crop.
          */}
          <fieldset>
            <legend className={labelClass}>What the clip is for</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {SHOT_TYPES.map((value) => {
                const meta = SHOT_TYPE_META[value];
                const isActive = shotType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setShotType(value)}
                    aria-pressed={isActive}
                    disabled={busy}
                    className={`rounded-[1.25rem] border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      isActive
                        ? "border-[#201d17] bg-[#faf7f1]"
                        : "border-black/8 hover:border-black/20"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-[#201d17]">
                      {meta.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#8d7a5c]">
                      {meta.blurb}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-5 text-[#8d7a5c]">
              {SHOT_TYPE_META[shotType].hint}
            </p>
            {/* Both hand modes carry the same risk, so both get the warning. */}
            {shotType !== "ambience" ? (
              <p className="mt-2 rounded-[1rem] border border-[#e7d3a8] bg-[#fbf4e6] px-4 py-2.5 text-xs leading-5 text-[#8b5e1d]">
                Generate the scene with the <strong>Macro — open jar</strong>{" "}
                setting first. On any shot where the label is readable, a hand
                across it will rewrite the printed text.
              </p>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className={labelClass}>Clip length</legend>
            <div className="mt-3 flex gap-2">
              {VIDEO_DURATIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDuration(value)}
                  aria-pressed={duration === value}
                  disabled={busy}
                  className={`min-h-10 flex-1 rounded-full border px-4 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    duration === value
                      ? "border-[#201d17] bg-[#201d17] text-white"
                      : "border-black/8 bg-[#f7f2ea] text-[#201d17] hover:bg-white"
                  }`}
                >
                  {value} sec
                </button>
              ))}
            </div>
            {/*
              Worth saying plainly: staff ask for five seconds because that is
              what the brief says, and the model has no such setting.
            */}
            <p className="mt-2 text-xs text-[#8d7a5c]">
              Veo only makes 4, 6 or 8 second clips. Clips come back at 720p on
              the cheapest tier — enough to tell whether the shot suits the
              product. Re-render a keeper at full quality before posting.
            </p>
          </fieldset>

          <div>
            <label htmlFor="studio-motion-notes" className={labelClass}>
              What should move
            </label>
            <textarea
              id="studio-motion-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              disabled={busy}
              placeholder={
                shotType === "demo"
                  ? "e.g. the finger scoops from the near edge and lifts out to the right…"
                  : shotType === "open"
                    ? "e.g. the lid turns off and is set down to the left of the jar…"
                    : "e.g. she lets out a slow breath and settles back into the chair…"
              }
              className="mt-2 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white disabled:opacity-60"
            />
            <p className="mt-1.5 text-xs text-[#8d7a5c]">
              Leave it blank and Kimi decides from the picture. Ask for one small
              movement that could really happen — a busy clip warps faces and
              labels, and steam off a cold jar is what makes a video read as AI.
            </p>
          </div>

          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-[#201d17] px-6 text-[0.76rem] font-semibold uppercase tracking-[0.2em] text-white transition hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <span
                aria-hidden="true"
                className="size-4 rounded-full border-2 border-white/35 border-t-white motion-safe:animate-spin"
              />
            ) : null}
            {phase === "starting"
              ? "Starting…"
              : phase === "working"
                ? "Rendering…"
                : phase === "ready"
                  ? "Make another clip"
                  : "Animate scene"}
          </button>

          <p aria-live="polite" className="min-h-5 text-xs leading-5 text-[#8d7a5c]">
            {phase === "starting"
              ? "Kimi is writing the motion brief."
              : phase === "working"
                ? `Veo is rendering — usually one to two minutes. ${waited}s so far.`
                : ""}
          </p>
        </div>

        <div className="space-y-4">
          {phase === "error" ? (
            <p className="rounded-[1.25rem] border border-[#e6b4b4] bg-[#fff0ef] px-4 py-3 text-sm leading-6 text-[#9b3d32]">
              {error}
            </p>
          ) : null}

          {phase === "ready" ? (
            <article className="overflow-hidden rounded-[2rem] border border-black/8 bg-white">
              <video src={videoSrc} controls playsInline className="w-full bg-black" />
              <p className="border-t border-[#e7d3a8] bg-[#fbf4e6] px-5 py-3 text-sm leading-6 text-[#8b5e1d]">
                <strong className="font-semibold">Watch it once before posting.</strong>{" "}
                Motion can warp the label part-way through even when the first
                frame is clean.
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                <p className="text-xs text-[#8d7a5c]">
                  Kept for two days, then it is gone. Download it now.
                </p>
                <a
                  href={videoSrc}
                  download={`${fileName}.mp4`}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#201d17] px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:opacity-92"
                >
                  Download
                </a>
              </div>
            </article>
          ) : null}

          {phase !== "ready" ? (
            <div className="rounded-[1.75rem] border border-dashed border-black/10 bg-[#f7f2ea] px-6 py-14 text-center text-sm leading-7 text-[#5d574f]">
              {busy
                ? "Rendering. You can leave this tab open and come back."
                : "Your clip will appear here."}
            </div>
          ) : null}

          {motionPrompt ? (
            <details className="rounded-[1.75rem] border border-black/8 bg-[#fcfaf6] p-5">
              <summary className="cursor-pointer text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                What Kimi saw, and what it asked for
              </summary>
              <div className="mt-4 space-y-4 text-sm leading-7 text-[#5d574f]">
                {/*
                  The reading is shown before the brief because it is the part
                  worth arguing with. If Kimi read a closed jar as open, that is
                  visible here — and it explains everything the clip does.
                */}
                {reading ? (
                  <>
                    <ReadingRow label="Setting" value={reading.setting} />
                    <ReadingRow label="Light" value={reading.light} />
                    <ReadingRow label="Product" value={reading.productState} />
                    <ReadingRow label="People" value={reading.people} />
                    <ReadingRow label="Airflow" value={reading.airflow} />
                    <ReadingRow
                      label="Can give off vapour"
                      value={
                        reading.emitters.length > 0
                          ? reading.emitters.join(", ")
                          : "nothing in this frame"
                      }
                    />
                    <ReadingRow label="Could move" value={reading.couldMove.join(" · ")} />
                    <ReadingRow label="Must hold still" value={reading.mustHold.join(" · ")} />
                  </>
                ) : null}
                <div>
                  <p className={labelClass}>Motion brief</p>
                  <p className="mt-1 whitespace-pre-wrap">{motionPrompt}</p>
                </div>
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
}
