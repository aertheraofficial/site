"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Profile = {
  full_name: string;
  phone: string;
  preferred_name: string;
  social_handle: string;
  birthday: string;
};

const EMPTY: Profile = {
  full_name: "",
  phone: "",
  preferred_name: "",
  social_handle: "",
  birthday: "",
};

async function getToken() {
  const supabase = getSupabaseBrowser();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function ProfilePage() {
  const [form, setForm] = useState<Profile>(EMPTY);
  const [email, setEmail] = useState("");
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
        const { profile, email: accountEmail } = await res.json();
        if (profile) setForm({ ...EMPTY, ...profile });
        if (accountEmail) setEmail(accountEmail);
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
        <span className="text-sm font-medium text-[#201d17]">My Profile</span>
      </div>

      <h1 className="font-display mb-2 text-3xl font-semibold tracking-tight text-[#201d17]">
        My Profile
      </h1>
      <p className="mb-8 text-sm text-[#6a6258]">
        Your personal details. Delivery address is entered at checkout instead,
        since it&apos;s only needed for orders shipped to you.
      </p>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        {field("Full name", "full_name", { placeholder: "As on IC / passport", required: true })}
        {field("Preferred name", "preferred_name", { placeholder: "What should we call you?" })}
        {field("Phone number", "phone", { type: "tel", placeholder: "01X-XXXXXXXX", required: true })}

        <div>
          <label className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
            Email
          </label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-black/10 bg-black/4 px-4 py-2.5 text-sm text-[#6a6258]"
          />
          <p className="mt-1.5 text-xs text-[#a09282]">
            Tied to your login — contact us to change it.
          </p>
        </div>

        {field("Social media (Instagram/TikTok handle)", "social_handle", { placeholder: "@yourhandle" })}
        {field("Birthday", "birthday", { type: "date" })}

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
