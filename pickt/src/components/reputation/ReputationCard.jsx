import { useCallback, useEffect, useState } from "react";

/**
 * ReputationCard — referrer's own dashboard reputation view.
 * Shows their scores with improvement tips for low components.
 *
 * Props:
 *   companyId: string
 */

const COMPONENTS = [
  { key: "placement_rate_score", label: "Placement rate", icon: "\uD83C\uDFAF",
    tipKey: "placement_rate", tip: "Focus on referring candidates who are a strong match for the roles they've interviewed for." },
  { key: "listing_quality_score", label: "Listing quality", icon: "\uD83D\uDCCB",
    tipKey: "listing_quality", tip: "Add detailed achievements and specific skill tags to boost your parse confidence scores." },
  { key: "availability_accuracy_score", label: "Availability accuracy", icon: "\u2705",
    tipKey: "availability", tip: null },
  { key: "response_rate_score", label: "Response rate", icon: "\u26A1",
    tipKey: "response", tip: null },
];

const TIP_THRESHOLD = 3.5;

const s = {
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,.04)",
    padding: 20,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
  },
  overallBadge: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 16,
    fontWeight: 700,
    color: "var(--accent)",
  },
  star: { color: "var(--amber)" },

  scoreRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 0",
    borderBottom: "1px solid var(--border)",
  },
  scoreIcon: { fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 },
  scoreLabel: { flex: 1, fontSize: 12, color: "var(--text2)" },
  scoreBarTrack: {
    width: 80,
    height: 4,
    borderRadius: 2,
    background: "var(--surface2)",
    overflow: "hidden",
    flexShrink: 0,
  },
  scoreBarFill: (pct, color) => ({
    height: "100%",
    width: `${pct}%`,
    borderRadius: 2,
    background: color,
  }),
  scoreValue: {
    width: 30,
    fontSize: 13,
    fontWeight: 600,
    textAlign: "right",
    flexShrink: 0,
  },
  scoreValueColor: (val) => ({
    color: val >= 4 ? "var(--green)" : val >= TIP_THRESHOLD ? "var(--text)" : "var(--amber)",
  }),

  tipCard: {
    display: "flex",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 8,
    background: "var(--amber-dim)",
    border: "1px solid var(--amber-border)",
    fontSize: 11,
    color: "var(--text2)",
    lineHeight: 1.5,
    marginTop: 6,
    marginBottom: 6,
  },
  tipIcon: { fontSize: 13, flexShrink: 0, marginTop: 1 },
  tipAction: {
    fontWeight: 600,
    color: "var(--amber)",
    cursor: "pointer",
  },

  footer: {
    paddingTop: 12,
    marginTop: 4,
    fontSize: 11,
    color: "var(--muted)",
    lineHeight: 1.5,
  },
  newReferrer: {
    padding: "16px 0",
    textAlign: "center",
    fontSize: 13,
    color: "var(--muted)",
    fontStyle: "italic",
  },
};

export default function ReputationCard({ companyId }) {
  const [data, setData] = useState(null);
  const [pendingActions, setPendingActions] = useState({ unanswered: 0, unconfirmed: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [repRes, actionsRes] = await Promise.all([
        fetch(`/api/companies/${companyId}/reputation`),
        fetch("/api/referrer/pending-actions"),
      ]);

      if (repRes.ok) {
        const repJson = await repRes.json();
        setData(repJson);
      }

      if (actionsRes.ok) {
        const actionsJson = await actionsRes.json();
        setPendingActions(actionsJson);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return null;

  // Not enough data
  if (!data || (data.total_unlocks || 0) < 3) {
    return (
      <div style={s.card}>
        <div style={s.header}>
          <span style={s.title}>Your reputation</span>
        </div>
        <div style={s.newReferrer}>
          Building your reputation — score appears after 3 unlocks.
        </div>
      </div>
    );
  }

  const overall = data.overall || data.overall_score || 0;

  function getScoreValue(comp) {
    // Try scores array first (from API), then direct field
    const fromScores = data.scores?.find((s) =>
      s.label.toLowerCase().includes(comp.label.split(" ")[0].toLowerCase())
    );
    return fromScores?.score || data[comp.key] || 0;
  }

  return (
    <div style={s.card}>
      <div style={s.header}>
        <span style={s.title}>Your reputation</span>
        <div style={s.overallBadge}>
          <span style={s.star}>&#9733;</span>
          {parseFloat(overall).toFixed(1)}
        </div>
      </div>

      {COMPONENTS.map((comp) => {
        const val = getScoreValue(comp);
        const isLow = val < TIP_THRESHOLD;
        const barColor = val >= 4 ? "var(--green)" : val >= TIP_THRESHOLD ? "var(--accent)" : "var(--amber)";

        return (
          <div key={comp.key}>
            <div style={s.scoreRow}>
              <span style={s.scoreIcon}>{comp.icon}</span>
              <span style={s.scoreLabel}>{comp.label}</span>
              <div style={s.scoreBarTrack}>
                <div style={s.scoreBarFill((val / 5) * 100, barColor)} />
              </div>
              <span style={{ ...s.scoreValue, ...s.scoreValueColor(val) }}>
                {parseFloat(val).toFixed(1)}
              </span>
            </div>

            {/* Improvement tips for low scores */}
            {isLow && comp.tipKey === "response" && pendingActions.unanswered > 0 && (
              <div style={s.tipCard}>
                <span style={s.tipIcon}>&#9888;&#65039;</span>
                <span>
                  {pendingActions.unanswered} unanswered enquiries —{" "}
                  <a href="/candidates/my" style={s.tipAction}>Respond now</a>
                </span>
              </div>
            )}
            {isLow && comp.tipKey === "availability" && pendingActions.unconfirmed > 0 && (
              <div style={s.tipCard}>
                <span style={s.tipIcon}>&#9888;&#65039;</span>
                <span>
                  {pendingActions.unconfirmed} candidates need availability confirmation —{" "}
                  <a href="/candidates/my" style={s.tipAction}>Review now</a>
                </span>
              </div>
            )}
            {isLow && comp.tip && comp.tipKey !== "response" && comp.tipKey !== "availability" && (
              <div style={s.tipCard}>
                <span style={s.tipIcon}>&#128161;</span>
                <span>{comp.tip}</span>
              </div>
            )}
          </div>
        );
      })}

      <div style={s.footer}>
        {data.total_placements || 0} successful placement{(data.total_placements || 0) !== 1 ? "s" : ""}
        {data.member_since && (
          <> · Member since {new Date(data.member_since).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}</>
        )}
      </div>
    </div>
  );
}
