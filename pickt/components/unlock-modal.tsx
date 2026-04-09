"use client";

import { useEffect, useState } from "react";
/** Minimal candidate shape needed by the modal */
type UnlockCandidate = {
  id: string;
  fee_percentage: number;
  interviews_completed: number;
  uploaded_by_company_id?: string;
  salary_expectation_min?: number | null;
  salary_expectation_max?: number | null;
};

type UnlockModalProps = {
  candidate: UnlockCandidate;
  isOpen: boolean;
  onSuccess: (unlockId: string) => void;
  onCancel: () => void;
};

type CompanyPublic = {
  name: string;
  rep_score: number;
  placement_count: number;
};

function LockIcon() {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background: "rgba(200,240,96,0.1)",
        border: "1px solid rgba(200,240,96,0.25)",
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#c8f060"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </div>
  );
}

export default function UnlockModal({
  candidate,
  isOpen,
  onSuccess,
  onCancel,
}: UnlockModalProps) {
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyPublic | null>(null);

  // Fetch referring company info
  useEffect(() => {
    if (!isOpen || !candidate.uploaded_by_company_id) return;
    setError(null);
    fetch(`/api/companies/${candidate.uploaded_by_company_id}/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setCompany(data);
      })
      .catch(() => {});
  }, [isOpen, candidate.uploaded_by_company_id]);

  if (!isOpen) return null;

  const { fee_percentage, interviews_completed } = candidate;

  // Compute savings estimate
  const salMin = candidate.salary_expectation_min ?? 0;
  const salMax = candidate.salary_expectation_max ?? 0;
  const avg = salMin && salMax ? (salMin + salMax) / 2 : salMin || salMax || 0;
  const savingsLow = avg ? Math.round(avg * 0.2 - avg * (fee_percentage / 100)) : 0;
  const savingsHigh = avg ? Math.round(avg * 0.25 - avg * (fee_percentage / 100)) : 0;
  const hasSavings = savingsLow > 0;

  const referredByText = company
    ? `${company.name} \u00B7 ${company.rep_score} rep`
    : "\u2026";

  async function handleConfirm() {
    setUnlocking(true);
    setError(null);
    try {
      const res = await fetch("/api/unlocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: candidate.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unlock failed");

      // ATS push + Resend notification are handled server-side by /api/unlocks
      onSuccess(json.unlockId);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(14,15,17,0.85)",
        backdropFilter: "blur(2px)",
      }}
      onClick={onCancel}
    >
      <div
        className="w-[340px] border border-border bg-surface"
        style={{ borderRadius: 20, padding: "32px 28px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <LockIcon />

        <h2 className="mt-5 font-serif text-xl text-white">
          Unlock <span className="italic text-accent-green">profile</span>
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          You&apos;re about to unlock full access to this candidate — including
          name, email, LinkedIn, and employer history.
        </p>

        {/* Fee details box */}
        <div className="mt-5 overflow-hidden rounded-[14px] bg-surface2 px-4 py-1">
          {(
            [
              [
                "Placement fee",
                `${fee_percentage}% of first-year salary`,
                true,
              ],
              ["When charged", "On successful hire only", false],
              ["Referred by", referredByText, false],
              [
                "Interviews completed",
                `${interviews_completed} interview${interviews_completed !== 1 ? "s" : ""}`,
                false,
              ],
            ] as [string, string, boolean][]
          ).map(([label, value, isAccent], i) => (
            <div
              key={label}
              className={`flex items-center justify-between py-2 text-xs ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="text-muted">{label}</span>
              <span
                className={
                  isAccent ? "font-medium text-accent-green" : "text-foreground"
                }
              >
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Savings row */}
        {hasSavings && (
          <div
            className="mt-3 px-4 py-3"
            style={{
              borderRadius: 12,
              background: "rgba(125,211,176,0.07)",
              border: "1px solid rgba(125,211,176,0.18)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted">
                vs. typical agency (20–25%)
              </span>
              <span className="text-xs font-bold text-teal">
                Save ${savingsLow.toLocaleString()}–$
                {savingsHigh.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Error message — below savings, above terms */}
        {error && (
          <p className="mt-3 text-xs text-coral">{error}</p>
        )}

        {/* Terms */}
        <p className="mt-4 text-[11px] leading-relaxed text-muted">
          By unlocking you agree to the{" "}
          <span className="cursor-pointer text-accent-green">
            placement terms
          </span>
          . The fee is only triggered when you confirm a hire through{" "}
          <span className="font-serif">
            pick<span className="italic text-accent-green">t</span>
          </span>
          .
        </p>

        {/* Buttons — both disabled during loading */}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={unlocking}
            className="flex-1 rounded-[12px] border border-border bg-transparent py-2.5 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={unlocking}
            className="flex-1 rounded-[12px] bg-accent-green py-2.5 text-sm font-medium text-background transition-all hover:brightness-110 disabled:opacity-50"
          >
            {unlocking ? "Unlocking\u2026" : "Confirm & unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}
