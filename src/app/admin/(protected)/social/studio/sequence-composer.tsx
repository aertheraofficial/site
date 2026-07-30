"use client";

import { useEffect, useRef, useState } from "react";
import {
  ANCHOR_ORDER,
  SHOT_STAGES,
  STAGE_META,
  type ShotStage,
} from "@/lib/social/shot-stages";
import type { ProductAnalysis } from "@/lib/social/studio-scenes";
import type { PlannedShot, ShotList } from "@/lib/social/studio-shotlist";
import type { StudioProduct } from "./scene-composer";

const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]";

const POLL_MS = 10_000;

type StillState = { imageUrl: string; instruction: string };

type ClipState = {
  phase: "idle" | "working" | "ready" | "error";
  operation: string;
  motionPrompt: string;
  error: string;
};

const IDLE_CLIP: ClipState = {
  phase: "idle",
  operation: "",
  motionPrompt: "",
  error: "",
};

/**
 * Plan and shoot a whole sequence for one product.
 *
 * Three steps, deliberately separated so nothing expensive happens before staff
 * have seen what it will be. Planning is text only and costs almost nothing;
 * stills come next and can be redone one at a time; clips are last and are the
 * only part that costs real money.
 *
 * The anchor still is generated first and handed to every later shot as a
 * reference. Without it the shots come back with different people in them — the
 * words alone cannot hold a person steady across separate generations.
 */
export function SequenceComposer({ products }: { products: StudioProduct[] }) {
  const [slug, setSlug] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");

  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [list, setList] = useState<ShotList | null>(null);
  const [dropped, setDropped] = useState<Set<ShotStage>>(new Set());

  const [stills, setStills] = useState<Partial<Record<ShotStage, StillState>>>({});
  const [clips, setClips] = useState<Partial<Record<ShotStage, ClipState>>>({});

  const [planning, setPlanning] = useState(false);
  const [shooting, setShooting] = useState<ShotStage | "all" | null>(null);
  const [error, setError] = useState("");

  // Long polls outlive a click, so they are stopped when the panel goes away
  // rather than left writing into state that no longer exists.
  const cancelled = useRef(false);
  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const product = products.find((entry) => entry.slug === slug) ?? null;

  /** The chosen photo as bytes, whichever way it was chosen. */
  async function productBlob(): Promise<Blob | null> {
    if (file) return file;
    if (product) return fetch(product.image).then((response) => response.blob());
    return null;
  }

  const planned = list?.shots ?? [];
  const active = planned.filter(
    (shot) => shot.applies && shot.framing && !dropped.has(shot.stage),
  );
  const anchorStage =
    ANCHOR_ORDER.find((stage) => active.some((shot) => shot.stage === stage)) ?? null;

  function reset() {
    setAnalysis(null);
    setList(null);
    setDropped(new Set());
    setStills({});
    setClips({});
    setError("");
  }

  async function plan() {
    const blob = await productBlob();
    if (!blob) return;

    reset();
    setPlanning(true);
    try {
      const form = new FormData();
      form.append("productImage", blob, "product.png");
      const response = await fetch("/admin/social/studio/shotlist", {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Could not plan the sequence.");
        return;
      }
      setAnalysis(data.analysis);
      setList(data.shotList);
    } catch {
      setError("Could not plan the sequence.");
    } finally {
      setPlanning(false);
    }
  }

  async function shootStill(
    stage: ShotStage,
    reference?: Blob,
  ): Promise<string | null> {
    const blob = await productBlob();
    if (!blob || !list || !analysis) return null;

    const form = new FormData();
    form.append("productImage", blob, "product.png");
    form.append("stage", stage);
    form.append("analysis", JSON.stringify(analysis));
    form.append("shotList", JSON.stringify(list));
    if (reference) form.append("reference", reference, "reference.jpg");

    const response = await fetch("/admin/social/studio/shotlist/still", {
      method: "POST",
      body: form,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? `Could not shoot the ${stage} frame.`);
      return null;
    }

    setStills((current) => ({
      ...current,
      [stage]: { imageUrl: data.imageUrl, instruction: data.instruction },
    }));
    return data.imageUrl as string;
  }

  async function asBlob(dataUrl: string) {
    return fetch(dataUrl).then((response) => response.blob());
  }

  /** Anchor first, then everything else matched against it. */
  async function shootAll() {
    if (!anchorStage) return;
    setError("");
    setShooting("all");
    try {
      const anchorUrl = stills[anchorStage]?.imageUrl ?? (await shootStill(anchorStage));
      if (!anchorUrl || cancelled.current) return;
      const reference = await asBlob(anchorUrl);

      for (const shot of active) {
        if (cancelled.current) return;
        if (shot.stage === anchorStage || stills[shot.stage]) continue;
        await shootStill(shot.stage, reference);
      }
    } finally {
      setShooting(null);
    }
  }

  async function reshoot(stage: ShotStage) {
    setError("");
    setShooting(stage);
    try {
      const anchorUrl = anchorStage ? stills[anchorStage]?.imageUrl : "";
      const reference =
        anchorUrl && stage !== anchorStage ? await asBlob(anchorUrl) : undefined;
      await shootStill(stage, reference);
    } finally {
      setShooting(null);
    }
  }

  async function renderClip(shot: PlannedShot) {
    const still = stills[shot.stage];
    if (!still) return;
    const meta = STAGE_META[shot.stage];

    setClips((current) => ({
      ...current,
      [shot.stage]: { ...IDLE_CLIP, phase: "working" },
    }));

    try {
      const form = new FormData();
      form.append("sceneImage", await asBlob(still.imageUrl), "scene.jpg");
      form.append("analysis", JSON.stringify(analysis ?? {}));
      // The instruction that actually made this frame, not the plan's framing —
      // the art-direction pass rewrites it, and the motion brief should describe
      // the picture that exists.
      form.append("scenePrompt", still.instruction);
      form.append("orientation", "portrait");
      form.append("shotType", meta.shotType);
      form.append("duration", meta.seconds);
      form.append("notes", `${shot.action} Sound: ${shot.sound}`);

      const response = await fetch("/admin/social/studio/video", {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setClips((current) => ({
          ...current,
          [shot.stage]: {
            ...IDLE_CLIP,
            phase: "error",
            error: data?.error ?? "Could not start the clip.",
          },
        }));
        return;
      }

      setClips((current) => ({
        ...current,
        [shot.stage]: {
          ...IDLE_CLIP,
          phase: "working",
          operation: data.operation,
          motionPrompt: data.motionPrompt ?? "",
        },
      }));

      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        if (cancelled.current) return;

        const poll = await fetch(
          `/admin/social/studio/video?operation=${encodeURIComponent(data.operation)}`,
        );
        const status = await poll.json().catch(() => null);
        if (!poll.ok || status?.state === "failed") {
          setClips((current) => ({
            ...current,
            [shot.stage]: {
              ...(current[shot.stage] ?? IDLE_CLIP),
              phase: "error",
              error: status?.error ?? "Veo could not make this clip.",
            },
          }));
          return;
        }
        if (status?.state === "ready") {
          setClips((current) => ({
            ...current,
            [shot.stage]: {
              ...(current[shot.stage] ?? IDLE_CLIP),
              phase: "ready",
            },
          }));
          return;
        }
      }
    } catch {
      setClips((current) => ({
        ...current,
        [shot.stage]: { ...IDLE_CLIP, phase: "error", error: "Could not render." },
      }));
    }
  }

  const chosen = Boolean(file || slug);
  const readyToShoot = active.length > 0;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
          Sequence
        </p>
        <h4 className="mt-2 font-display text-[1.6rem] leading-none tracking-[-0.04em] text-[#201d17]">
          Plan a whole ad from one product
        </h4>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5d574f]">
          A scent cannot be filmed, only what it does — touch, the mark it leaves,
          and the body&rsquo;s answer, in that order. Kimi works out what those
          five stages mean for this product and drops the ones it cannot film
          honestly. Planning is text only and costs almost nothing; look at it
          before shooting anything.
        </p>

        <div className="mt-5">
          <p className={labelClass}>Product</p>
          <div className="mt-3 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
            {products
              .filter((entry) =>
                entry.name.toLowerCase().includes(query.trim().toLowerCase()),
              )
              .slice(0, 40)
              .map((entry) => (
                <button
                  key={entry.slug}
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setSlug(slug === entry.slug ? "" : entry.slug);
                    reset();
                  }}
                  className={`flex items-center gap-2 rounded-[1rem] border p-2 text-left transition ${
                    slug === entry.slug
                      ? "border-[#201d17] bg-[#f7f2ea]"
                      : "border-black/8 bg-white hover:bg-[#faf6ef]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.image}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                  <span className="min-w-0 truncate text-xs font-medium text-[#201d17]">
                    {entry.name}
                  </span>
                </button>
              ))}
          </div>
          {products.length > 8 ? (
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products"
              className="mt-3 w-full rounded-[1.25rem] border border-black/8 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59]"
            />
          ) : null}

          <label htmlFor="sequence-upload" className="sr-only">
            Or upload a product photo
          </label>
          <input
            id="sequence-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              setSlug("");
              setFile(event.target.files?.[0] ?? null);
              reset();
            }}
            className="mt-3 w-full rounded-[1.25rem] border border-black/8 bg-white px-4 py-3 text-sm text-[#201d17] file:mr-3 file:rounded-full file:border-0 file:bg-[#201d17] file:px-4 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-white"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={plan}
            disabled={!chosen || planning}
            className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#201d17] px-6 text-[0.76rem] font-semibold uppercase tracking-[0.2em] text-white transition hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {planning ? (
              <span
                aria-hidden="true"
                className="size-4 rounded-full border-2 border-white/35 border-t-white motion-safe:animate-spin"
              />
            ) : null}
            {planning ? "Planning…" : list ? "Plan again" : "Plan sequence"}
          </button>

          {readyToShoot ? (
            <button
              type="button"
              onClick={shootAll}
              disabled={shooting !== null}
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-black/10 px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-[#f7f2ea] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {shooting === "all" ? "Shooting…" : `Shoot ${active.length} frames`}
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="mt-4 rounded-[1.25rem] border border-[#e6b4b4] bg-[#fff0ef] px-4 py-3 text-sm leading-6 text-[#9b3d32]">
            {error}
          </p>
        ) : null}
      </section>

      {list ? (
        <>
          <section className="rounded-[1.75rem] border border-black/8 bg-[#fcfaf6] p-6">
            <p className={labelClass}>The sequence</p>
            <p className="mt-2 text-sm leading-7 text-[#201d17]">{list.through}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className={labelClass}>The one person in every shot</p>
                <p className="mt-1 text-sm leading-6 text-[#5d574f]">
                  {list.cast || "No people in this sequence."}
                </p>
              </div>
              <div>
                <p className={labelClass}>The place</p>
                <p className="mt-1 text-sm leading-6 text-[#5d574f]">
                  {list.surface || "—"}
                </p>
              </div>
            </div>
          </section>

          <div className="space-y-4">
            {SHOT_STAGES.map((stage) => {
              const shot = planned.find((entry) => entry.stage === stage);
              if (!shot) return null;
              const meta = STAGE_META[stage];
              const isDropped = dropped.has(stage);
              const still = stills[stage];
              const clip = clips[stage] ?? IDLE_CLIP;
              const unusable = !shot.applies || !shot.framing;

              return (
                <article
                  key={stage}
                  className={`overflow-hidden rounded-[1.75rem] border bg-white ${
                    unusable || isDropped ? "border-dashed border-black/12" : "border-black/8"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#201d17]">
                          {meta.label}
                        </span>
                        {stage === anchorStage ? (
                          <span className="rounded-full bg-[#f7f2ea] px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8d7a5c]">
                            Anchor
                          </span>
                        ) : null}
                        {meta.medium === "still" ? (
                          <span className="rounded-full bg-[#f7f2ea] px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8d7a5c]">
                            Still
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 max-w-xl text-sm leading-6 text-[#5d574f]">
                        {shot.reason}
                      </p>
                      {!unusable ? (
                        <dl className="mt-3 space-y-1 text-sm leading-6 text-[#5d574f]">
                          <div className="flex gap-2">
                            <dt className={`${labelClass} shrink-0 pt-1`}>Action</dt>
                            <dd>{shot.action}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className={`${labelClass} shrink-0 pt-1`}>Sound</dt>
                            <dd>{shot.sound}</dd>
                          </div>
                        </dl>
                      ) : null}
                    </div>

                    {unusable ? (
                      <span className="rounded-full border border-black/10 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#8d7a5c]">
                        Not for this product
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setDropped((current) => {
                            const next = new Set(current);
                            if (next.has(stage)) next.delete(stage);
                            else next.add(stage);
                            return next;
                          })
                        }
                        className="rounded-full border border-black/10 px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#201d17] transition hover:bg-[#f7f2ea]"
                      >
                        {isDropped ? "Put back" : "Drop"}
                      </button>
                    )}
                  </div>

                  {still && !isDropped ? (
                    <div className="grid gap-4 border-t border-black/8 p-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={still.imageUrl}
                        alt={`${meta.label} frame`}
                        className="w-full rounded-[1rem]"
                      />
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => reshoot(stage)}
                            disabled={shooting !== null}
                            className="min-h-10 rounded-full border border-black/10 px-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#201d17] transition hover:bg-[#f7f2ea] disabled:opacity-40"
                          >
                            {shooting === stage ? "Reshooting…" : "Reshoot frame"}
                          </button>

                          {meta.medium === "still" ? (
                            <a
                              href={still.imageUrl}
                              download={`${stage}.png`}
                              className="inline-flex min-h-10 items-center rounded-full bg-[#201d17] px-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:opacity-92"
                            >
                              Download
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => renderClip(shot)}
                              disabled={clip.phase === "working"}
                              className="min-h-10 rounded-full bg-[#201d17] px-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:opacity-92 disabled:opacity-40"
                            >
                              {clip.phase === "working"
                                ? "Rendering…"
                                : clip.phase === "ready"
                                  ? "Render again"
                                  : "Render clip"}
                            </button>
                          )}
                        </div>

                        {clip.phase === "error" ? (
                          <p className="rounded-[1rem] border border-[#e6b4b4] bg-[#fff0ef] px-3 py-2 text-sm leading-6 text-[#9b3d32]">
                            {clip.error}
                          </p>
                        ) : null}

                        {clip.phase === "ready" ? (
                          <div className="space-y-2">
                            <video
                              src={`/admin/social/studio/video/file?operation=${encodeURIComponent(
                                clip.operation,
                              )}&name=${stage}`}
                              controls
                              playsInline
                              className="w-full rounded-[1rem] bg-black"
                            />
                            <a
                              href={`/admin/social/studio/video/file?operation=${encodeURIComponent(
                                clip.operation,
                              )}&name=${stage}`}
                              download={`${stage}.mp4`}
                              className="inline-flex min-h-10 items-center rounded-full bg-[#201d17] px-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:opacity-92"
                            >
                              Download clip
                            </a>
                          </div>
                        ) : null}

                        {clip.motionPrompt ? (
                          <details>
                            <summary className={`${labelClass} cursor-pointer`}>
                              Motion brief
                            </summary>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#5d574f]">
                              {clip.motionPrompt}
                            </p>
                          </details>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <p className="rounded-[1.25rem] border border-[#e7d3a8] bg-[#fbf4e6] px-5 py-4 text-sm leading-7 text-[#8b5e1d]">
            <strong className="font-semibold">Joining them is a CapCut job.</strong>{" "}
            Download each clip in order and put the still last. Any words —
            product name, link, price — get typed over the final frame by hand.
            Never let the AI write them: text it draws comes back misspelled, and
            on a label that is a claim about the product.
          </p>
        </>
      ) : null}
    </div>
  );
}
