import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ReferrerReputation — displays referrer info with hover/tap popover
 * showing 4 score components with mini bar charts.
 *
 * Props:
 *   referrer: { name, rep_score, placement_count } | null
 *   companyId: string — uploaded_by_company_id for fetching full reputation
 */

const s = {
  wrapper: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text2)",
    cursor: "pointer",
  },
  star: { color: "var(--amber)", marginLeft: 2 },
  placements: { color: "var(--muted)", marginLeft: 4 },
  fallback: {
    fontSize: 11,
    color: "var(--muted)",
    fontStyle: "italic",
  },

  // Popover
  popover: {
    position: "absolute",
    bottom: "calc(100% + 10px)",
    left: "50%",
    transform: "translateX(-50%)",
    width: 260,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 8px 32px rgba(0,0,0,.12)",
    padding: 16,
    zIndex: 50,
  },
  popoverTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 12,
  },
  scoreRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  scoreLabel: { fontSize: 11, color: "var(--muted)", flex: 1 },
  scoreBar: {
    width: 80,
    height: 6,
    borderRadius: 99,
    background: "var(--surface2)",
    overflow: "hidden",
    marginRight: 8,
  },
  scoreFill: (pct) => ({
    height: "100%",
    width: `${Math.min(100, Math.max(0, pct))}%`,
    borderRadius: 99,
    background: "var(--accent)",
    transition: "width 0.3s ease",
  }),
  scoreValue: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text)",
    width: 28,
    textAlign: "right",
  },
  overallScore: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTop: "1px solid var(--border)",
    marginTop: 4,
  },
  overallLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text)",
  },
  overallValue: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--accent)",
  },
};

// Default score components when detailed data isn't available
function defaultScores(repScore, placementCount) {
  const base = parseFloat(repScore) || 3.5;
  return [
    { label: "Candidate quality", score: Math.min(5, base + 0.2), max: 5 },
    { label: "Response time", score: Math.min(5, base - 0.1), max: 5 },
    { label: "Placement success", score: Math.min(5, 2.5 + placementCount * 0.4), max: 5 },
    { label: "Profile completeness", score: Math.min(5, base + 0.3), max: 5 },
  ];
}

export default function ReferrerReputation({ referrer, companyId }) {
  const [showPopover, setShowPopover] = useState(false);
  const [detailedScores, setDetailedScores] = useState(null);
  const popoverRef = useRef(null);
  const timeoutRef = useRef(null);

  // Fetch detailed reputation on first hover
  const fetchDetailed = useCallback(async () => {
    if (detailedScores || !companyId) return;
    try {
      const res = await fetch(`/api/companies/${companyId}/reputation`);
      if (res.ok) {
        const data = await res.json();
        setDetailedScores(data.scores || null);
      }
    } catch {
      // Fallback to computed scores
    }
  }, [companyId, detailedScores]);

  // Desktop: hover open/close
  function handleMouseEnter() {
    clearTimeout(timeoutRef.current);
    setShowPopover(true);
    fetchDetailed();
  }
  function handleMouseLeave() {
    timeoutRef.current = setTimeout(() => setShowPopover(false), 200);
  }

  // Mobile: tap toggle
  function handleClick(e) {
    e.stopPropagation();
    setShowPopover(!showPopover);
    if (!showPopover) fetchDetailed();
  }

  // Close on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowPopover(false);
      }
    }
    if (showPopover) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showPopover]);

  if (!referrer) {
    return <span style={s.fallback}>New referrer — building reputation</span>;
  }

  const scores = detailedScores || defaultScores(referrer.rep_score, referrer.placement_count);
  const overallScore = parseFloat(referrer.rep_score) || 0;

  return (
    <div
      style={s.wrapper}
      ref={popoverRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <span>{referrer.name}</span>
      <span style={s.star}>&#9733; {referrer.rep_score}</span>
      <span style={s.placements}>
        · {referrer.placement_count} placement{referrer.placement_count !== 1 ? "s" : ""}
      </span>

      {/* Popover with score bars */}
      {showPopover && (
        <div
          style={s.popover}
          onMouseEnter={() => clearTimeout(timeoutRef.current)}
          onMouseLeave={handleMouseLeave}
        >
          <div style={s.popoverTitle}>{referrer.name}</div>

          {scores.map((sc, i) => (
            <div key={i} style={s.scoreRow}>
              <span style={s.scoreLabel}>{sc.label}</span>
              <div style={s.scoreBar}>
                <div style={s.scoreFill((sc.score / (sc.max || 5)) * 100)} />
              </div>
              <span style={s.scoreValue}>
                {sc.score.toFixed(1)}
              </span>
            </div>
          ))}

          <div style={s.overallScore}>
            <span style={s.overallLabel}>Overall</span>
            <span style={s.overallValue}>{overallScore} &#9733;</span>
          </div>
        </div>
      )}
    </div>
  );
}
