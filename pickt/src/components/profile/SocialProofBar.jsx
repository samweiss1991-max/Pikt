import ReferrerReputation from "./ReferrerReputation.jsx";

/**
 * SocialProofBar — light green tint band between header and snapshot.
 * Only renders if at least one engagement value is > 0 or referrer exists.
 *
 * Props:
 *   engagement: { views_this_week, saves_count, reviewing_count }
 *   referrer: { name, rep_score, placement_count } | null
 *   companyId: string — uploaded_by_company_id
 */

const s = {
  bar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
    padding: "12px 20px",
    borderRadius: 10,
    background: "rgba(122,184,48,.06)",
    border: "1px solid var(--accent-border)",
    fontSize: 12,
    color: "var(--text2)",
  },
  stat: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  number: {
    fontWeight: 700,
    color: "var(--accent)",
  },
  urgencyPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 12px",
    borderRadius: 99,
    background: "var(--amber-dim)",
    border: "1px solid var(--amber-border)",
    fontSize: 11,
    fontWeight: 600,
  },
  urgencyNumber: { color: "var(--amber)" },
  urgencyText: { color: "var(--amber)" },
  referrerArea: {
    marginLeft: "auto",
  },
};

export default function SocialProofBar({ engagement, referrer, companyId }) {
  const e = engagement || {};
  const hasEngagement =
    e.views_this_week > 0 || e.saves_count > 0 || e.reviewing_count > 0;

  if (!hasEngagement && !referrer) return null;

  return (
    <div style={s.bar}>
      {e.views_this_week > 0 && (
        <div style={s.stat}>
          <span style={s.number}>
            {e.views_this_week > 10 ? "10+" : e.views_this_week}
          </span>
          {e.views_this_week === 1 ? "company" : "companies"} viewed this week
        </div>
      )}

      {e.saves_count > 0 && (
        <div style={s.stat}>
          <span style={s.number}>{e.saves_count}</span>
          {e.saves_count === 1 ? "company has" : "companies have"} saved this
        </div>
      )}

      {e.reviewing_count > 0 && (
        <div style={s.urgencyPill}>
          <span style={s.urgencyNumber}>{e.reviewing_count}</span>
          <span style={s.urgencyText}>
            {e.reviewing_count === 1 ? "company" : "companies"} reviewing now
          </span>
        </div>
      )}

      <div style={s.referrerArea}>
        <ReferrerReputation referrer={referrer} companyId={companyId} />
      </div>
    </div>
  );
}
