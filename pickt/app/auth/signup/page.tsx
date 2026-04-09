"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    // 1. Sign up via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_name: companyName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      setError("Signup failed. Please try again.");
      setLoading(false);
      return;
    }

    // 2. Create company row
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({ name: companyName })
      .select("id")
      .single();

    if (companyError) {
      setError(companyError.message);
      setLoading(false);
      return;
    }

    // 3. Create user row linked to the company and auth user
    const { error: userError } = await supabase.from("users").insert({
      id: userId,
      company_id: company.id,
      email,
      full_name: fullName,
      role: "admin",
    });

    if (userError) {
      setError(userError.message);
      setLoading(false);
      return;
    }

    // If session exists (autoconfirm enabled), go straight to dashboard
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      window.location.href = "/dashboard";
      return;
    }

    // Otherwise show "check your email" screen
    setLoading(false);
    setEmailSent(true);
  }

  if (emailSent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <Logo size="lg" />
          <div className="rounded-xl bg-surface p-8 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-green/15 text-2xl">
              ✉
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Check your email
            </h2>
            <p className="text-sm text-neutral-400">
              We sent a confirmation link to{" "}
              <span className="font-medium text-white">{email}</span>.
              Click the link to activate your account and get started.
            </p>
            <p className="text-xs text-neutral-500">
              Didn&apos;t receive it? Check your spam folder or{" "}
              <button
                type="button"
                onClick={() => setEmailSent(false)}
                className="text-accent-green hover:underline"
              >
                try again
              </button>
              .
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
            Create your company account
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
              htmlFor="companyName"
              className="block text-sm font-medium text-neutral-300 mb-1.5"
            >
              Company name
            </label>
            <input
              id="companyName"
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-lg bg-background border border-neutral-700 px-4 py-2.5 text-sm text-white placeholder-neutral-500 outline-none focus:border-accent-green focus:ring-1 focus:ring-accent-green transition-colors"
              placeholder="Acme Inc."
            />
          </div>

          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-neutral-300 mb-1.5"
            >
              Your name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg bg-background border border-neutral-700 px-4 py-2.5 text-sm text-white placeholder-neutral-500 outline-none focus:border-accent-green focus:ring-1 focus:ring-accent-green transition-colors"
              placeholder="Jane Smith"
            />
          </div>

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
              minLength={6}
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
            {loading ? "Creating account…" : "Create account"}
          </button>

          <p className="text-center text-sm text-neutral-400">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-accent-green hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
