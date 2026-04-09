"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RankedCandidate } from "@/lib/ranking";
import type { ViewMode } from "@/contexts/view-mode-context";
import CandidateCard from "@/components/candidate-card";

// ── Mock data ───────────────────────────────────────────────

const MOCK_CANDIDATES: RankedCandidate[] = [
  {
    id: "preview-1",
    industry: "Technology",
    role_applied_for: "Frontend Engineer",
    seniority_level: "Senior",
    years_experience: 6,
    skills: ["React", "TypeScript", "Next.js", "Tailwind CSS"],
    location_city: "London",
    location_country: "UK",
    preferred_work_type: "Remote",
    interview_stage_reached: "Final round",
    interviews_completed: 4,
    referred_at: "2026-03-28",
    fee_percentage: 8,
    referring_company: "TechFlow",
    score: 92,
    roleScore: 100,
    seniorityScore: 88,
    interviewScore: 100,
    recencyScore: 80,
    daysAgo: 2,
  },
  {
    id: "preview-2",
    industry: "Technology",
    role_applied_for: "Backend Engineer",
    seniority_level: "Mid",
    years_experience: 4,
    skills: ["Node.js", "PostgreSQL", "Docker", "AWS"],
    location_city: "Berlin",
    location_country: "Germany",
    preferred_work_type: "Hybrid",
    interview_stage_reached: "Technical screen",
    interviews_completed: 3,
    referred_at: "2026-03-25",
    fee_percentage: 8,
    referring_company: "DevHouse",
    score: 78,
    roleScore: 63,
    seniorityScore: 78,
    interviewScore: 75,
    recencyScore: 80,
    daysAgo: 5,
  },
  {
    id: "preview-3",
    industry: "Technology",
    role_applied_for: "ML/AI Engineer",
    seniority_level: "Senior",
    years_experience: 8,
    skills: ["Python", "PyTorch", "MLOps", "Kubernetes", "Spark"],
    location_city: "San Francisco",
    location_country: "US",
    preferred_work_type: "Remote",
    interview_stage_reached: "2nd round",
    interviews_completed: 2,
    referred_at: "2026-03-20",
    fee_percentage: 8,
    referring_company: "AI Talent Co",
    score: 71,
    roleScore: 45,
    seniorityScore: 100,
    interviewScore: 50,
    recencyScore: 60,
    daysAgo: 10,
  },
  {
    id: "preview-4",
    industry: "Technology",
    role_applied_for: "DevOps Engineer",
    seniority_level: "Lead",
    years_experience: 10,
    skills: ["Terraform", "AWS", "CI/CD", "Monitoring"],
    location_city: "Sydney",
    location_country: "Australia",
    preferred_work_type: "On-site",
    interview_stage_reached: "1st phone screen",
    interviews_completed: 1,
    referred_at: "2026-03-30",
    fee_percentage: 8,
    referring_company: "CloudOps",
    score: 65,
    roleScore: 45,
    seniorityScore: 56,
    interviewScore: 25,
    recencyScore: 100,
    daysAgo: 0,
  },
  {
    id: "preview-5",
    industry: "Technology",
    role_applied_for: "Full Stack Developer",
    seniority_level: "Mid",
    years_experience: 3,
    skills: ["React", "Node.js", "GraphQL"],
    location_city: "Toronto",
    location_country: "Canada",
    preferred_work_type: "Remote",
    interview_stage_reached: "Final round",
    interviews_completed: 4,
    referred_at: "2026-03-27",
    fee_percentage: 8,
    referring_company: "HireRight",
    score: 60,
    roleScore: 63,
    seniorityScore: 56,
    interviewScore: 100,
    recencyScore: 60,
    daysAgo: 3,
  },
];

// ── View definitions ────────────────────────────────────────

type ViewDef = { id: ViewMode; label: string; icon: string };

const VIEW_MODES: ViewDef[] = [
  { id: "stack", label: "Stack", icon: "\u25A4" },
  { id: "carousel", label: "Carousel", icon: "\u25C1\u25B7" },
  { id: "matrix", label: "Matrix", icon: "\u229E" },
  { id: "tinder", label: "Tinder", icon: "\u2660" },
  { id: "compact", label: "Compact", icon: "\u2261" },
  { id: "focus", label: "Focus", icon: "\u22A1" },
];

// ── Carousel ────────────────────────────────────────────────

function CarouselView({ candidates }: { candidates: RankedCandidate[] }) {
  const [index, setIndex] = useState(0);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
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

  return (
    <div className="relative">
      {index > 0 && (
        <button
          type="button"
          onClick={prev}
          className="absolute -left-5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface2 text-muted hover:text-foreground"
        >
          &#9664;
        </button>
      )}
      {index < candidates.length - 1 && (
        <button
          type="button"
          onClick={next}
          className="absolute -right-5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface2 text-muted hover:text-foreground"
        >
          &#9654;
        </button>
      )}
      <CandidateCard candidate={candidates[index]} viewMode="carousel" rank={index + 1} />
      <div className="mt-4 flex justify-center gap-1.5">
        {candidates.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-6 bg-accent-green" : "w-2 bg-muted/40 hover:bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ── Tinder Stack ────────────────────────────────────────────

function TinderStack({ candidates }: { candidates: RankedCandidate[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);

  const remaining = candidates.length - currentIndex;
  const visible = candidates.slice(currentIndex, currentIndex + 3);

  const advance = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, candidates.length));
    setDragX(0);
  }, [candidates.length]);

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
    if (Math.abs(dragX) > 100) advance();
    setDragX(0);
  }

  if (remaining === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[16px] border border-border bg-surface px-8 py-16 text-center">
        <p className="text-sm text-muted">No more candidates to review.</p>
        <button
          type="button"
          onClick={() => setCurrentIndex(0)}
          className="mt-3 text-sm text-accent-green hover:underline"
        >
          Reset
        </button>
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
                className="absolute inset-x-0 top-0"
                style={style}
                onPointerDown={isFront ? onPointerDown : undefined}
                onPointerMove={isFront ? onPointerMove : undefined}
                onPointerUp={isFront ? onPointerUp : undefined}
              >
                {isFront && isDragging && (
                  <>
                    <div
                      className="pointer-events-none absolute right-4 top-4 z-20 rounded-lg bg-accent-green/20 px-3 py-1 text-sm font-bold text-accent-green"
                      style={{ opacity: Math.min(1, Math.max(0, dragX / 100)) }}
                    >
                      SAVE &#10003;
                    </div>
                    <div
                      className="pointer-events-none absolute left-4 top-4 z-20 rounded-lg bg-coral/20 px-3 py-1 text-sm font-bold text-coral"
                      style={{ opacity: Math.min(1, Math.max(0, -dragX / 100)) }}
                    >
                      SKIP &#10007;
                    </div>
                  </>
                )}
                <CandidateCard candidate={c} viewMode="tinder" rank={currentIndex + i + 1} />
              </div>
            );
          })
          .reverse()}
      </div>
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={advance}
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-coral text-coral hover:bg-coral/10"
        >
          &#10007;
        </button>
        <button
          type="button"
          onClick={advance}
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-accent-green text-accent-green hover:bg-accent-green/10"
        >
          &#10003;
        </button>
      </div>
    </div>
  );
}

// ── Focus ───────────────────────────────────────────────────

function FocusView({ candidates }: { candidates: RankedCandidate[] }) {
  const [index, setIndex] = useState(0);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
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

  return (
    <div className="relative">
      <p className="mb-4 text-right text-xs text-muted">
        Candidate {index + 1} of {candidates.length}
      </p>
      {index > 0 && (
        <button
          type="button"
          onClick={prev}
          className="fixed left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface2 text-muted hover:text-foreground"
        >
          &#9664;
        </button>
      )}
      {index < candidates.length - 1 && (
        <button
          type="button"
          onClick={next}
          className="fixed right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface2 text-muted hover:text-foreground"
        >
          &#9654;
        </button>
      )}
      <CandidateCard candidate={candidates[index]} viewMode="focus" rank={index + 1} total={candidates.length} />
    </div>
  );
}

// ── Main Preview Page ───────────────────────────────────────

export default function PreviewPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("stack");
  const [transitioning, setTransitioning] = useState(false);
  const prevView = useRef(viewMode);

  useEffect(() => {
    if (prevView.current !== viewMode) {
      setTransitioning(true);
      const t = setTimeout(() => setTransitioning(false), 150);
      prevView.current = viewMode;
      return () => clearTimeout(t);
    }
  }, [viewMode]);

  function renderResults() {
    if (viewMode === "tinder") return <TinderStack candidates={MOCK_CANDIDATES} />;
    if (viewMode === "carousel") return <CarouselView candidates={MOCK_CANDIDATES} />;
    if (viewMode === "focus") return <FocusView candidates={MOCK_CANDIDATES} />;

    if (viewMode === "compact") {
      return (
        <div className="overflow-hidden rounded-[16px] border border-border bg-surface">
          {MOCK_CANDIDATES.map((c, i) => (
            <CandidateCard key={c.id} candidate={c} viewMode="compact" rank={i + 1} />
          ))}
        </div>
      );
    }

    if (viewMode === "matrix") {
      return (
        <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
          {MOCK_CANDIDATES.map((c, i) => (
            <CandidateCard key={c.id} candidate={c} viewMode="matrix" rank={i + 1} />
          ))}
        </div>
      );
    }

    // Stack (default)
    return (
      <div className="space-y-4">
        {MOCK_CANDIDATES.map((c, i) => (
          <CandidateCard key={c.id} candidate={c} viewMode="stack" rank={i + 1} />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-serif text-3xl text-foreground">
            pick<span className="italic text-accent-green">t</span> Preview
          </h1>
          <p className="mt-1 text-sm text-muted">
            Static preview with mock data — no auth required
          </p>
        </div>

        {/* View switcher */}
        <div className="flex items-center rounded-[10px] bg-surface2 p-[3px]">
          {VIEW_MODES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setViewMode(v.id)}
              className={`flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-xs font-medium transition-all ${
                viewMode === v.id
                  ? "bg-surface text-accent-green shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span className="text-sm">{v.icon}</span>
              <span>{v.label}</span>
            </button>
          ))}
        </div>

        {/* Results with fade transition */}
        <div
          className="transition-opacity duration-150"
          style={{ opacity: transitioning ? 0 : 1 }}
        >
          {renderResults()}
        </div>
      </div>
    </div>
  );
}
