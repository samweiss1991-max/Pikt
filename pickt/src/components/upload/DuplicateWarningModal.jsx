import { useCallback, useEffect, useRef, useState } from "react";

/**
 * DuplicateWarningModal — triggered onBlur of company name field.
 *
 * Behaviour:
 * - Debounced 800ms after company field blur
 * - Only fires if role + location + company are all filled
 * - similarity >= 0.75: opens full modal with comparison
 * - similarity 0.60–0.74: inline amber warning below company field
 *
 * Props:
 *   role: string
 *   locationCity: string
 *   currentCompanyName: string
 *   onContinue: () => void           — "different person" chosen
 *   onWithdraw: () => void           — "same person" chosen
 *   onContactSupport: () => void     — support link clicked
 *   submission: { role, locationCity, currentCompanyName }  — what user typed
 */

// ── Styles ──────────────────────────────────────────────────

const overlay = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.25)",
  backdropFilter: "blur(2px)",
};

const modal = {
  width: 520,
  maxWidth: "90vw",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
  padding: "28px 24px",
};

const title = {
  fontFamily: "'Instrument Serif', serif",
  fontSize: 22,
  color: "var(--text)",
  margin: 0,
};

const subtitle = {
  fontSize: 13,
  color: "var(--muted)",
  marginTop: 6,
};

const comparisonGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 20,
};

const comparisonCard = {
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 16,
};

const cardLabel = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--muted)",
  marginBottom: 10,
};

const fieldRow = {
  display: "flex",
  justifyContent: "space-between",
  padding: "4px 0",
  fontSize: 13,
};

const fieldLabel = { color: "var(--muted)", fontSize: 12 };
const fieldValue = { color: "var(--text)", fontWeight: 500, textAlign: "right" };

const scorePill = (score) => ({
  display: "inline-block",
  padding: "2px 10px",
  borderRadius: 99,
  fontSize: 11,
  fontWeight: 600,
  background: score >= 0.9 ? "var(--red-dim)" : "var(--amber-dim)",
  border: `1px solid ${score >= 0.9 ? "var(--red-border)" : "var(--amber-border)"}`,
  color: score >= 0.9 ? "var(--red)" : "var(--amber)",
  marginTop: 12,
});

const btnRow = {
  display: "flex",
  gap: 8,
  marginTop: 24,
  flexWrap: "wrap",
};

const btnBase = {
  padding: "10px 18px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  border: "none",
};

const btnContinue = {
  ...btnBase,
  background: "var(--green-dim)",
  border: "1px solid var(--green-border)",
  color: "var(--green)",
};

const btnWithdraw = {
  ...btnBase,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  color: "var(--muted)",
};

const btnSupport = {
  ...btnBase,
  background: "transparent",
  border: "none",
  color: "var(--accent)",
  textDecoration: "underline",
  padding: "10px 8px",
};

const inlineWarning = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 8,
  background: "var(--amber-dim)",
  border: "1px solid var(--amber-border)",
  color: "var(--amber)",
  fontSize: 12,
  marginTop: 6,
};

// ── Component ───────────────────────────────────────────────

export default function DuplicateWarningModal({
  role,
  locationCity,
  currentCompanyName,
  submission,
  onContinue,
  onWithdraw,
  onContactSupport,
}) {
  const [state, setState] = useState("idle"); // idle | checking | warning | modal
  const [matches, setMatches] = useState({ high: [], warning: [] });
  const debounceRef = useRef(null);

  const checkDuplicates = useCallback(async () => {
    if (!role || !locationCity || !currentCompanyName) return;

    setState("checking");

    try {
      const res = await fetch("/api/candidates/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          location_city: locationCity,
          current_company_name: currentCompanyName,
        }),
      });

      if (!res.ok) {
        setState("idle");
        return;
      }

      const data = await res.json();

      if (data.has_high_match) {
        setMatches({ high: data.high_matches, warning: data.warning_matches });
        setState("modal");
      } else if (data.has_warning) {
        setMatches({ high: [], warning: data.warning_matches });
        setState("warning");
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  }, [role, locationCity, currentCompanyName]);

  // Debounced check triggered externally via onBlur
  function handleCompanyBlur() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(checkDuplicates, 800);
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Expose blur handler
  useEffect(() => {
    // Attach to window for parent component to call
    window.__pickt_dedup_blur = handleCompanyBlur;
    return () => { delete window.__pickt_dedup_blur; };
  });

  async function handleResolve(checkId, resolution) {
    await fetch(`/api/duplicates/${checkId}/resolve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution }),
    }).catch(() => {});
  }

  // ── Inline warning (0.60–0.74 similarity) ─────────────

  if (state === "warning" && matches.warning.length > 0) {
    return (
      <div style={inlineWarning}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>
          A similar candidate ({Math.round(matches.warning[0].similarity_score * 100)}% match)
          may already be listed. Please review before submitting.
        </span>
      </div>
    );
  }

  // ── Full modal (>= 0.75 similarity) ───────────────────

  if (state !== "modal" || matches.high.length === 0) return null;

  const match = matches.high[0];

  return (
    <div style={overlay} onClick={() => setState("idle")}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={title}>Similar candidate already exists</h2>
        <p style={subtitle}>
          We found a listing with {Math.round(match.similarity_score * 100)}% similarity.
          Please confirm before continuing.
        </p>

        {/* Comparison cards */}
        <div style={comparisonGrid}>
          {/* Existing listing */}
          <div style={comparisonCard}>
            <div style={cardLabel}>Existing listing</div>
            <div style={fieldRow}>
              <span style={fieldLabel}>Role</span>
              <span style={fieldValue}>{match.role_applied_for}</span>
            </div>
            <div style={fieldRow}>
              <span style={fieldLabel}>Location</span>
              <span style={fieldValue}>{match.location_city}</span>
            </div>
            <div style={fieldRow}>
              <span style={fieldLabel}>Company</span>
              <span style={fieldValue}>{match.current_company_name}</span>
            </div>
            <div style={fieldRow}>
              <span style={fieldLabel}>Referred</span>
              <span style={fieldValue}>
                {match.referred_at
                  ? new Date(match.referred_at).toLocaleDateString("en-AU", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            </div>
            <div style={scorePill(match.similarity_score)}>
              {Math.round(match.similarity_score * 100)}% match
            </div>
          </div>

          {/* Your submission */}
          <div style={comparisonCard}>
            <div style={cardLabel}>Your submission</div>
            <div style={fieldRow}>
              <span style={fieldLabel}>Role</span>
              <span style={fieldValue}>{submission?.role || role}</span>
            </div>
            <div style={fieldRow}>
              <span style={fieldLabel}>Location</span>
              <span style={fieldValue}>{submission?.locationCity || locationCity}</span>
            </div>
            <div style={fieldRow}>
              <span style={fieldLabel}>Company</span>
              <span style={fieldValue}>
                {submission?.currentCompanyName || currentCompanyName}
              </span>
            </div>
            <div style={fieldRow}>
              <span style={fieldLabel}>Referred</span>
              <span style={fieldValue}>Now</span>
            </div>
          </div>
        </div>

        {/* Show additional matches if any */}
        {matches.high.length > 1 && (
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
            +{matches.high.length - 1} other similar listing{matches.high.length > 2 ? "s" : ""} found
          </p>
        )}

        {/* Action buttons */}
        <div style={btnRow}>
          <button
            type="button"
            style={btnContinue}
            onClick={() => {
              handleResolve(match.candidate_id, "different_person");
              setState("idle");
              onContinue?.();
            }}
          >
            This is a different person — continue
          </button>
          <button
            type="button"
            style={btnWithdraw}
            onClick={() => {
              handleResolve(match.candidate_id, "same_person_withdrawn");
              setState("idle");
              onWithdraw?.();
            }}
          >
            Same person — withdraw
          </button>
          <button
            type="button"
            style={btnSupport}
            onClick={() => {
              handleResolve(match.candidate_id, "support_contacted");
              onContactSupport?.();
            }}
          >
            Contact support
          </button>
        </div>
      </div>
    </div>
  );
}
