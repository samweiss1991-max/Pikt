import { formatTileSaving } from "../../lib/feeCalculations.js";

/**
 * CandidateTile — marketplace tile with freshness, availability,
 * and engagement signals.
 *
 * Props:
 *   candidate: object from CANDIDATE_PUBLIC
 *   engagement: { views_this_week, saves_count, unlock_count,
 *     days_since_last_unlock, is_popular } | null
 *   onClick: () => void
 */

// ── Helpers ─────────────────────────────────────────────────

function daysAgo(iso) {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function freshnessRing(referredAt) {
  const d = daysAgo(referredAt);
  if (d <= 7) return "0 0 0 2.5px var(--green)";
  if (d <= 30) return "0 0 0 2.5px var(--amber)";
  return "none";
}

function availabilityPill(status) {
  switch (status) {
    case "available":
      return { label: "Active", bg: "var(--green-dim)", border: "var(--green-border)", text: "var(--green)" };
    case "interviewing_elsewhere":
      return { label: "Interviewing elsewhere", bg: "var(--amber-dim)", border: "var(--amber-border)", text: "var(--amber)" };
    case "placed":
      return { label: "Placed", bg: "var(--surface2)", border: "var(--border)", text: "var(--muted)" };
    case "withdrawn":
      return { label: "Withdrawn", bg: "var(--red-dim)", border: "var(--red-border)", text: "var(--red)" };
    case "unconfirmed":
      return { label: "Availability unconfirmed", bg: "var(--surface2)", border: "var(--border)", text: "var(--muted)" };
    default:
      return { label: "Active", bg: "var(--green-dim)", border: "var(--green-border)", text: "var(--green)" };
  }
}

// ── Styles ──────────────────────────────────────────────────

const s = {
  tile: (isInactive) => ({
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 8px rgba(0,0,0,.03)",
    padding: 20,
    cursor: "pointer",
    transition: "all 0.15s ease",
    opacity: isInactive ? 0.5 : 1,
    position: "relative",
  }),
  header: {
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
  },
  avatar: (ring) => ({
    width: 44,
    height: 44,
    borderRadius: 10,
    background: "linear-gradient(135deg, var(--accent) 0%, #5a9020 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    flexShrink: 0,
    boxShadow: ring,
  }),
  info: { flex: 1, minWidth: 0 },
  role: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 16,
    color: "var(--text)",
    margin: 0,
    lineHeight: 1.3,
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  chip: (bg, border, color) => ({
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 500,
    background: bg,
    border: `1px solid ${border}`,
    color,
    whiteSpace: "nowrap",
  }),
  newBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: "2px 10px",
    borderRadius: 99,
    fontSize: 10,
    fontWeight: 600,
    background: "var(--green-dim)",
    border: "1px solid var(--green-border)",
    color: "var(--green)",
  },
  skillRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 12,
  },
  skillTag: {
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 11,
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    color: "var(--text2)",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTop: "1px solid var(--border)",
    fontSize: 12,
    color: "var(--muted)",
  },
  fee: { fontWeight: 600, color: "var(--accent)" },
  interviewDots: {
    display: "flex",
    gap: 3,
    alignItems: "center",
  },
  dot: (filled) => ({
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: filled ? "var(--accent)" : "var(--border)",
  }),
};

// ── Component ───────────────────────────────────────────────

export default function CandidateTile({ candidate, engagement, onClick }) {
  const c = candidate;
  const e = engagement || {};
  const days = daysAgo(c.referred_at);
  const isNew = days <= 7;
  const ring = freshnessRing(c.referred_at);
  const avail = availabilityPill(c.availability_status);
  const isInactive = c.availability_status === "placed" || c.availability_status === "withdrawn";
  const initial = (c.role_applied_for || "?")[0].toUpperCase();
  const isPopular = e.is_popular;
  const viewsThisWeek = e.views_this_week || 0;
  const daysSinceUnlock = e.days_since_last_unlock;
  const unlockCount = e.unlock_count || 0;

  return (
    <div
      style={s.tile(isInactive)}
      onClick={onClick}
      onMouseOver={(e) => {
        if (!isInactive) e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.04), 0 1px 8px rgba(0,0,0,.03)";
      }}
    >
      {/* Top-right badges */}
      {isPopular && !isNew && (
        <div style={{
          position: "absolute", top: 12, right: 12,
          padding: "2px 10px", borderRadius: 99, fontSize: 10, fontWeight: 600,
          background: "var(--amber-dim)", border: "1px solid var(--amber-border)",
          color: "var(--amber)",
        }}>
          &#128293; Popular
        </div>
      )}
      {isNew && <div style={s.newBadge}>New this week</div>}

      {/* Header: avatar + role */}
      <div style={s.header}>
        <div style={s.avatar(ring)}>{initial}</div>
        <div style={s.info}>
          <h3 style={s.role}>{c.role_applied_for}</h3>
          <div style={s.metaRow}>
            {/* Seniority */}
            <span style={s.chip("var(--accent-dim)", "var(--accent-border)", "var(--accent)")}>
              {c.seniority_level}
            </span>
            {/* Location */}
            {c.location_city && (
              <span style={s.chip("var(--surface2)", "var(--border)", "var(--text2)")}>
                {c.location_city}
              </span>
            )}
            {/* Interview count */}
            <span style={s.chip("var(--green-dim)", "var(--green-border)", "var(--green)")}>
              {c.interview_count} interview{c.interview_count !== 1 ? "s" : ""}
            </span>
            {/* Availability pill */}
            <span style={s.chip(avail.bg, avail.border, avail.text)}>
              {avail.label}
            </span>
            {/* Years experience */}
            {c.years_experience && (
              <span style={s.chip("var(--purple-dim)", "var(--purple-border)", "var(--purple)")}>
                {c.years_experience} yrs
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Skills */}
      {c.skills && c.skills.length > 0 && (
        <div style={s.skillRow}>
          {c.skills.slice(0, 5).map((skill, i) => (
            <span key={i} style={s.skillTag}>{skill}</span>
          ))}
          {c.skills.length > 5 && (
            <span style={{ ...s.skillTag, color: "var(--muted)" }}>
              +{c.skills.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Footer: fee + savings + interview dots */}
      <div style={s.footer}>
        <span>
          <span style={{ color: "var(--text2)" }}>{c.fee_percentage || 8}% fee</span>
          {(() => {
            const saving = formatTileSaving(c.salary_band_low, c.salary_band_high, c.fee_percentage || 8);
            if (!saving) return null;
            return (
              <span style={{ color: "var(--muted)" }}>
                {" · "}
                <span style={{ color: "var(--green)", fontWeight: 700 }}>
                  {saving}
                </span>
              </span>
            );
          })()}
        </span>
        <div style={s.interviewDots}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={s.dot(i < (c.interview_count || 0))} />
          ))}
        </div>
      </div>

      {/* Engagement signals footer */}
      {(viewsThisWeek > 0 || (daysSinceUnlock != null && daysSinceUnlock < 30 && unlockCount > 0)) && (
        <div style={{
          display: "flex",
          gap: 12,
          marginTop: 8,
          fontSize: 10,
          color: "var(--muted)",
        }}>
          {viewsThisWeek > 0 && (
            <span>
              &#128065; {viewsThisWeek > 10 ? "10+" : viewsThisWeek} companies viewed this week
            </span>
          )}
          {daysSinceUnlock != null && daysSinceUnlock < 30 && unlockCount > 0 && (
            <span>
              Last unlocked {daysSinceUnlock === 0 ? "today" : `${daysSinceUnlock}d ago`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
