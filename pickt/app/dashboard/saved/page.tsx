"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type SavedCandidate = {
  id: string;
  role_applied_for: string;
  seniority_level: string;
  years_experience: number;
  location_city: string;
  preferred_work_type: string;
  interview_stage_reached: string;
  interviews_completed: number;
  skills: string[];
  fee_percentage: number;
  referring_company: string;
};

function stagePillClass(stage: string): string {
  const s = stage.toLowerCase();
  if (s.includes("final"))
    return "border-accent-green/35 bg-accent-green/10 text-accent-green";
  if (s.includes("3rd") || s.includes("technical"))
    return "border-teal/35 bg-teal/10 text-teal";
  if (s.includes("2nd") || s.includes("on-site"))
    return "border-purple-rank/35 bg-purple-rank/10 text-purple-rank";
  if (s.includes("1st") || s.includes("phone"))
    return "border-amber-rank/35 bg-amber-rank/10 text-amber-rank";
  return "border-border bg-nav-active text-muted";
}

export default function SavedPage() {
  const [candidates, setCandidates] = useState<SavedCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSaved = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saved-candidates");
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  async function handleUnsave(candidateId: string) {
    await fetch(`/api/saved-candidates?candidate_id=${candidateId}`, {
      method: "DELETE",
    });
    setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-8">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="font-serif text-3xl text-foreground">Saved</h1>
        <p className="mt-2 text-sm text-muted">
          Candidates you&apos;ve bookmarked for later.
        </p>

        {loading && (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="animate-skeleton rounded-[16px] border border-border bg-surface p-5"
              >
                <div className="h-4 w-2/3 rounded bg-nav-active" />
                <div className="mt-2 h-3 w-1/2 rounded bg-nav-active" />
              </div>
            ))}
          </div>
        )}

        {!loading && candidates.length === 0 && (
          <div className="mt-8 rounded-[16px] border border-border bg-surface px-8 py-16 text-center">
            <p className="text-sm text-muted">No saved candidates yet.</p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block text-sm text-accent-green hover:underline"
            >
              Browse marketplace
            </Link>
          </div>
        )}

        {!loading && candidates.length > 0 && (
          <div className="mt-8 space-y-4">
            {candidates.map((c) => (
              <article
                key={c.id}
                className="rounded-[16px] border border-border bg-surface p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-[14px] font-bold text-foreground">
                      {c.role_applied_for}
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      {c.seniority_level} · {c.years_experience} yrs ·{" "}
                      {c.location_city} · {c.preferred_work_type}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnsave(c.id)}
                    className="shrink-0 rounded-[10px] border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-coral/40 hover:text-coral"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`rounded-[99px] border px-2.5 py-0.5 text-[11px] font-medium ${stagePillClass(c.interview_stage_reached)}`}
                  >
                    {c.interview_stage_reached}
                  </span>
                  <span className="rounded-[99px] border border-border bg-nav-active px-2.5 py-0.5 text-[11px] text-muted">
                    {c.interviews_completed} interview
                    {c.interviews_completed !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(c.skills || []).slice(0, 5).map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-muted"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs text-muted">
                  <span>
                    {c.fee_percentage}% fee · referred by {c.referring_company}
                  </span>
                  <Link
                    href={`/dashboard/candidates/${c.id}`}
                    className="rounded-[10px] bg-accent-green px-4 py-2 text-xs font-semibold text-background transition-all hover:brightness-110"
                  >
                    View profile
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
