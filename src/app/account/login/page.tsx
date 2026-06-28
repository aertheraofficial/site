"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/account";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = getSupabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none ring-0 transition focus:border-[#a07850] focus:ring-2 focus:ring-[#a07850]/20"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-[0.8rem] font-medium text-[#201d17]">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-[#201d17] outline-none ring-0 transition focus:border-[#a07850] focus:ring-2 focus:ring-[#a07850]/20"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-[#201d17] py-2.5 text-sm font-semibold text-white transition hover:bg-[#2e2a22] disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="font-display mb-2 text-3xl font-semibold tracking-tight text-[#201d17]">
          Sign in
        </h1>
        <p className="mb-8 text-sm text-[#6a6258]">
          Access your order history and account details.
        </p>

        <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-black/4" />}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-[#6a6258]">
          No account?{" "}
          <Link href="/account/register" className="font-medium text-[#201d17] underline underline-offset-2">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
