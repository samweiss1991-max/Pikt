import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ReputationPopover — shows on hover (desktop) / tap (mobile).
 * Displays 4 score components with mini bar charts.
 *
 * Props:
 *   companyId: string
 *   companyName: string
 *   overallScore: number | null
 *   totalUnlocks: number
 *   children: ReactNode — the trigger element
 */

const MIN_UNLOCKS = 3;

const COMPONENTS = [
  { key: "placement_rate_score", label: "Placement rate", icon: "\uD83C\uDFAF" },
  { key: "listing_quality_score", label: "Listing quality", icon: "\uD83D\uDCCB" },
  { key: "availability_accuracy_score", label: "Availability accuracy", icon: "\u2705" },
  { key: "response_rate_score", label: "Response rate", icon: "\u26A1" },
];

const s = {
  wrapper: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
  },
  trigger: {
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  name: { fontSize: 12, fontWeight: 500, color: "var(--text2)" },
  star: { color: "var(--amber)", fontSize: 12 },
  score: { fontSize: 12, fontWeight: 600, color: "var(--text)" },
  newLabel: { fontSize: 11, fontStyle: "italic", color: "var(--muted)" },

  popover: {
    position: "absolute",
    bottom: "calc(100% + 10px)",
    left: "50%",
    transform: "translateX(-50%)",
    width: 240,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 8px 32px rgba(0,0,0,.1)",
    padding: 16,
    zIndex: 50,
  },
  popoverTitle: {
    fontSize: 11,
    fontWeight: 500,
    color: "var(--text2)",
    marginBottom: 14,
  },
  scoreRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  scoreIcon: { fontSize: 13, width: 18, textAlign: "center", flexShrink: 0 },
  scoreLabel: { flex: 1, fontSize: 11, color: "var(--muted)" },
  scoreBarTrack: {
    width: 50,
    height: 3,
    borderRadius: 2,
    background: "var(--surface2)",
    overflow: "hidden",
    flexShrink: 0,
  },
  scoreBarFill: (pct) => ({
    height: "100%",
    width: `${pct}%`,
    borderRadius: 2,
    background: "var(--accent)",
  }),
  scoreValue: {
    width: 24,
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text)",
    textAlign: "right",
    flexShrink: 0,
  },
  footer: {
    paddingTop: 10,
    borderTop: "1px solid var(--border)",
    marginTop: 4,
    fontSize: 10,
    color: "var(--muted)",
    lineHeight: 1.5,
  },
};

export default function ReputationPopover({
  companyId,
  companyName,
  overallScore,
  totalUnlocks,
  children,
}) {
  const [showPopover, setShowPopover] = useState(false);
  const [repData, setRepData] = useState(null);
  const popoverRef = useRef(null);
  const timeoutRef = useRef(null);

  const fetchRep = useCallback(async () => {
    if (repData || !companyId) return;
    try {
      const res = await fetch(`/api/companies/${companyId}/reputation`);
      if (res.ok) setRepData(await res.json());
    } catch {}
  }, [companyId, repData]);

  function handleMouseEnter() {
    clearTimeout(timeoutRef.current);
    setShowPopover(true);
    fetchRep();
  }
  function handleMouseLeave() {
    timeoutRef.current = setTimeout(() => setShowPopover(false), 200);
  }
  function handleClick(e) {
    e.stopPropagation();
    setShowPopover(!showPopover);
    if (!showPopover) fetchRep();
  }

  useEffect(() => {
    function handleOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowPopover(false);
      }
    }
    if (showPopover) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showPopover]);

  const hasEnoughData = (totalUnlocks || 0) >= MIN_UNLOCKS;

  return (
    <div
      style={s.wrapper}
      ref={popoverRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div style={s.trigger} onClick={handleClick}>
        {children || (
          <>
            <span style={s.name}>{companyName}</span>
            {hasEnoughData && overallScore != null ? (
              <>
                <span style={s.star}>&#9733;</span>
                <span style={s.score}>{overallScore}</span>
              </>
            ) : (
              <span style={s.newLabel}>New referrer</span>
            )}
          </>
        )}
      </div>

      {showPopover && (
        <div
          style={s.popover}
          onMouseEnter={() => clearTimeout(timeoutRef.current)}
          onMouseLeave={handleMouseLeave}
        >
          <div style={s.popoverTitle}>Why trust this referrer?</div>

          {hasEnoughData && repData ? (
            <>
              {COMPONENTS.map((comp) => {
                const val = repData.scores?.find((s) => s.label.toLowerCase().includes(comp.label.split(" ")[0].toLowerCase()))?.score
                  || repData[comp.key] || 0;
                return (
                  <div key={comp.key} style={s.scoreRow}>
                    <span style={s.scoreIcon}>{comp.icon}</span>
                    <span style={s.scoreLabel}>{comp.label}</span>
                    <div style={s.scoreBarTrack}>
                      <div style={s.scoreBarFill((val / 5) * 100)} />
                    </div>
                    <span style={s.scoreValue}>{parseFloat(val).toFixed(1)}</span>
                  </div>
                );
              })}
              <div style={s.footer}>
                {repData.total_placements || 0} successful placement{(repData.total_placements || 0) !== 1 ? "s" : ""}
                {repData.member_since && (
                  <> · Member since {new Date(repData.member_since).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}</>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, padding: "8px 0" }}>
              New referrer — building reputation.
              <br />
              Score appears after 3 successful unlocks.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
