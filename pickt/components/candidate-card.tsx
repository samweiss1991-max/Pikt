"use client";

import { useState } from "react";
import Link from "next/link";
import type { RankedCandidate } from "@/lib/ranking";
import type { ViewMode } from "@/contexts/view-mode-context";
import UnlockModal from "./unlock-modal";

type Props = {
  candidate: RankedCandidate;
  viewMode: ViewMode;
  rank: number;
  total?: number;
};

function stagePillClass(stage: string): string {
  const s = stage.toLowerCase();
  if (s.includes("final"))
    return "border border-accent-green/35 bg-accent-green/10 text-accent-green";
  if (s.includes("technical") || s.includes("portfolio") || s.includes("3rd"))
    return "border border-teal/35 bg-teal/10 text-teal";
  if (s.includes("on-site") || s.includes("onsite") || s.includes("2nd"))
    return "border border-purple-rank/35 bg-purple-rank/10 text-purple-rank";
  if (s.includes("1st") || s.includes("phone") || s.includes("screen"))
    return "border border-amber-rank/35 bg-amber-rank/10 text-amber-rank";
  return "border border-border bg-nav-active text-muted";
}

function MiniBar({
  label,
  pct,
  colorClass,
}: {
  label: string;
  pct: number;
  colorClass: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted">
        <span>{label}</span>
        <span className="text-foreground">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-nav-active">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

function rankBadge(rank: number): string | null {
  if (rank === 1) return "\u{1F3C6} Top match";
  if (rank === 2) return "\u2B50 Strong match";
  if (rank === 3) return "\u2726 Good match";
  return null;
}

export default function CandidateCard({
  candidate: c,
  viewMode,
  rank,
}: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const top = rank <= 3;
  const badge = rankBadge(rank);
  const hot = c.daysAgo <= 3;

  function renderCtaButtons(compact = false) {
    if (unlocked) {
      return (
        <div className="flex gap-2">
          <Link
            href={`/dashboard/candidates/${c.id}`}
            className="rounded-[10px] bg-accent-green px-4 py-2 text-xs font-semibold text-background transition-all hover:brightness-110"
          >
            View full profile
          </Link>
          <span className="inline-flex items-center rounded-[10px] border border-accent-green/30 bg-accent-green/10 px-3 py-2 text-xs text-accent-green">
            Profile unlocked &#10003;
          </span>
        </div>
      );
    }
    return (
      <div className="flex gap-2">
        <Link
          href={`/dashboard/candidates/${c.id}`}
          className="rounded-[10px] border border-border px-4 py-2 text-xs text-muted transition-colors hover:border-accent-green/40 hover:text-foreground"
        >
          View profile
        </Link>
        {!compact && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowUnlockModal(true);
            }}
            className="rounded-[10px] bg-accent-green px-4 py-2 text-xs font-semibold text-background transition-all hover:brightness-110"
          >
            Unlock candidate
          </button>
        )}
      </div>
    );
  }

  // ── COMPACT VIEW ──────────────────────────────────────────
  if (viewMode === "compact") {
    return (
      <>
        <Link
          href={`/dashboard/candidates/${c.id}`}
          className="flex items-center gap-4 border-b border-border px-4 py-3 text-sm transition-colors hover:bg-surface2"
        >
          <span className="flex-1 font-medium text-foreground">
            {c.role_applied_for}
          </span>
          <span
            className={`shrink-0 rounded-[99px] px-2.5 py-0.5 text-[11px] font-medium ${stagePillClass(c.interview_stage_reached)}`}
          >
            {c.interview_stage_reached}
          </span>
          <span className="shrink-0 rounded-[99px] border border-accent-green/40 bg-accent-green/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent-green">
            {Math.round(c.score)}%
          </span>
          <span className="shrink-0 text-xs text-muted">
            {c.fee_percentage}% fee
          </span>
          <span className="shrink-0 text-xs text-muted">
            {c.interviews_completed} int.
          </span>
          <span className="shrink-0 rounded-[10px] border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground">
            View
          </span>
        </Link>
        <UnlockModal
          candidate={c}
          isOpen={showUnlockModal}
          onSuccess={() => {
            setUnlocked(true);
            setShowUnlockModal(false);
          }}
          onCancel={() => setShowUnlockModal(false)}
        />
      </>
    );
  }

  // ── TINDER VIEW (front card only) ─────────────────────────
  if (viewMode === "tinder") {
    return (
      <>
        <div
          className="rounded-[16px] border border-border bg-surface p-6"
          onClick={() => setExpanded(!expanded)}
        >
          <h3 className="text-lg font-bold text-foreground">
            {c.role_applied_for}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {c.seniority_level} · {c.location_city}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`rounded-[99px] px-2.5 py-0.5 text-[11px] font-medium ${stagePillClass(c.interview_stage_reached)}`}
            >
              {c.interview_stage_reached}
            </span>
            <span className="rounded-[99px] border border-accent-green/40 bg-accent-green/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent-green">
              {Math.round(c.score)}% match
            </span>
            <span className="rounded-[99px] border border-border bg-nav-active px-2.5 py-0.5 text-[11px] text-muted">
              {c.interviews_completed} interview
              {c.interviews_completed !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.skills.slice(0, 3).map((s) => (
              <span
                key={s}
                className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-muted"
              >
                {s}
              </span>
            ))}
          </div>
          {expanded && (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <p className="text-xs text-muted">
                {c.years_experience} yrs · {c.preferred_work_type}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <MiniBar
                  label="Role"
                  pct={c.roleScore}
                  colorClass="bg-accent-green"
                />
                <MiniBar
                  label="Interviews"
                  pct={c.interviewScore}
                  colorClass="bg-teal"
                />
                <MiniBar
                  label="Recency"
                  pct={c.recencyScore}
                  colorClass="bg-amber-rank"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-muted"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <div className="text-xs text-muted">
                {c.fee_percentage}% fee · referred by {c.referring_company}
              </div>
              <div className="pt-2">{renderCtaButtons()}</div>
            </div>
          )}
        </div>
        <UnlockModal
          candidate={c}
          isOpen={showUnlockModal}
          onSuccess={() => {
            setUnlocked(true);
            setShowUnlockModal(false);
          }}
          onCancel={() => setShowUnlockModal(false)}
        />
      </>
    );
  }

  // ── FOCUS VIEW ────────────────────────────────────────────
  if (viewMode === "focus") {
    return (
      <>
        <div className="space-y-6">
          <div>
            <h2 className="font-serif text-[28px] text-foreground">
              {c.role_applied_for}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {c.seniority_level} · {c.years_experience} yrs ·{" "}
              {c.location_city}, {c.location_country} ·{" "}
              {c.preferred_work_type}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-[99px] px-2.5 py-0.5 text-[11px] font-medium ${stagePillClass(c.interview_stage_reached)}`}
            >
              {c.interview_stage_reached}
            </span>
            <span className="rounded-[99px] border border-border bg-nav-active px-2.5 py-0.5 text-[11px] text-muted">
              {c.interviews_completed} interview
              {c.interviews_completed !== 1 ? "s" : ""}
            </span>
            <span className="rounded-[99px] border border-border bg-nav-active px-2.5 py-0.5 text-[11px] text-muted">
              {hot ? "\uD83D\uDD25 " : ""}
              {c.daysAgo === 0 ? "Today" : `${c.daysAgo}d ago`}
            </span>
            <span className="rounded-[99px] border border-accent-green/40 bg-accent-green/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent-green">
              {Math.round(c.score)}% match
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <MiniBar
              label="Role match"
              pct={c.roleScore}
              colorClass="bg-accent-green"
            />
            <MiniBar
              label="Seniority"
              pct={c.seniorityScore}
              colorClass="bg-purple-rank"
            />
            <MiniBar
              label="Interviews"
              pct={c.interviewScore}
              colorClass="bg-teal"
            />
            <MiniBar
              label="Recency"
              pct={c.recencyScore}
              colorClass="bg-amber-rank"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {c.skills.map((s) => (
              <span
                key={s}
                className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted"
              >
                {s}
              </span>
            ))}
          </div>

          {/* Stage timeline (inline) */}
          <div className="rounded-[16px] border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Interview progress
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {Array.from({ length: c.interviews_completed }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-green/15 text-xs text-accent-green">
                      &#10003;
                    </div>
                    {i < c.interviews_completed - 1 && (
                      <div className="h-px w-4 bg-border" />
                    )}
                  </div>
                ))}
              </div>
              <span className="text-xs text-muted">
                Reached{" "}
                <span className="font-medium text-foreground">
                  {c.interview_stage_reached}
                </span>
              </span>
            </div>
          </div>

          <div className="text-sm text-muted">
            <span className="font-medium text-foreground">
              {c.fee_percentage}%
            </span>{" "}
            of first-year salary · referred by{" "}
            <span className="text-foreground">{c.referring_company}</span>
          </div>

          <div className="space-y-2 pt-2">
            {!unlocked && (
              <Link
                href={`/dashboard/candidates/${c.id}`}
                className="block w-full rounded-[12px] border border-border py-3 text-center text-sm text-muted transition-colors hover:border-accent-green/40 hover:text-foreground"
              >
                View profile
              </Link>
            )}
            {unlocked ? (
              <Link
                href={`/dashboard/candidates/${c.id}`}
                className="block w-full rounded-[12px] bg-accent-green py-3 text-center text-sm font-semibold text-background transition-all hover:brightness-110"
              >
                View full profile &#10003;
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setShowUnlockModal(true)}
                className="w-full rounded-[12px] bg-accent-green py-3 text-sm font-semibold text-background transition-all hover:brightness-110"
              >
                Unlock this candidate
              </button>
            )}
          </div>
        </div>
        <UnlockModal
          candidate={c}
          isOpen={showUnlockModal}
          onSuccess={() => {
            setUnlocked(true);
            setShowUnlockModal(false);
          }}
          onCancel={() => setShowUnlockModal(false)}
        />
      </>
    );
  }

  // ── MATRIX VIEW (compact 2-col card) ──────────────────────
  if (viewMode === "matrix") {
    return (
      <>
        <article
          className={`relative flex flex-col rounded-[16px] border border-border bg-surface p-5 ${
            top ? "border-t-2 border-t-accent-green pt-[22px]" : ""
          }`}
        >
          {top && badge && (
            <span className="absolute right-4 top-3 rounded-full bg-accent-green/15 px-2 py-0.5 text-[11px] font-semibold text-accent-green">
              {badge}
            </span>
          )}
          <div className="pr-20">
            <h3 className="text-[14px] font-bold text-foreground">
              {c.role_applied_for}
            </h3>
            <p className="mt-1 text-xs text-muted">
              {c.seniority_level} · {c.years_experience} yrs ·{" "}
              {c.location_city} · {c.preferred_work_type}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`rounded-[99px] px-2.5 py-0.5 text-[11px] font-medium ${stagePillClass(c.interview_stage_reached)}`}
            >
              {c.interview_stage_reached}
            </span>
            <span className="rounded-[99px] border border-border bg-nav-active px-2.5 py-0.5 text-[11px] text-muted">
              {c.interviews_completed} int.
            </span>
            <span className="rounded-[99px] border border-accent-green/40 bg-accent-green/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent-green">
              {Math.round(c.score)}%
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.skills.slice(0, 3).map((s) => (
              <span
                key={s}
                className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-muted"
              >
                {s}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
            <span>
              {c.fee_percentage}% · {c.referring_company}
            </span>
          </div>
          <div className="mt-3">{renderCtaButtons()}</div>
        </article>
        <UnlockModal
          candidate={c}
          isOpen={showUnlockModal}
          onSuccess={() => {
            setUnlocked(true);
            setShowUnlockModal(false);
          }}
          onCancel={() => setShowUnlockModal(false)}
        />
      </>
    );
  }

  // ── STACK / CAROUSEL VIEW (full card) ─────────────────────
  return (
    <>
      <article
        className={`relative flex flex-col rounded-[16px] border border-border bg-surface p-5 ${
          top ? "border-t-2 border-t-accent-green pt-[22px]" : ""
        }`}
      >
        {top && badge && (
          <span className="absolute right-4 top-3 rounded-full bg-accent-green/15 px-2 py-0.5 text-[11px] font-semibold text-accent-green">
            {badge}
          </span>
        )}
        <div className="pr-24">
          <h3 className="text-[14px] font-bold text-foreground">
            {c.role_applied_for}
          </h3>
          <p className="mt-1 text-xs text-muted">
            {c.seniority_level} · {c.years_experience} yrs ·{" "}
            {c.location_city} · {c.preferred_work_type}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={`rounded-[99px] px-2.5 py-0.5 text-[11px] font-medium ${stagePillClass(c.interview_stage_reached)}`}
          >
            {c.interview_stage_reached}
          </span>
          <span className="rounded-[99px] border border-border bg-nav-active px-2.5 py-0.5 text-[11px] text-muted">
            {c.interviews_completed} interview
            {c.interviews_completed !== 1 ? "s" : ""}
          </span>
          <span className="rounded-[99px] border border-border bg-nav-active px-2.5 py-0.5 text-[11px] text-muted">
            {hot ? "\uD83D\uDD25 " : ""}
            {c.daysAgo === 0 ? "Today" : `${c.daysAgo}d ago`}
          </span>
          <span className="rounded-[99px] border border-accent-green/40 bg-accent-green/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent-green">
            {Math.round(c.score)}% match
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-2">
          <MiniBar
            label="Role match"
            pct={c.roleScore}
            colorClass="bg-accent-green"
          />
          <MiniBar
            label="Interviews"
            pct={c.interviewScore}
            colorClass="bg-teal"
          />
          <MiniBar
            label="Recency"
            pct={c.recencyScore}
            colorClass="bg-amber-rank"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {c.skills.map((s) => (
            <span
              key={s}
              className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-muted"
            >
              {s}
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted">
          <div>
            <span className="font-medium text-foreground">
              {c.fee_percentage}%
            </span>{" "}
            fee of first-year salary · referred by{" "}
            <span className="text-foreground">{c.referring_company}</span>
          </div>
          {renderCtaButtons()}
        </div>
      </article>
      <UnlockModal
        candidate={c}
        isOpen={showUnlockModal}
        onSuccess={() => {
          setUnlocked(true);
          setShowUnlockModal(false);
        }}
        onCancel={() => setShowUnlockModal(false)}
      />
    </>
  );
}
