"use client";

import { useEffect, useMemo, useState } from "react";
import { useDashboardDiscovery } from "@/contexts/dashboard-discovery-context";
import { createClient } from "@/lib/supabase";

function greetingForHour(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function subtitleForState(
  phase: "discovery" | "results",
  step: 1 | 2 | 3
): string {
  if (phase === "results") {
    return "Here are candidates ranked by fit, interview depth, referral recency, and seniority.";
  }
  if (step === 1) {
    return "Tell us what you're looking for — we'll match you with the right candidates.";
  }
  if (step === 2) {
    return "Choose a role so we can rank marketplace results for your search.";
  }
  return "Almost there — pick a seniority level for your shortlist.";
}

export function DashboardTopbar() {
  const { phase, step, startOver } = useDashboardDiscovery();
  const [firstName, setFirstName] = useState("there");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const meta = user?.user_metadata as
        | { full_name?: string; name?: string }
        | undefined;
      const raw =
        meta?.full_name ||
        meta?.name ||
        user?.email?.split("@")[0] ||
        "there";
      const first = raw.trim().split(/\s+/)[0] || "there";
      setFirstName(first);
    });
  }, []);

  const hour = useMemo(() => new Date().getHours(), []);
  const greeting = greetingForHour(hour);
  const subtitle = subtitleForState(phase, step);
  const showStartOver = phase === "results" || step >= 2;

  return (
    <header className="border-b border-[var(--border)] bg-background px-8 py-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="font-serif text-2xl text-foreground md:text-[28px]">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>
        </div>
        {showStartOver && (
          <button
            type="button"
            onClick={startOver}
            className="shrink-0 rounded-[10px] border border-[var(--border)] px-4 py-2 text-sm text-muted transition-colors hover:border-accent-green/40 hover:text-foreground"
          >
            Start over
          </button>
        )}
      </div>
    </header>
  );
}
