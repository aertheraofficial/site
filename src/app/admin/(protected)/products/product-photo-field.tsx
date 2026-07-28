"use client";

import { useEffect, useState } from "react";

type ProductPhotoFieldProps = {
  required?: boolean;
  /** Shown until a new file is chosen, when editing a product that has one. */
  currentImageUrl?: string;
};

/**
 * Product photo picker with a preview.
 *
 * `accept="image/*"` is what makes a phone offer "Take Photo" next to the
 * gallery, so the camera is already available — `capture` is deliberately not
 * set, since it would force the camera and take away the ability to pick a
 * photo that was already edited on the phone.
 *
 * The preview matters most for camera shots: a blurred or badly lit photo is
 * otherwise only discovered after it is live on the shop.
 */
export function ProductPhotoField({
  required,
  currentImageUrl,
}: ProductPhotoFieldProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  // Object URLs hold the file in memory until they are revoked.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
    setFileName(file?.name ?? "");
  }

  const shown = preview ?? currentImageUrl ?? null;

  return (
    <div>
      <label
        htmlFor="product-photo"
        className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]"
      >
        Gambar produk {required ? <span className="text-red-500">*</span> : null}
      </label>

      <input
        id="product-photo"
        type="file"
        name="image"
        accept="image/*"
        required={required}
        onChange={handleChange}
        className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-[#201d17] file:px-4 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-white"
      />

      <p className="mt-1.5 text-xs leading-5 text-[#8d7a5c]">
        Guna telefon? Ketik medan di atas, kemudian pilih <strong>Camera</strong>{" "}
        untuk ambil gambar terus, atau <strong>Photos</strong> untuk pilih gambar
        sedia ada.
      </p>

      {shown ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-black/8 bg-[#faf6ef] p-3">
          {/* Plain <img>: an object: URL has no known dimensions and never
              benefits from the image optimiser. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shown}
            alt="Pratonton gambar produk"
            className="h-20 w-20 rounded-lg border border-black/8 object-cover"
          />
          <div className="min-w-0 text-xs text-[#5d574f]">
            <p className="font-semibold text-[#201d17]">
              {preview ? "Gambar baharu" : "Gambar sekarang"}
            </p>
            {fileName ? (
              <p className="truncate text-[#8d7a5c]">{fileName}</p>
            ) : null}
            <p className="mt-0.5 text-[#8d7a5c]">
              Pastikan produk jelas dan terang sebelum simpan.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
