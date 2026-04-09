"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import UnlockModal from "@/components/unlock-modal";

// ── Types ────────────────────────────────────────────────────

type InterviewNote = {
  round_number: number;
  interviewer_role: string;
  outcome: string;
  note_text: string;
  score: number;
  date: string;
};

type CandidateData = {
  id: string;
  role_applied_for: string;
  seniority_level: string;
  years_experience: number | null;
  skills: string[];
  location_city: string;
  location_country: string;
  preferred_work_type: string;
  residency_status: string | null;
  interview_stage_reached: string;
  interviews_completed: number;
  strengths: string | null;
  gaps: string | null;
  feedback_summary: string | null;
  why_not_hired: string | null;
  recommendation: string | null;
  interview_notes: InterviewNote[] | null;
  skill_ratings: { skill: string; rating: number }[] | null;
  fee_percentage: number;
  salary_expectation_min: number | null;
  salary_expectation_max: number | null;
  referring_company: string | null;
  referred_at: string | null;
  industry: string | null;
  employment_type: string | null;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
  linkedin_url: string | null;
  current_employer: string | null;
  current_job_title: string | null;
  portfolio_url: string | null;
  cv_file_url?: string | null;
  cv_filename: string | null;
  has_cv?: boolean;
  has_cover_letter?: boolean;
  additional_documents_count?: number;
  notice_period_days: number | null;
  available_from: string | null;
  willing_to_relocate: boolean | null;
  unlocked: boolean;
  days_ago?: number;
};

type PageData = {
  candidate: CandidateData;
  isOwner: boolean;
  referringCompanyName: string;
  referringCompanyScore?: number | null;
  referringCompanyPlacements?: number | null;
  hasAtsConnection?: boolean;
};

// ── Helpers ──────────────────────────────────────────────────

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

function recBadgeClass(rec: string): string {
  const r = rec.toLowerCase();
  if (r.includes("strong")) return "bg-accent-green/15 text-accent-green";
  if (r.includes("hire")) return "bg-teal/15 text-teal";
  return "bg-amber-rank/15 text-amber-rank";
}

function formatSavings(min: number | null, max: number | null, fee: number) {
  const avg = min && max ? (min + max) / 2 : min || max || 0;
  if (!avg) return null;
  const saveLow = Math.round(avg * 0.2 - avg * (fee / 100));
  const saveHigh = Math.round(avg * 0.25 - avg * (fee / 100));
  return { saveLow, saveHigh };
}

function daysAgo(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const ms = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

// ── Copy button ─────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-2 text-muted transition-colors hover:text-foreground"
      title="Copy"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

// ── PII Row ─────────────────────────────────────────────────

function PiiRow({
  label,
  value,
  unlocked,
  isLink,
  linkType,
}: {
  label: string;
  value: string | null;
  unlocked: boolean;
  isLink?: boolean;
  linkType?: "mailto" | "tel" | "url";
}) {
  const showValue = unlocked && value;

  function renderValue() {
    if (!showValue) return "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588";

    const href =
      linkType === "mailto"
        ? `mailto:${value}`
        : linkType === "tel"
          ? `tel:${value}`
          : value!;

    if (isLink || linkType) {
      return (
        <>
          <a
            href={href}
            target={linkType === "url" ? "_blank" : undefined}
            rel={linkType === "url" ? "noopener noreferrer" : undefined}
            className="text-accent-green hover:underline"
          >
            {value}
          </a>
          <CopyButton text={value!} />
        </>
      );
    }

    return (
      <>
        {value}
        <CopyButton text={value!} />
      </>
    );
  }

  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-xs text-muted">{label}</span>
      <span
        className="flex items-center text-sm transition-all duration-500"
        style={{
          filter: showValue ? "blur(0px)" : "blur(5px)",
          userSelect: showValue ? "auto" : "none",
          color: showValue ? "var(--foreground)" : "var(--muted)",
        }}
      >
        {renderValue()}
      </span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function CandidateProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchCandidate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Not found");
      }
      const json = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCandidate();
  }, [fetchCandidate]);

  async function handleDownloadCv() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/candidates/${id}/cv-url`);
      if (!res.ok) throw new Error("Failed to get CV URL");
      const { signedUrl } = await res.json();
      window.open(signedUrl, "_blank");
    } catch {
      // Silently fail — button already shows state
    } finally {
      setDownloading(false);
    }
  }

  // ── Loading ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col p-8">
        <div className="mx-auto w-full max-w-5xl animate-skeleton space-y-6">
          <div className="h-8 w-48 rounded bg-nav-active" />
          <div className="h-4 w-96 rounded bg-nav-active" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              <div className="h-40 rounded-[16px] bg-nav-active" />
              <div className="h-32 rounded-[16px] bg-nav-active" />
            </div>
            <div className="space-y-4">
              <div className="h-52 rounded-[16px] bg-nav-active" />
              <div className="h-32 rounded-[16px] bg-nav-active" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8">
        <p className="text-sm text-coral">{error || "Candidate not found"}</p>
        <Link
          href="/dashboard"
          className="mt-4 text-sm text-accent-green hover:underline"
        >
          Back to marketplace
        </Link>
      </div>
    );
  }

  const { candidate: c, isOwner, referringCompanyName } = data;
  const unlocked = c.unlocked;
  const canSeeDetails = unlocked || isOwner;
  const savings = formatSavings(
    c.salary_expectation_min,
    c.salary_expectation_max,
    c.fee_percentage
  );
  const notes: InterviewNote[] = c.interview_notes || [];
  const days = daysAgo(c.referred_at);
  const hot = days != null && days <= 3;

  // ── Main render ────────────────────────────────────────

  return (
    <div className="flex min-h-0 flex-1 flex-col p-8">
      <div className="animate-fade-up mx-auto w-full max-w-5xl">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          &#8592; Back to marketplace
        </Link>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          {/* ── LEFT COLUMN ─────────────────────────────── */}
          <div className="space-y-5">
            {/* 1. Header */}
            <div>
              <h1 className="font-serif text-2xl text-foreground">
                {c.role_applied_for}
              </h1>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  c.seniority_level,
                  c.years_experience ? `${c.years_experience} yrs` : null,
                  `${c.location_city}, ${c.location_country}`,
                  c.preferred_work_type,
                  c.residency_status,
                ]
                  .filter(Boolean)
                  .map((pill) => (
                    <span
                      key={pill}
                      className="rounded-[99px] border border-border bg-surface px-3 py-1 text-xs text-muted"
                    >
                      {pill}
                    </span>
                  ))}
              </div>
            </div>

            {/* 2. Stage + interview badges */}
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-[99px] border px-3 py-1 text-xs font-medium ${stagePillClass(c.interview_stage_reached)}`}
              >
                {c.interview_stage_reached}
              </span>
              <span className="rounded-[99px] border border-border bg-nav-active px-3 py-1 text-xs text-muted">
                {c.interviews_completed} interview
                {c.interviews_completed !== 1 ? "s" : ""}
              </span>
              {days != null && (
                <span className="rounded-[99px] border border-border bg-nav-active px-3 py-1 text-xs text-muted">
                  {hot ? "\uD83D\uDD25 " : ""}
                  {days === 0 ? "Today" : `${days}d ago`}
                </span>
              )}
            </div>

            {/* 3. Skills */}
            <div className="flex flex-wrap gap-1.5">
              {(c.skills || []).map((s) => (
                <span
                  key={s}
                  className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted"
                >
                  {s}
                </span>
              ))}
            </div>

            {/* Work preferences */}
            <div className="rounded-[16px] border border-border bg-surface p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Work preferences
              </h3>
              <div className="flex flex-wrap gap-2">
                {c.notice_period_days != null && (
                  <span className="rounded-[99px] border border-border bg-nav-active px-3 py-1 text-xs text-muted">
                    {c.notice_period_days}d notice
                  </span>
                )}
                {c.available_from && (
                  <span className="rounded-[99px] border border-border bg-nav-active px-3 py-1 text-xs text-muted">
                    Available {new Date(c.available_from).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}
                  </span>
                )}
                {c.employment_type && (
                  <span className="rounded-[99px] border border-border bg-nav-active px-3 py-1 text-xs text-muted">
                    {c.employment_type}
                  </span>
                )}
                {(c.salary_expectation_min || c.salary_expectation_max) && (
                  <span className="rounded-[99px] border border-border bg-nav-active px-3 py-1 text-xs text-muted">
                    {c.salary_expectation_min
                      ? `$${(c.salary_expectation_min / 1000).toFixed(0)}k`
                      : "?"}
                    –
                    {c.salary_expectation_max
                      ? `$${(c.salary_expectation_max / 1000).toFixed(0)}k`
                      : "?"}{" "}
                    AUD
                  </span>
                )}
                {c.willing_to_relocate != null && (
                  <span
                    className={`rounded-[99px] border px-3 py-1 text-xs ${
                      c.willing_to_relocate
                        ? "border-accent-green/30 bg-accent-green/10 text-accent-green"
                        : "border-border bg-nav-active text-muted"
                    }`}
                  >
                    {c.willing_to_relocate ? "Open to relocate" : "Not relocating"}
                  </span>
                )}
              </div>
            </div>

            {/* 4. Interview timeline */}
            <div className="rounded-[16px] border border-border bg-surface p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">
                Interview timeline
              </h3>
              {notes.length > 0 ? (
                <div className="space-y-0">
                  {notes.map((note, i) => {
                    const passed = note.outcome?.toLowerCase() === "passed";
                    const last = i === notes.length - 1;
                    return (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                              passed
                                ? "bg-accent-green/15 text-accent-green"
                                : "border border-border text-muted"
                            }`}
                          >
                            {passed ? "\u2713" : "\u2717"}
                          </div>
                          {!last && (
                            <div className="my-1 h-8 w-px bg-border" />
                          )}
                        </div>
                        <div className="pb-4">
                          <p className="text-sm font-medium text-foreground">
                            Round {note.round_number}
                            {note.interviewer_role && (
                              <span className="ml-2 text-xs font-normal text-muted">
                                ({note.interviewer_role})
                              </span>
                            )}
                            {note.score != null && (
                              <span className="ml-2 rounded-full bg-nav-active px-2 py-0.5 text-[10px] text-muted">
                                {note.score}/10
                              </span>
                            )}
                          </p>
                          {note.note_text && (
                            <p className="mt-1 text-xs text-muted">
                              {note.note_text}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted">
                  <p>
                    Reached{" "}
                    <span className="font-medium text-foreground">
                      {c.interview_stage_reached}
                    </span>{" "}
                    — {c.interviews_completed} interview
                    {c.interviews_completed !== 1 ? "s" : ""} completed.
                  </p>
                </div>
              )}
            </div>

            {/* 5. Strengths */}
            {c.strengths && (
              <div
                className="rounded-[12px] p-5"
                style={{
                  borderLeft: "2px solid #7dd3b0",
                  background: "rgba(125,211,176,0.05)",
                }}
              >
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  Strengths
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  {c.strengths}
                </p>
              </div>
            )}

            {/* 6. Development areas */}
            {c.gaps && (
              <div
                className="rounded-[12px] p-5"
                style={{
                  borderLeft: "2px solid #f0b860",
                  background: "rgba(240,184,96,0.05)",
                }}
              >
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  Development areas
                </h3>
                <p className="text-sm leading-relaxed text-muted">{c.gaps}</p>
              </div>
            )}

            {/* 7. Feedback summary */}
            {c.feedback_summary && (
              <div className="rounded-[12px] border border-border bg-surface p-5">
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  Feedback summary
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  {c.feedback_summary}
                </p>
              </div>
            )}

            {/* Skill ratings */}
            {c.skill_ratings && c.skill_ratings.length > 0 && (
              <div className="rounded-[16px] border border-border bg-surface p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Skill ratings
                </h3>
                <div className="space-y-2">
                  {c.skill_ratings.map((sr) => (
                    <div
                      key={sr.skill}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-muted">{sr.skill}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <div
                            key={n}
                            className={`h-5 w-5 rounded-full text-center text-[10px] leading-5 ${
                              n <= sr.rating
                                ? "bg-accent-green text-background"
                                : "bg-nav-active text-muted"
                            }`}
                          >
                            {n}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. Personal details card */}
            <div className="rounded-[16px] border border-border bg-surface p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  Personal details
                  {!canSeeDetails && (
                    <>
                      <span className="text-muted"> — locked</span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-muted"
                      >
                        <rect
                          x="3"
                          y="11"
                          width="18"
                          height="11"
                          rx="2"
                          ry="2"
                        />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </>
                  )}
                </h3>
                {canSeeDetails && (
                  <span className="rounded-[99px] border border-accent-green/30 bg-accent-green/10 px-2.5 py-0.5 text-[10px] text-accent-green">
                    Unlocked
                  </span>
                )}
              </div>
              <div className="divide-y divide-border">
                <PiiRow
                  label="Full name"
                  value={c.full_name}
                  unlocked={canSeeDetails}
                />
                <PiiRow
                  label="Email"
                  value={c.email}
                  unlocked={canSeeDetails}
                  linkType="mailto"
                />
                <PiiRow
                  label="Mobile"
                  value={c.mobile_number}
                  unlocked={canSeeDetails}
                  linkType="tel"
                />
                <PiiRow
                  label="LinkedIn"
                  value={c.linkedin_url}
                  unlocked={canSeeDetails}
                  linkType="url"
                />
                {c.portfolio_url && (
                  <PiiRow
                    label="Portfolio"
                    value={c.portfolio_url}
                    unlocked={canSeeDetails}
                    linkType="url"
                  />
                )}
                <PiiRow
                  label="Employer"
                  value={c.current_employer}
                  unlocked={canSeeDetails}
                />
                <PiiRow
                  label="Job title"
                  value={c.current_job_title}
                  unlocked={canSeeDetails}
                />
              </div>
              {!canSeeDetails && (
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="mt-4 w-full rounded-[12px] border border-border py-2.5 text-sm text-muted transition-colors hover:border-accent-green/40 hover:text-foreground"
                >
                  Unlock to view
                </button>
              )}
            </div>

            {/* 9. CV & documents section */}
            <div
              className={`rounded-[16px] border border-border bg-surface p-5 ${
                !canSeeDetails ? "opacity-60" : ""
              }`}
            >
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                CV &amp; documents
                {!canSeeDetails && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}
              </h3>
              {canSeeDetails ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleDownloadCv}
                    disabled={downloading || !c.has_cv}
                    className="w-full rounded-[10px] bg-accent-green py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    {downloading ? "Preparing\u2026" : "Download CV"}
                  </button>
                  {c.cv_filename && (
                    <p className="text-center text-[11px] text-muted">
                      {c.cv_filename}
                    </p>
                  )}
                  {!c.has_cv && (
                    <p className="text-center text-[11px] text-muted">
                      No CV uploaded
                    </p>
                  )}
                  {c.has_cover_letter && (
                    <button
                      type="button"
                      className="w-full rounded-[10px] border border-border py-2.5 text-sm text-muted transition-colors hover:border-accent-green/40 hover:text-foreground"
                    >
                      Download cover letter
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted">
                    CV and documents available after unlocking
                  </p>
                  <button
                    type="button"
                    disabled
                    className="mt-3 w-full cursor-not-allowed rounded-[10px] bg-surface2 py-2.5 text-sm text-muted"
                    style={{ opacity: 0.4 }}
                  >
                    Download CV
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN ────────────────────────────── */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {/* Placement fee card */}
            <div className="rounded-[16px] border border-border bg-surface p-5">
              <p className="font-serif text-[28px] text-accent-green">
                {c.fee_percentage}%
              </p>
              <p className="text-[11px] text-muted">of first-year salary</p>

              {savings && (
                <div
                  className="mt-4 px-4 py-3"
                  style={{
                    borderRadius: 12,
                    background: "rgba(125,211,176,0.07)",
                    border: "1px solid rgba(125,211,176,0.18)",
                  }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">
                      vs. typical agency (20–25%)
                    </span>
                    <span className="font-bold text-teal">
                      Save ${savings.saveLow.toLocaleString()}–$
                      {savings.saveHigh.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="my-4 h-px bg-border" />

              {canSeeDetails ? (
                <div className="pointer-events-none rounded-[12px] bg-surface2 py-3 text-center text-sm font-medium text-muted">
                  Profile unlocked &#10003;
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="w-full rounded-[12px] bg-accent-green py-3 text-sm font-medium text-background transition-all hover:brightness-110"
                >
                  Unlock this candidate
                </button>
              )}

              <p className="mt-3 text-center text-[10px] text-muted">
                Fee only due on successful hire
              </p>

              {/* ATS status indicator */}
              <div className="mt-3">
                {data.hasAtsConnection ? (
                  <span className="inline-block rounded-[99px] bg-teal/10 px-3 py-1 text-[10px] text-teal">
                    Hire tracking active — we&apos;ll detect this
                  </span>
                ) : (
                  <span className="inline-block rounded-[99px] px-3 py-1 text-[10px] text-muted">
                    <Link
                      href="/dashboard/settings"
                      className="text-muted hover:text-foreground"
                    >
                      Connect your ATS
                    </Link>
                  </span>
                )}
              </div>
            </div>

            {/* Recommendation card */}
            {c.recommendation && (
              <div className="rounded-[16px] border border-border bg-surface p-5">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  Recommendation
                </h3>
                <span
                  className={`inline-block rounded-[99px] px-3 py-1 text-xs font-semibold ${recBadgeClass(c.recommendation)}`}
                >
                  {c.recommendation}
                </span>
                {c.why_not_hired && (
                  <p className="mt-3 text-[11px] leading-relaxed text-muted">
                    Not hired: {c.why_not_hired}
                  </p>
                )}
              </div>
            )}

            {/* Contact details card (right sidebar) */}
            <div className="rounded-[16px] border border-border bg-surface p-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Contact details
              </h3>
              {canSeeDetails ? (
                <div className="space-y-2 text-xs">
                  {c.email && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Email</span>
                      <span className="flex items-center text-foreground">
                        {c.email}
                        <CopyButton text={c.email} />
                      </span>
                    </div>
                  )}
                  {c.mobile_number && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Mobile</span>
                      <span className="flex items-center text-foreground">
                        {c.mobile_number}
                        <CopyButton text={c.mobile_number} />
                      </span>
                    </div>
                  )}
                  {c.linkedin_url && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">LinkedIn</span>
                      <span className="flex items-center">
                        <a
                          href={c.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-green hover:underline"
                        >
                          Profile
                        </a>
                        <CopyButton text={c.linkedin_url} />
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div
                    className="space-y-2 text-xs"
                    style={{ filter: "blur(5px)", userSelect: "none" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Email</span>
                      <span className="text-foreground">jane@example.com</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Mobile</span>
                      <span className="text-foreground">+44 7123 456789</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="mt-3 w-full rounded-[12px] border border-border py-2 text-xs text-muted transition-colors hover:border-accent-green/40 hover:text-foreground"
                  >
                    Unlock to view
                  </button>
                </>
              )}
            </div>

            {/* Referred by card */}
            <div className="rounded-[16px] border border-border bg-surface p-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Referred by
              </h3>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-sm font-semibold text-background"
                  style={{
                    background:
                      "linear-gradient(135deg, #c8f060 0%, #a0d840 100%)",
                  }}
                >
                  {referringCompanyName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">
                    {referringCompanyName}
                  </span>
                  {data.referringCompanyScore != null && (
                    <span className="ml-2 text-xs text-muted">
                      {data.referringCompanyScore} rep
                    </span>
                  )}
                  {data.referringCompanyPlacements != null && (
                    <p className="text-[11px] text-muted">
                      {data.referringCompanyPlacements} successful placement
                      {data.referringCompanyPlacements !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Mark as hired button */}
            {unlocked && !isOwner && (
              <button
                type="button"
                className="w-full rounded-[12px] border border-border bg-surface2 py-3 text-sm text-muted transition-colors hover:border-accent-green/40 hover:text-foreground"
              >
                Mark as hired
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── UNLOCK MODAL ──────────────────────────────── */}
      <UnlockModal
        candidate={c}
        isOpen={showModal}
        onSuccess={() => {
          setShowModal(false);
          fetchCandidate();
        }}
        onCancel={() => setShowModal(false)}
      />
    </div>
  );
}
