"use client";

import { useState } from "react";

/** Sentinel for "not in the list" — never a real category label. */
const OTHER = "__other__";

const controlClass =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#a07850] focus:ring-2 focus:ring-[#a07850]/20";

type ProductTypeFieldProps = {
  categories: string[];
  defaultValue?: string;
};

/**
 * Product type: pick an existing one, or choose "Others" to name a new one.
 *
 * The free-text box used to sit under the dropdown at all times, which left two
 * fields claiming the same answer and no way to tell which one the form would
 * use. It now appears only when "Others" is chosen, so exactly one is active.
 *
 * The server reads `newCategoryLabel` first and falls back to `categoryLabel`,
 * so only the visible control is ever submitted.
 */
export function ProductTypeField({ categories, defaultValue }: ProductTypeFieldProps) {
  // An existing product whose type is no longer in the list still edits as a
  // free-text value rather than silently snapping to the first option.
  const [choice, setChoice] = useState(() =>
    defaultValue && !categories.includes(defaultValue) ? OTHER : (defaultValue ?? ""),
  );

  const isOther = choice === OTHER;

  return (
    <div>
      <label
        htmlFor="product-type"
        className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]"
      >
        Type <span className="text-red-500">*</span>
      </label>

      <select
        id="product-type"
        // Not submitted when "Others" is chosen: the sentinel must never reach
        // the server as a category label.
        name={isOther ? undefined : "categoryLabel"}
        required={!isOther}
        value={choice}
        onChange={(event) => setChoice(event.target.value)}
        className={controlClass}
      >
        <option value="" disabled>
          Select existing type…
        </option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
        <option value={OTHER}>Others — add a new type</option>
      </select>

      {isOther ? (
        <input
          type="text"
          name="newCategoryLabel"
          required
          autoFocus
          defaultValue={
            defaultValue && !categories.includes(defaultValue) ? defaultValue : ""
          }
          placeholder="Name the new type, e.g. Linen Mist"
          className={`mt-2 ${controlClass}`}
        />
      ) : null}
    </div>
  );
}
