"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  INDUSTRIES,
  ROLES_BY_INDUSTRY,
  SENIORITY_OPTIONS,
} from "@/lib/discovery-options";
import { useDashboardDiscovery } from "@/contexts/dashboard-discovery-context";
import { useViewMode, type ViewMode } from "@/contexts/view-mode-context";
import type { RankedCandidate } from "@/lib/ranking";
import CandidateCard from "@/components/candidate-card";

type ResultFilter = "best" | "recent" | "interviews" | "final" | "remote";

const DISCOVERY_CHIP_CLASS =
  "rounded-[99px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-all hover:-translate-y-0.5 hover:border-accent-green hover:bg-[rgba(200,240,96,0.06)] hover:text-accent-green hover:shadow-[0_4px_16px_rgba(200,240,96,0.12)]";

// ── View mode definitions ───────────────────────────────────

type ViewDef = { id: ViewMode; label: string; icon: string; mobileOnly?: boolean };

const VIEW_MODES: ViewDef[] = [
  { id: "stack", label: "Stack", icon: "\u25A4" },
  { id: "carousel", label: "Carousel", icon: "\u25C1\u25B7" },
  { id: "matrix", label: "Matrix", icon: "\u229E" },
  { id: "tinder", label: "Tinder", icon: "\u2660" },
  { id: "compact", label: "Compact", icon: "\u2261" },
  { id: "focus", label: "Focus", icon: "\u22A1" },
];

const MOBILE_MODES: ViewMode[] = ["stack", "tinder", "compact"];

// ── Step dots ───────────────────────────────────────────────

function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {([1, 2, 3] as const).map((n) => (
        <div
          key={n}
          className={`h-2 rounded-full transition-all duration-300 ${
            step === n ? "w-8 bg-accent-green" : "w-2 bg-muted/60"
          }`}
          aria-hidden
        />
      ))}
    </div>
  );
}

// ── View Switcher ───────────────────────────────────────────

function ViewSwitcher() {
  const { viewMode, setViewMode } = useViewMode();

  return (
    <div className="flex items-center rounded-[10px] bg-surface2 p-[3px]">
      {VIEW_MODES.map((v) => {
        const active = viewMode === v.id;
        const mobileHidden = !MOBILE_MODES.includes(v.id)
          ? "hidden md:flex"
          : "flex";
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => setViewMode(v.id)}
            className={`${mobileHidden} items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-xs font-medium transition-all ${
              active
                ? "bg-surface text-accent-green shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            <span className="text-sm">{v.icon}</span>
            <span>{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Skeleton loaders ────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-skeleton rounded-[16px] border border-border bg-surface p-5">
      <div className="h-4 w-2/3 rounded bg-nav-active" />
      <div className="mt-2 h-3 w-1/2 rounded bg-nav-active" />
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-20 rounded-full bg-nav-active" />
        <div className="h-6 w-16 rounded-full bg-nav-active" />
        <div className="h-6 w-14 rounded-full bg-nav-active" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="h-8 rounded bg-nav-active" />
        <div className="h-8 rounded bg-nav-active" />
        <div className="h-8 rounded bg-nav-active" />
      </div>
      <div className="mt-4 flex gap-1.5">
        <div className="h-5 w-14 rounded-md bg-nav-active" />
        <div className="h-5 w-18 rounded-md bg-nav-active" />
        <div className="h-5 w-12 rounded-md bg-nav-active" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <div className="h-3 w-40 rounded bg-nav-active" />
        <div className="h-8 w-24 rounded-lg bg-nav-active" />
      </div>
    </div>
  );
}

function SkeletonCompact() {
  return (
    <div className="animate-skeleton flex items-center gap-4 border-b border-border px-4 py-3">
      <div className="h-4 w-40 rounded bg-nav-active" />
      <div className="h-5 w-16 rounded-full bg-nav-active" />
      <div className="h-5 w-10 rounded-full bg-nav-active" />
      <div className="h-4 w-12 rounded bg-nav-active" />
      <div className="h-7 w-14 rounded-lg bg-nav-active" />
    </div>
  );
}

// ── Tinder Stack ────────────────────────────────────────────

function TinderStack({
  candidates,
}: {
  candidates: RankedCandidate[];
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const remaining = candidates.length - currentIndex;
  const visible = candidates.slice(currentIndex, currentIndex + 3);

  const advance = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, candidates.length));
    setDragX(0);
  }, [candidates.length]);

  const saveCandidate = useCallback(async (candidateId: string) => {
    await fetch("/api/saved-candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate_id: candidateId }),
    }).catch(() => {});
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    setIsDragging(true);
    startX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDragging) return;
    setDragX(e.clientX - startX.current);
  }

  function onPointerUp() {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragX > 100) {
      // Right swipe = save
      saveCandidate(visible[0].id);
      advance();
    } else if (dragX < -100) {
      // Left swipe = skip
      advance();
    }
    setDragX(0);
  }

  if (remaining === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[16px] border border-border bg-surface px-8 py-16 text-center">
        <p className="text-sm text-muted">
          No more candidates to review.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-xs text-muted">
        {remaining} candidate{remaining !== 1 ? "s" : ""} remaining
      </p>
      <div className="relative h-[380px] w-full max-w-md">
        {visible
          .map((c, i) => {
            const isFront = i === 0;
            const scale = 1 - i * 0.03;
            const translateY = i * 6;
            const style: React.CSSProperties = isFront
              ? {
                  transform: `translateX(${dragX}px) rotate(${dragX * 0.1}deg)`,
                  zIndex: 10 - i,
                  transition: isDragging ? "none" : "transform 0.3s ease",
                }
              : {
                  transform: `scale(${scale}) translateY(${translateY}px)`,
                  zIndex: 10 - i,
                  transition: "transform 0.3s ease",
                };
            return (
              <div
                key={c.id}
                ref={isFront ? cardRef : undefined}
                className="absolute inset-x-0 top-0"
                style={style}
                onPointerDown={isFront ? onPointerDown : undefined}
                onPointerMove={isFront ? onPointerMove : undefined}
                onPointerUp={isFront ? onPointerUp : undefined}
              >
                {/* Directional hint overlays */}
                {isFront && isDragging && (
                  <>
                    <div
                      className="pointer-events-none absolute right-4 top-4 rounded-lg bg-accent-green/20 px-3 py-1 text-sm font-bold text-accent-green"
                      style={{
                        opacity: Math.min(1, Math.max(0, dragX / 100)),
                      }}
                    >
                      SAVE &#10003;
                    </div>
                    <div
                      className="pointer-events-none absolute left-4 top-4 rounded-lg bg-coral/20 px-3 py-1 text-sm font-bold text-coral"
                      style={{
                        opacity: Math.min(1, Math.max(0, -dragX / 100)),
                      }}
                    >
                      SKIP &#10007;
                    </div>
                  </>
                )}
                <CandidateCard
                  candidate={c}
                  viewMode="tinder"
                  rank={currentIndex + i + 1}
                />
              </div>
            );
          })
          .reverse()}
      </div>
      {/* Action buttons */}
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={advance}
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-coral text-coral transition-colors hover:bg-coral/10"
        >
          <span className="text-xl">&#10007;</span>
        </button>
        <button
          type="button"
          onClick={() => { saveCandidate(visible[0].id); advance(); }}
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-accent-green text-accent-green transition-colors hover:bg-accent-green/10"
        >
          <span className="text-xl">&#10003;</span>
        </button>
      </div>
    </div>
  );
}

// ── Carousel View ───────────────────────────────────────────

function CarouselView({
  candidates,
}: {
  candidates: RankedCandidate[];
}) {
  const [index, setIndex] = useState(0);
  const startXRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const prev = useCallback(
    () => setIndex((i) => Math.max(0, i - 1)),
    []
  );
  const next = useCallback(
    () => setIndex((i) => Math.min(candidates.length - 1, i + 1)),
    [candidates.length]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prev, next]);

  if (candidates.length === 0) return null;
  const c = candidates[index];

  function onPointerDown(e: React.PointerEvent) {
    setIsDragging(true);
    startXRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!isDragging) return;
    setIsDragging(false);
    const diff = e.clientX - startXRef.current;
    if (diff > 60) prev();
    else if (diff < -60) next();
  }

  return (
    <div className="relative">
      {/* Arrows */}
      {index > 0 && (
        <button
          type="button"
          onClick={prev}
          className="absolute -left-5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface2 text-muted transition-colors hover:text-foreground"
        >
          &#9664;
        </button>
      )}
      {index < candidates.length - 1 && (
        <button
          type="button"
          onClick={next}
          className="absolute -right-5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface2 text-muted transition-colors hover:text-foreground"
        >
          &#9654;
        </button>
      )}

      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <CandidateCard
          candidate={c}
          viewMode="carousel"
          rank={index + 1}
        />
      </div>

      {/* Position dots */}
      <div className="mt-4 flex justify-center gap-1.5">
        {candidates.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            className={`h-2 rounded-full transition-all ${
              i === index
                ? "w-6 bg-accent-green"
                : "w-2 bg-muted/40 hover:bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ── Focus View ──────────────────────────────────────────────

function FocusView({
  candidates,
}: {
  candidates: RankedCandidate[];
}) {
  const [index, setIndex] = useState(0);

  const prev = useCallback(
    () => setIndex((i) => Math.max(0, i - 1)),
    []
  );
  const next = useCallback(
    () => setIndex((i) => Math.min(candidates.length - 1, i + 1)),
    [candidates.length]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prev, next]);

  if (candidates.length === 0) return null;
  const c = candidates[index];

  return (
    <div className="relative">
      <p className="mb-4 text-right text-xs text-muted">
        Candidate {index + 1} of {candidates.length}
      </p>

      {/* Fixed nav arrows */}
      {index > 0 && (
        <button
          type="button"
          onClick={prev}
          className="fixed left-[230px] top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface2 text-muted transition-colors hover:text-foreground"
        >
          &#9664;
        </button>
      )}
      {index < candidates.length - 1 && (
        <button
          type="button"
          onClick={next}
          className="fixed right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface2 text-muted transition-colors hover:text-foreground"
        >
          &#9654;
        </button>
      )}

      <CandidateCard
        candidate={c}
        viewMode="focus"
        rank={index + 1}
        total={candidates.length}
      />
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────

export default function DashboardPage() {
  const {
    phase,
    step,
    industry,
    role,
    seniority,
    pickIndustry,
    pickRole,
    pickSeniority,
    refine,
    startOver,
  } = useDashboardDiscovery();

  const { viewMode } = useViewMode();
  const [animKey, setAnimKey] = useState(0);
  const [ranked, setRanked] = useState<RankedCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [resultFilter, setResultFilter] = useState<ResultFilter>("best");
  const [transitioning, setTransitioning] = useState(false);
  const prevViewMode = useRef(viewMode);

  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [step, phase]);

  // View transition fade
  useEffect(() => {
    if (prevViewMode.current !== viewMode) {
      setTransitioning(true);
      const t = setTimeout(() => setTransitioning(false), 150);
      prevViewMode.current = viewMode;
      return () => clearTimeout(t);
    }
  }, [viewMode]);

  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    if (phase !== "results" || !industry || !role || !seniority) return;
    setLoading(true);
    setFetchError(null);
    setResultFilter("best");
    const q = new URLSearchParams({ industry, role, seniority });
    fetch(`/api/candidates/ranked?${q.toString()}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error || "Request failed"
          );
        }
        return r.json() as Promise<{ candidates: RankedCandidate[] }>;
      })
      .then((data) => setRanked(data.candidates))
      .catch((e: Error) => {
        setFetchError(e.message);
        setRanked([]);
      })
      .finally(() => setLoading(false));
  }, [phase, industry, role, seniority, fetchKey]);

  const displayed = useMemo(() => {
    let list = [...ranked];
    if (resultFilter === "recent") {
      list.sort(
        (a, b) =>
          new Date(b.referred_at).getTime() -
          new Date(a.referred_at).getTime()
      );
    } else if (resultFilter === "interviews") {
      list.sort((a, b) => b.interviews_completed - a.interviews_completed);
    } else if (resultFilter === "best") {
      list.sort((a, b) => b.score - a.score);
    }
    if (resultFilter === "final") {
      list = list.filter((c) =>
        c.interview_stage_reached.toLowerCase().includes("final")
      );
    }
    if (resultFilter === "remote") {
      list = list.filter((c) => c.preferred_work_type === "Remote");
    }
    return list;
  }, [ranked, resultFilter]);

  // ── Discovery Steps ─────────────────────────────────────

  function renderDiscovery() {
    if (step === 1) {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Step 1 of 3
          </p>
          <h2 className="mt-4 font-serif text-3xl leading-tight text-foreground md:text-4xl">
            What{" "}
            <span className="italic text-accent-green">industry</span> are
            you hiring for?
          </h2>
          <p className="mt-3 text-sm text-muted">
            Choose the sector that best matches your open role.
          </p>
          <div className="mt-10 flex max-w-2xl flex-wrap justify-center gap-2.5">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind}
                type="button"
                onClick={() => pickIndustry(ind)}
                className={DISCOVERY_CHIP_CLASS}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (step === 2 && industry) {
      const roles = ROLES_BY_INDUSTRY[industry];
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
            <span className="rounded-[99px] border border-border bg-surface px-3 py-1 text-foreground">
              {industry}
            </span>
            <span aria-hidden className="text-muted">
              &#8250;
            </span>
            <span>Choose role</span>
          </div>
          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Step 2 of 3
          </p>
          <h2 className="mt-4 font-serif text-3xl leading-tight text-foreground md:text-4xl">
            What <span className="italic text-accent-green">role</span> are
            you filling?
          </h2>
          <p className="mt-3 text-sm text-muted">
            We&apos;ll tailor ranking to this title and your industry.
          </p>
          <div className="mt-10 flex max-w-2xl flex-wrap justify-center gap-2.5">
            {roles.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => pickRole(r)}
                className={DISCOVERY_CHIP_CLASS}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (step === 3 && industry && role) {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
            <span className="rounded-[99px] border border-border bg-surface px-3 py-1 text-foreground">
              {industry}
            </span>
            <span aria-hidden>&#8250;</span>
            <span className="rounded-[99px] border border-border bg-surface px-3 py-1 text-foreground">
              {role}
            </span>
            <span aria-hidden>&#8250;</span>
            <span>Seniority</span>
          </div>
          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Step 3 of 3
          </p>
          <h2 className="mt-4 font-serif text-3xl leading-tight text-foreground md:text-4xl">
            What{" "}
            <span className="italic text-accent-green">seniority</span>{" "}
            level do you need?
          </h2>
          <p className="mt-3 text-sm text-muted">
            We match this to candidate seniority bands for scoring.
          </p>
          <div className="mt-10 flex max-w-2xl flex-wrap justify-center gap-2.5">
            {SENIORITY_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => pickSeniority(s)}
                className={DISCOVERY_CHIP_CLASS}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return null;
  }

  // ── Results rendering per view mode ─────────────────────

  function renderResults() {
    if (loading) {
      // Compact: dense rows
      if (viewMode === "compact") {
        return (
          <div className="rounded-[16px] border border-border bg-surface">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCompact key={i} />
            ))}
          </div>
        );
      }
      // Tinder: single stacked skeleton
      if (viewMode === "tinder") {
        return (
          <div className="flex flex-col items-center gap-6">
            <div className="h-3 w-36 animate-skeleton rounded bg-nav-active" />
            <div className="w-full max-w-md">
              <SkeletonCard />
            </div>
            <div className="flex gap-6">
              <div className="h-12 w-12 animate-skeleton rounded-full bg-nav-active" />
              <div className="h-12 w-12 animate-skeleton rounded-full bg-nav-active" />
            </div>
          </div>
        );
      }
      // Focus: single full-width skeleton
      if (viewMode === "focus") {
        return (
          <div className="animate-skeleton rounded-[16px] border border-border bg-surface p-6">
            <div className="h-8 w-2/3 rounded bg-nav-active" />
            <div className="mt-3 h-4 w-1/2 rounded bg-nav-active" />
            <div className="mt-6 grid grid-cols-4 gap-4">
              <div className="h-10 rounded bg-nav-active" />
              <div className="h-10 rounded bg-nav-active" />
              <div className="h-10 rounded bg-nav-active" />
              <div className="h-10 rounded bg-nav-active" />
            </div>
            <div className="mt-6 flex gap-2">
              <div className="h-5 w-16 rounded-md bg-nav-active" />
              <div className="h-5 w-20 rounded-md bg-nav-active" />
              <div className="h-5 w-14 rounded-md bg-nav-active" />
            </div>
            <div className="mt-6 h-12 w-full rounded-[12px] bg-nav-active" />
          </div>
        );
      }
      // Carousel: single full-width skeleton with dots
      if (viewMode === "carousel") {
        return (
          <div>
            <SkeletonCard />
            <div className="mt-4 flex justify-center gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 animate-skeleton rounded-full bg-nav-active ${i === 0 ? "w-6" : "w-2"}`}
                />
              ))}
            </div>
          </div>
        );
      }
      // Matrix: 2-column grid
      if (viewMode === "matrix") {
        return (
          <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        );
      }
      // Stack (default): single column
      return (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      );
    }

    if (fetchError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-[16px] border border-border bg-surface px-8 py-16 text-center">
          <p className="text-sm text-muted">Something went wrong</p>
          <p className="mt-1 text-xs text-coral">{fetchError}</p>
          <button
            type="button"
            onClick={() => setFetchKey((k) => k + 1)}
            className="mt-4 rounded-[12px] border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent-green/40 hover:text-foreground"
          >
            Try again
          </button>
        </div>
      );
    }

    if (displayed.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-[16px] border border-border bg-surface px-8 py-16 text-center">
          <p className="text-sm text-muted">
            No candidates match your search
          </p>
          <button
            type="button"
            onClick={startOver}
            className="mt-4 rounded-[12px] border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent-green/40 hover:text-foreground"
          >
            Refine your search
          </button>
        </div>
      );
    }

    // Tinder
    if (viewMode === "tinder") {
      return <TinderStack candidates={displayed} />;
    }

    // Carousel
    if (viewMode === "carousel") {
      return <CarouselView candidates={displayed} />;
    }

    // Focus
    if (viewMode === "focus") {
      return <FocusView candidates={displayed} />;
    }

    // Compact
    if (viewMode === "compact") {
      return (
        <div className="overflow-hidden rounded-[16px] border border-border bg-surface">
          {displayed.map((c, i) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              viewMode="compact"
              rank={i + 1}
            />
          ))}
        </div>
      );
    }

    // Matrix
    if (viewMode === "matrix") {
      return (
        <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
          {displayed.map((c, i) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              viewMode="matrix"
              rank={i + 1}
            />
          ))}
        </div>
      );
    }

    // Stack (default)
    return (
      <div className="space-y-4">
        {displayed.map((c, i) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            viewMode="stack"
            rank={i + 1}
          />
        ))}
      </div>
    );
  }

  // ── Filter pills ────────────────────────────────────────

  const filterPills: { id: ResultFilter; label: string }[] = [
    { id: "best", label: "Best match" },
    { id: "recent", label: "Most recent" },
    { id: "interviews", label: "Most interviews" },
    { id: "final", label: "Final round only" },
    { id: "remote", label: "Remote" },
  ];

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="flex min-h-0 flex-1 flex-col p-8">
      {phase === "discovery" && (
        <div className="flex min-h-[min(70vh,640px)] flex-1 flex-col items-center justify-center">
          <div
            key={animKey}
            className="animate-fade-up flex w-full flex-col items-center gap-8"
          >
            <StepDots step={step} />
            {renderDiscovery()}
          </div>
        </div>
      )}

      {phase === "results" && industry && role && seniority && (
        <div
          key={animKey}
          className="animate-fade-up mx-auto w-full max-w-5xl space-y-6"
        >
          {/* Breadcrumb + Refine */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-muted">
              <span className="rounded-[99px] border border-border bg-surface px-3 py-1 text-xs text-foreground">
                {industry}
              </span>
              <span aria-hidden>&#8250;</span>
              <span className="rounded-[99px] border border-border bg-surface px-3 py-1 text-xs text-foreground">
                {role}
              </span>
              <span aria-hidden>&#8250;</span>
              <span className="rounded-[99px] border border-border bg-surface px-3 py-1 text-xs text-foreground">
                {seniority}
              </span>
            </div>
            <button
              type="button"
              onClick={refine}
              className="text-sm font-medium text-accent-green hover:underline"
            >
              Refine
            </button>
          </div>

          {/* Legend + Count */}
          <div className="flex flex-col gap-4 rounded-[12px] border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
              <span className="inline-flex items-center gap-2 text-muted">
                <span className="h-2 w-2 rounded-full bg-accent-green" />
                Role &amp; industry match
              </span>
              <span className="inline-flex items-center gap-2 text-muted">
                <span className="h-2 w-2 rounded-full bg-teal" />
                Interview depth
              </span>
              <span className="inline-flex items-center gap-2 text-muted">
                <span className="h-2 w-2 rounded-full bg-amber-rank" />
                Referred in last 3-5 days
              </span>
              <span className="inline-flex items-center gap-2 text-muted">
                <span className="h-2 w-2 rounded-full bg-purple-rank" />
                Seniority match
              </span>
            </div>
            <p className="text-sm font-medium text-foreground md:text-right">
              {loading
                ? "\u2026"
                : `${displayed.length} candidate${displayed.length !== 1 ? "s" : ""} found`}
            </p>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            {filterPills.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setResultFilter(p.id)}
                className={`rounded-[99px] border px-3 py-1.5 text-xs font-medium transition-colors ${
                  resultFilter === p.id
                    ? "border-accent-green bg-accent-green/10 text-accent-green"
                    : "border-border bg-surface text-muted hover:border-accent-green/40 hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* View switcher */}
          <ViewSwitcher />

          {/* Results container with fade transition */}
          <div
            className="transition-opacity duration-150"
            style={{ opacity: transitioning ? 0 : 1 }}
          >
            {renderResults()}
          </div>
        </div>
      )}
    </div>
  );
}
