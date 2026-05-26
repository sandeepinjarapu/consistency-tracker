"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-xl font-light tracking-tight">Consistency Tracker</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Sign in to start tracking.
          </p>
        </div>

        <Suspense fallback={<LoginButtonFallback />}>
          <LoginContent />
        </Suspense>
      </div>
    </main>
  );
}

function LoginButtonFallback() {
  return (
    <div className="w-full border border-[color:var(--border)] rounded-lg py-3 text-sm text-center text-[color:var(--muted)]">
      Loading…
    </div>
  );
}

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const next = searchParams.get("next") ?? "/consistencytracker";

  async function signInWithGoogle() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setLoading(false);
      console.error(error);
    }
  }

  return (
    <>
      <button
        onClick={signInWithGoogle}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 border border-[color:var(--border)] rounded-lg py-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
      >
        <GoogleIcon />
        {loading ? "Redirecting…" : "Continue with Google"}
      </button>

      {error ? (
        <p className="mt-4 text-xs text-red-600 text-center">
          Something went wrong. Try again.
        </p>
      ) : null}
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
