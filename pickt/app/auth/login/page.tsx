"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const isExtension = searchParams.get("extension") === "true";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [extensionDone, setExtensionDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If opened from extension, store the token for the extension to pick up
    if (isExtension && data.session) {
      try {
        localStorage.setItem(
          "pickt_extension_token",
          JSON.stringify({
            access_token: data.session.access_token,
            user: {
              id: data.user.id,
              email: data.user.email,
              full_name: data.user.user_metadata?.full_name || null,
            },
          })
        );
        setExtensionDone(true);
        setLoading(false);
        return;
      } catch {}
    }

    // Hard redirect so middleware picks up the fresh session cookies
    window.location.href = "/dashboard";
  }

  // Poll for extension to pick up the token
  useEffect(() => {
    if (!extensionDone) return;
    const interval = setInterval(() => {
      const token = localStorage.getItem("pickt_extension_token");
      if (!token) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [extensionDone]);

  if (extensionDone) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <Logo size="lg" />
          <div className="rounded-xl bg-surface p-8 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-green/15 text-2xl">
              ✓
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Connected to extension
            </h2>
            <p className="text-sm text-neutral-400">
              You can close this tab and return to your ATS. The pickt extension
              is now signed in.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Logo size="lg" />
          <p className="mt-3 text-sm text-neutral-400">
            {isExtension
              ? "Sign in to connect the pickt extension"
              : "Sign in to your account"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl bg-surface p-8 space-y-5"
        >
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-neutral-300 mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-background border border-neutral-700 px-4 py-2.5 text-sm text-white placeholder-neutral-500 outline-none focus:border-accent-green focus:ring-1 focus:ring-accent-green transition-colors"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-neutral-300 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-background border border-neutral-700 px-4 py-2.5 text-sm text-white placeholder-neutral-500 outline-none focus:border-accent-green focus:ring-1 focus:ring-accent-green transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-background hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-center text-sm text-neutral-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/signup"
              className="text-accent-green hover:underline"
            >
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
