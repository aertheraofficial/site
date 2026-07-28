"use client";

import { useRef, useState, useTransition } from "react";
import { ORIENTATIONS, type Orientation } from "@/lib/social/orientation";
import { generateSceneAction, type SceneActionResult } from "./actions";
import { SceneCaptions } from "./scene-captions";

const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]";

/** Preset looks, carried over from medsoc so staff pick rather than describe. */
const STYLES = [
  "Minimalist & Clean",
  "Luxury & Premium",
  "Natural & Organic",
  "Bold & Vibrant",
  "Soft Pastel",
  "Dark & Moody",
  "Fresh & Bright",
];

/** Preview boxes, sized to show the shape at a glance. */
const ORIENTATION_META: Record<
  Orientation,
  { label: string; ratio: string; w: number; h: number }
> = {
  square: { label: "Square", ratio: "1:1", w: 44, h: 44 },
  portrait: { label: "Portrait", ratio: "9:16", w: 28, h: 50 },
  landscape: { label: "Landscape", ratio: "16:9", w: 56, h: 32 },
};

const MAX_MB = 8;

export type StudioProduct = {
  slug: string;
  name: string;
  size: string;
  image: string;
};

export function SceneComposer({ products }: { products: StudioProduct[] }) {
  const [result, setResult] = useState<SceneActionResult | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [slug, setSlug] = useState("");
  const [preview, setPreview] = useState("");
  const [query, setQuery] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("square");
  const [style, setStyle] = useState(STYLES[0]);
  const [notes, setNotes] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(next: File | null) {
    setResult(null);
    setFile(next);
    // An upload replaces a chosen product, so only one source is ever live.
    setSlug("");
    setPreview(next ? URL.createObjectURL(next) : "");
  }

  function pickProduct(product: StudioProduct) {
    setResult(null);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    // Tapping the selected product clears it. Decided once, so the slug and the
    // preview can never disagree about what is chosen.
    const deselecting = slug === product.slug;
    setSlug(deselecting ? "" : product.slug);
    setPreview(deselecting ? "" : product.image);
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped?.type.startsWith("image/")) pick(dropped);
  }

  function reset() {
    pick(null);
    setSlug("");
    setQuery("");
    setNotes("");
    setStyle(STYLES[0]);
    setOrientation("square");
    if (fileRef.current) fileRef.current.value = "";
  }

  function generate() {
    if (!file && !slug) return;
    const formData = new FormData();
    if (file) formData.append("productImage", file);
    if (slug) formData.append("productSlug", slug);
    formData.append("orientation", orientation);
    formData.append("style", style);
    formData.append("notes", notes);

    setResult(null);
    startTransition(async () => {
      setResult(await generateSceneAction(formData));
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="h-fit space-y-5 rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_20px_60px_rgba(32,29,23,0.05)] sm:p-7">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8d7a5c]">
              Product photo
            </p>
            <h4 className="mt-2 font-display text-[1.6rem] leading-none tracking-[-0.04em] text-[#201d17]">
              Turn a plain shot into a scene
            </h4>
          </div>

          {/*
            Drag and drop, with the file input kept as the real control so the
            keyboard and screen-reader path is the same one everyone else uses.
          */}
          <div
            onDrop={onDrop}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            className={`rounded-[1.5rem] border-2 border-dashed p-6 text-center transition ${
              dragging ? "border-[#b38a59] bg-[#f7f2ea]" : "border-black/12 bg-[#fcfaf6]"
            }`}
          >
            {preview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="The product photo you chose"
                  className="mx-auto max-h-44 rounded-[1rem] object-contain"
                />
                <p className="mt-3 truncate text-xs text-[#8d7a5c]">{file?.name}</p>
              </>
            ) : (
              <p className="text-sm leading-6 text-[#5d574f]">
                Pick a product below, or drag a photo here.
                <span className="mt-1 block text-xs text-[#8d7a5c]">
                  JPG, PNG or WebP — up to {MAX_MB} MB
                </span>
              </p>
            )}

            <label htmlFor="studio-image" className="sr-only">
              Product photo
            </label>
            <input
              id="studio-image"
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => pick(event.target.files?.[0] ?? null)}
              className="mt-4 w-full rounded-[1.25rem] border border-black/8 bg-white px-4 py-3 text-sm text-[#201d17] file:mr-3 file:rounded-full file:border-0 file:bg-[#201d17] file:px-4 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-white"
            />
          </div>

          {/*
            The shop already has a photo of everything it sells, so the common
            case is choosing one — uploading is for a shot that is not in the
            catalog yet. Whichever is touched last clears the other, so the
            action never has to guess which one was meant.
          */}
          {products.length > 0 ? (
            <div>
              <p className={labelClass}>Or use a product you already sell</p>
              {products.length > 8 ? (
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search products"
                  className="mt-2 w-full rounded-[1.25rem] border border-black/8 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59]"
                />
              ) : null}
              <div className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {products
                  .filter((product) =>
                    product.name.toLowerCase().includes(query.trim().toLowerCase()),
                  )
                  .slice(0, 60)
                  .map((product) => {
                    const isActive = slug === product.slug;
                    return (
                      <button
                        key={product.slug}
                        type="button"
                        onClick={() => pickProduct(product)}
                        className={`flex items-center gap-2 rounded-[1rem] border p-2 text-left transition ${
                          isActive
                            ? "border-[#201d17] bg-[#f7f2ea]"
                            : "border-black/8 bg-white hover:bg-[#faf6ef]"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.image}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-[#201d17]">
                            {product.name}
                          </span>
                          <span className="block truncate text-[0.68rem] text-[#8d7a5c]">
                            {product.size}
                          </span>
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : null}

          <fieldset>
            <legend className={labelClass}>Output size</legend>
            <div className="mt-3 flex gap-3">
              {ORIENTATIONS.map((value) => {
                const meta = ORIENTATION_META[value];
                const isActive = orientation === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOrientation(value)}
                    aria-pressed={isActive}
                    className={`flex flex-1 flex-col items-center gap-2 rounded-[1.25rem] border px-3 py-4 transition ${
                      isActive
                        ? "border-[#201d17] bg-[#faf7f1]"
                        : "border-black/8 hover:border-black/20"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      style={{ width: meta.w, height: meta.h }}
                      className={`rounded ${isActive ? "bg-[#201d17]" : "bg-[#ded4c4]"}`}
                    />
                    <span className="text-xs font-semibold text-[#201d17]">
                      {meta.label}
                    </span>
                    <span className="text-[0.66rem] text-[#8d7a5c]">{meta.ratio}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className={labelClass}>Style</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {STYLES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStyle(option)}
                  aria-pressed={style === option}
                  className={`min-h-9 rounded-full border px-4 text-xs font-semibold transition ${
                    style === option
                      ? "border-[#201d17] bg-[#201d17] text-white"
                      : "border-black/8 bg-[#f7f2ea] text-[#201d17] hover:bg-white"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="studio-notes" className={labelClass}>
              Anything to add
            </label>
            <textarea
              id="studio-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="e.g. beach setting, sea blue tones, late afternoon light…"
              className="mt-2 w-full rounded-[1.25rem] border border-black/8 bg-[#f7f2ea] px-4 py-3 text-sm text-[#201d17] outline-none transition focus:border-[#b38a59] focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={generate}
              // Either source will do — a picked product is as good as an
              // upload. Matches the guard in generate().
              disabled={(!file && !slug) || pending}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-3 rounded-full bg-[#201d17] px-6 text-[0.76rem] font-semibold uppercase tracking-[0.2em] text-white transition hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? (
                <span
                  aria-hidden="true"
                  className="size-4 rounded-full border-2 border-white/35 border-t-white motion-safe:animate-spin"
                />
              ) : null}
              {pending ? "Making the scene…" : "Generate Scene"}
            </button>
            {file || slug || result ? (
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/10 px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#201d17] transition hover:bg-[#f7f2ea]"
              >
                Reset
              </button>
            ) : null}
          </div>

          <p aria-live="polite" className="min-h-5 text-xs leading-5 text-[#8d7a5c]">
            {pending
              ? "Kimi is reading the product and writing the art direction, then Gemini draws it. Usually 15–30 seconds."
              : ""}
          </p>
        </div>

        <div className="space-y-4">
          {result && !result.ok ? (
            <p className="rounded-[1.25rem] border border-[#e6b4b4] bg-[#fff0ef] px-4 py-3 text-sm leading-6 text-[#9b3d32]">
              {result.error}
            </p>
          ) : null}

          {result?.ok ? (
            <>
              <article className="overflow-hidden rounded-[2rem] border border-black/8 bg-white shadow-[0_20px_60px_rgba(32,29,23,0.05)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.imageUrl}
                  alt={`${result.analysis.productName} in a generated scene`}
                  className="w-full"
                />
                <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#201d17]">
                      {result.analysis.productName}
                    </p>
                    <p className="text-xs text-[#8d7a5c]">
                      Nothing is saved — download it before you leave this page.
                    </p>
                  </div>
                  <a
                    href={result.imageUrl}
                    download={result.fileName}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#201d17] px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:opacity-92"
                  >
                    Download
                  </a>
                </div>
              </article>

              <details className="rounded-[1.75rem] border border-black/8 bg-[#fcfaf6] p-5">
                <summary className="cursor-pointer text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#8d7a5c]">
                  What the AI saw and asked for
                </summary>
                <div className="mt-4 space-y-4 text-sm leading-7 text-[#5d574f]">
                  <div>
                    <p className={labelClass}>Text read on the product</p>
                    <p className="mt-1">{result.analysis.visibleText || "—"}</p>
                  </div>
                  <div>
                    <p className={labelClass}>Audience</p>
                    <p className="mt-1">{result.analysis.targetAudience || "—"}</p>
                  </div>
                  <div>
                    <p className={labelClass}>Mood</p>
                    <p className="mt-1">
                      {[result.analysis.mood, result.analysis.brandAesthetic]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  <div>
                    <p className={labelClass}>Art direction</p>
                    <p className="mt-1 whitespace-pre-wrap">{result.scenePrompt}</p>
                  </div>
                </div>
              </details>
            </>
          ) : null}

          {!result && !pending ? (
            <div className="rounded-[1.75rem] border border-dashed border-black/10 bg-[#f7f2ea] px-6 py-14 text-center text-sm leading-7 text-[#5d574f]">
              Your generated scene will appear here.
            </div>
          ) : null}
        </div>
      </div>

      {result?.ok ? (
        <SceneCaptions analysis={result.analysis} scenePrompt={result.scenePrompt} />
      ) : null}
    </div>
  );
}
