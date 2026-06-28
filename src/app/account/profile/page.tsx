"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Profile = {
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
};

const EMPTY: Profile = {
  full_name: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postcode: "",
  country: "MY",
};

const MY_STATES = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan",
  "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah",
  "Sarawak", "Selangor", "Terengganu",
  "Kuala Lumpur", "Labuan", "Putrajaya",
];

async function getToken() {
  const supabase = getSupabaseBrowser();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function ProfilePage() {
  const [form, setForm] = useState<Profile>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) { setLoading(false); return; }
      const res = await fetch("/api/account/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { profile } = await res.json();
        if (profile) setForm({ ...EMPTY, ...profile });
      }
      setLoading(false);
    });
  }, []);

  function set(key: keyof Profile, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const token = await getToken();
    if (!token) { setError("Not logged in."); setSaving(false); return; }

    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to save.");
    } else {
      setSaved(true);
    }
    setSaving(false);
  }

  const field = (
    label: string,
    key: keyof Profile,
    opts?: { type?: string; placeholder?: string; required?: boolean }
  ) => (
    <div>
      <label className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
        {label}
        {opts?.required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        type={opts?.type ?? "text"}
        value={form[key]}
        placeholder={opts?.placeholder}
        onChange={(e) => set(key, e.target.value)}
        className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#a07850] focus:ring-2 focus:ring-[#a07850]/20"
      />
    </div>
  );

  if (loading) {
    return (
      <main className="page-frame py-12">
        <div className="h-96 animate-pulse rounded-2xl bg-black/4" />
      </main>
    );
  }

  return (
    <main className="page-frame py-12">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/account" className="text-sm text-[#a09282] hover:text-[#201d17]">
          ← My Account
        </Link>
        <span className="text-[#a09282]">/</span>
        <span className="text-sm font-medium text-[#201d17]">Delivery Profile</span>
      </div>

      <h1 className="font-display mb-2 text-3xl font-semibold tracking-tight text-[#201d17]">
        Delivery Profile
      </h1>
      <p className="mb-8 text-sm text-[#6a6258]">
        Saved for faster checkout and courier shipments.
      </p>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        {field("Full name", "full_name", { placeholder: "As on IC / passport", required: true })}
        {field("Phone number", "phone", { type: "tel", placeholder: "01X-XXXXXXXX", required: true })}

        <hr className="border-black/8" />
        <p className="text-[0.8rem] font-semibold uppercase tracking-widest text-[#a09282]">
          Delivery Address
        </p>

        {field("Address line 1", "address_line1", { placeholder: "No. & street name", required: true })}
        {field("Address line 2", "address_line2", { placeholder: "Unit, floor, taman (optional)" })}

        <div className="grid grid-cols-2 gap-3">
          {field("Postcode", "postcode", { placeholder: "50000", required: true })}
          {field("City", "city", { placeholder: "Kuala Lumpur", required: true })}
        </div>

        <div>
          <label className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
            State <span className="ml-1 text-red-500">*</span>
          </label>
          <select
            value={form.state}
            onChange={(e) => set("state", e.target.value)}
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none transition focus:border-[#a07850] focus:ring-2 focus:ring-[#a07850]/20"
          >
            <option value="">Select state</option>
            {MY_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
        )}
        {saved && (
          <p className="rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-700">
            Profile saved.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-[#201d17] py-2.5 text-sm font-semibold text-white transition hover:bg-[#2e2a22] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </main>
  );
}
