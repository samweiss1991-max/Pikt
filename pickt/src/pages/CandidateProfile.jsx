import { useCallback, useEffect, useState } from "react";
import SocialProofBar from "../components/profile/SocialProofBar.jsx";
import WarmingLayer from "../components/profile/WarmingLayer.jsx";

/**
 * CandidateProfile — locked state.
 *
 * The page buyers land on from the marketplace.
 * All data comes from CANDIDATE_PUBLIC (no PII).
 * PII fields render as animated shimmer bars.
 * CV section rendered blurred with lock overlay.
 * Sticky unlock bar at bottom.
 *
 * Logs profile_viewed to AUDIT_LOG on mount.
 */

// ── Shimmer animation (inline keyframes) ────────────────────

const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}
`;

// ── Styles ──────────────────────────────────────────────────

const s = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    paddingBottom: 80,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: 13,
    color: "var(--text)",
  },
  container: { maxWidth: 800, margin: "0 auto", padding: "32px 24px" },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,.06)",
    padding: "24px",
    marginBottom: 16,
  },
  roleTitle: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 22,
    color: "var(--text)",
    margin: 0,
    lineHeight: 1.3,
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  chip: (bg, border, color) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 12px",
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 500,
    background: bg,
    border: `1px solid ${border}`,
    color,
    whiteSpace: "nowrap",
  }),
  shimmerBar: (width) => ({
    width,
    height: 14,
    borderRadius: 6,
    background: "linear-gradient(90deg, var(--surface2) 25%, var(--surface3, #e8edde) 50%, var(--surface2) 75%)",
    backgroundSize: "400px 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
  }),
  shimmerBarLarge: (width) => ({
    width,
    height: 20,
    borderRadius: 8,
    marginBottom: 8,
    background: "linear-gradient(90deg, var(--surface2) 25%, var(--surface3, #e8edde) 50%, var(--surface2) 75%)",
    backgroundSize: "400px 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
  }),
  feeBlock: {
    position: "absolute",
    top: 24,
    right: 24,
    textAlign: "right",
  },
  feeNumber: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 28,
    color: "var(--accent)",
    lineHeight: 1,
  },
  feeSub: { fontSize: 11, color: "var(--muted)", marginTop: 2 },
  feeSaving: { fontSize: 12, fontWeight: 600, color: "var(--green)", marginTop: 4 },
  interviewDots: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
  },
  dot: (filled) => ({
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: filled ? "var(--accent)" : "var(--border)",
    transition: "background 0.15s ease",
  }),
  interviewLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
    marginLeft: 10,
  },
  // Social proof bar
  socialBar: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: "12px 20px",
    borderRadius: 10,
    background: "rgba(122,184,48,.06)",
    border: "1px solid var(--accent-border)",
    marginBottom: 16,
    fontSize: 12,
    color: "var(--text2)",
  },
  socialStat: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  socialNumber: { fontWeight: 700, color: "var(--accent)" },
  // 3+3 snapshot
  snapshotGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 16,
  },
  snapshotCard: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
  },
  snapshotTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--muted)",
    marginBottom: 14,
  },
  historyItem: { marginBottom: 14 },
  historyCompany: { fontSize: 13, fontWeight: 600, color: "var(--text)" },
  historyMeta: { fontSize: 11, color: "var(--muted)", marginTop: 2 },
  historyAchievement: { fontSize: 12, color: "var(--text2)", marginTop: 4, lineHeight: 1.4 },
  skillCluster: { marginBottom: 14 },
  clusterName: { fontSize: 13, fontWeight: 600, color: "var(--text)" },
  clusterDepth: { fontSize: 11, color: "var(--muted)", marginLeft: 6 },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 },
  tag: {
    padding: "2px 10px",
    borderRadius: 6,
    fontSize: 11,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text2)",
  },
  // Blurred CV
  cvWrapper: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    border: "1px solid var(--border)",
    boxShadow: "0 1px 3px rgba(0,0,0,.06)",
  },
  cvDocument: {
    background: "#fff",
    padding: "32px 28px",
    fontSize: 12,
    lineHeight: 1.6,
    color: "var(--text)",
    minHeight: 320,
  },
  cvLineBlurred: {
    filter: "blur(5px)",
    userSelect: "none",
    pointerEvents: "none",
  },
  cvLineVisible: {
    filter: "none",
    fontWeight: 500,
  },
  cvOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
    background: "linear-gradient(to bottom, transparent 0%, var(--bg) 90%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 32,
  },
  cvLockIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    boxShadow: "0 2px 8px rgba(0,0,0,.08)",
  },
  cvLockText: {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text2)",
  },
  // Sticky unlock bar
  stickyBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    background: "var(--surface)",
    borderTop: "1px solid var(--border)",
    boxShadow: "0 -2px 12px rgba(0,0,0,.06)",
    padding: "12px 0",
  },
  stickyInner: {
    maxWidth: 800,
    margin: "0 auto",
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  stickyFee: { fontSize: 13, color: "var(--text)" },
  stickySaving: { fontSize: 12, fontWeight: 600, color: "var(--green)" },
  btnGhost: {
    padding: "10px 18px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text2)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  btnPrimary: (disabled) => ({
    padding: "10px 24px",
    borderRadius: 10,
    border: "none",
    background: disabled ? "var(--border2)" : "var(--accent)",
    color: disabled ? "var(--muted)" : "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
    transition: "all 0.15s ease",
  }),
};

// ── Helpers ─────────────────────────────────────────────────

function formatSalary(low, high) {
  if (!low && !high) return null;
  const fmt = (v) => `$${Math.round(v / 1000)}k`;
  if (low && high) return `Seeking ${fmt(low)} – ${fmt(high)}`;
  return `Seeking ${fmt(low || high)}+`;
}

function calcSaving(low, high, feePct) {
  const avg = low && high ? (low + high) / 2 : low || high || 0;
  if (!avg || !feePct) return null;
  const saveLow = Math.round(avg * (0.20 - feePct / 100) / 1000);
  const saveHigh = Math.round(avg * (0.25 - feePct / 100) / 1000);
  if (saveLow <= 0) return null;
  return `saves ~$${saveLow}k–$${saveHigh}k`;
}

// ── Mock blurred CV lines ───────────────────────────────────

function BlurredCV({ candidate }) {
  const companyNames = (candidate.work_history || []).map((w) => w.company);
  const city = candidate.location_city || "";

  const lines = [
    { text: candidate.location_city || "Sydney, NSW", visible: true },
    { text: "jane.doe@email.com  |  +61 4XX XXX XXX", visible: false },
    { text: "linkedin.com/in/janedoe", visible: false },
    { text: "", visible: true },
    { text: "PROFESSIONAL EXPERIENCE", visible: false },
    ...companyNames.flatMap((name) => [
      { text: name || "Company Name", visible: true },
      { text: "Senior Product Manager  |  Jan 2022 – Present", visible: false },
      { text: "Led cross-functional team of 12 across design, eng, and data to ship a B2B SaaS product serving 40k+ users", visible: false },
      { text: "", visible: true },
    ]),
    { text: "EDUCATION", visible: false },
    { text: "University of New South Wales", visible: true },
    { text: "Bachelor of Commerce, Major in Information Systems", visible: false },
    { text: "", visible: true },
    { text: "SKILLS", visible: false },
    { text: "Product strategy, stakeholder management, agile/scrum, SQL, Figma, Amplitude, Jira", visible: false },
  ];

  return (
    <div style={s.cvWrapper}>
      <div style={s.cvDocument}>
        {lines.map((line, i) => (
          <div
            key={i}
            style={line.visible ? s.cvLineVisible : s.cvLineBlurred}
          >
            {line.text || "\u00A0"}
          </div>
        ))}
      </div>
      <div style={s.cvOverlay}>
        <div style={s.cvLockIcon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <span style={s.cvLockText}>CV locked</span>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────

export default function CandidateProfile({ candidateId }) {
  const [candidate, setCandidate] = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [referrer, setReferrer] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch candidate data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/candidates/${candidateId}`);
        if (res.ok) {
          const data = await res.json();
          setCandidate(data.candidate);
          setEngagement(data.engagement);
          setReferrer(data.referrer);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [candidateId]);

  const handleUnlock = useCallback(async () => {
    try {
      const res = await fetch(`/api/candidates/${candidateId}/unlock`, {
        method: "POST",
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      // handled by parent
    }
  }, [candidateId]);

  if (loading || !candidate) {
    return (
      <div style={s.page}>
        <div style={s.container}>
          <div style={s.card}>
            <div style={s.shimmerBarLarge("60%")} />
            <div style={s.shimmerBar("40%")} />
            <div style={{ ...s.shimmerBar("80%"), marginTop: 16 }} />
          </div>
        </div>
      </div>
    );
  }

  const c = candidate;
  const salary = formatSalary(c.salary_band_low, c.salary_band_high);
  const saving = calcSaving(c.salary_band_low, c.salary_band_high, c.fee_percentage || 8);
  const feePct = c.fee_percentage || 8;
  const workHistory = c.work_history || [];
  const topSkills = c.top_skills || [];
  // SocialProofBar handles its own visibility based on engagement data

  return (
    <>
      <style>{shimmerKeyframes}</style>
      <div style={s.page}>
        <div style={s.container}>
          {/* ── Header card ─────────────────────────────── */}
          <div style={{ ...s.card, position: "relative" }}>
            {/* Fee display (top-right) */}
            <div style={s.feeBlock}>
              <div style={s.feeNumber}>{feePct}%</div>
              <div style={s.feeSub}>vs 20–25% agency</div>
              {saving && <div style={s.feeSaving}>{saving}</div>}
            </div>

            {/* Role title */}
            <h1 style={s.roleTitle}>{c.role_applied_for}</h1>

            {/* Chips */}
            <div style={s.chipRow}>
              <span style={s.chip("var(--accent-dim)", "var(--accent-border)", "var(--accent)")}>
                {c.seniority_level}
              </span>
              <span style={s.chip("var(--accent-dim)", "var(--accent-border)", "var(--accent)")}>
                {c.location_city}
              </span>
              <span style={s.chip("var(--green-dim)", "var(--green-border)", "var(--green)")}>
                {c.interview_count} interview{c.interview_count !== 1 ? "s" : ""}
              </span>
              {c.current_company_name && (
                <span style={s.chip("var(--surface2)", "var(--border)", "var(--muted)")}>
                  Currently at {c.current_company_name}
                </span>
              )}
              {salary && (
                <span style={s.chip("var(--amber-dim)", "var(--amber-border)", "var(--amber)")}>
                  {salary}
                </span>
              )}
              {c.years_experience && (
                <span style={s.chip("var(--purple-dim)", "var(--purple-border)", "var(--purple)")}>
                  {c.years_experience} yrs experience
                </span>
              )}
            </div>

            {/* Name / contact shimmer bars */}
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={s.shimmerBarLarge("45%")} />
              <div style={s.shimmerBar("55%")} />
              <div style={s.shimmerBar("35%")} />
            </div>

            {/* Interview dot indicators */}
            <div style={s.interviewDots}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={s.dot(i < c.interview_count)} />
              ))}
              <span style={s.interviewLabel}>
                {c.interview_count} interview{c.interview_count !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* ── Social proof bar ────────────────────────── */}
          <SocialProofBar
            engagement={engagement}
            referrer={referrer}
            companyId={c.uploaded_by_company_id}
          />

          {/* ── 3+3 Snapshot ────────────────────────────── */}
          <div style={s.snapshotGrid}>
            {/* Career history */}
            <div style={s.snapshotCard}>
              <div style={s.snapshotTitle}>Career history</div>
              {workHistory.length > 0
                ? workHistory.slice(0, 3).map((w, i) => (
                    <div key={i} style={s.historyItem}>
                      <div style={s.historyCompany}>{w.company}</div>
                      <div style={s.historyMeta}>
                        {[w.role, w.dates, w.tenure ? `${w.tenure}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      {w.achievement && (
                        <div style={s.historyAchievement}>{w.achievement}</div>
                      )}
                    </div>
                  ))
                : (
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      Work history not yet provided.
                    </div>
                  )}
            </div>

            {/* Top skill sets */}
            <div style={s.snapshotCard}>
              <div style={s.snapshotTitle}>Top skill sets</div>
              {topSkills.length > 0
                ? topSkills.slice(0, 3).map((cluster, i) => (
                    <div key={i} style={s.skillCluster}>
                      <div>
                        <span style={s.clusterName}>{cluster.name}</span>
                        {cluster.depth && (
                          <span style={s.clusterDepth}>{cluster.depth}</span>
                        )}
                      </div>
                      {cluster.tags && cluster.tags.length > 0 && (
                        <div style={s.tagRow}>
                          {cluster.tags.map((tag, j) => (
                            <span key={j} style={s.tag}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                : c.skills && c.skills.length > 0
                  ? (
                      <div style={s.tagRow}>
                        {c.skills.slice(0, 8).map((skill, i) => (
                          <span key={i} style={s.tag}>{skill}</span>
                        ))}
                      </div>
                    )
                  : (
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>
                        Skills not yet provided.
                      </div>
                    )}
            </div>
          </div>

          {/* ── Feedback section ─────────────────────────── */}
          {(c.strengths || c.gaps || c.feedback_summary) && (
            <div style={s.card}>
              {c.strengths && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Strengths
                  </div>
                  <div style={{
                    padding: 14,
                    borderRadius: 10,
                    borderLeft: "2px solid var(--green)",
                    background: "var(--green-dim)",
                    fontSize: 13,
                    color: "var(--text2)",
                    lineHeight: 1.5,
                  }}>
                    {c.strengths}
                  </div>
                </div>
              )}
              {c.gaps && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Development areas
                  </div>
                  <div style={{
                    padding: 14,
                    borderRadius: 10,
                    borderLeft: "2px solid var(--amber)",
                    background: "var(--amber-dim)",
                    fontSize: 13,
                    color: "var(--text2)",
                    lineHeight: 1.5,
                  }}>
                    {c.gaps}
                  </div>
                </div>
              )}
              {c.feedback_summary && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Feedback summary
                  </div>
                  <div style={{
                    padding: 14,
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    fontSize: 13,
                    color: "var(--text2)",
                    lineHeight: 1.5,
                  }}>
                    {c.feedback_summary}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Blurred CV ───────────────────────────────── */}
          <BlurredCV candidate={c} />
        </div>

        {/* ── Sticky unlock bar with warming delay ─────── */}
        <WarmingLayer
          candidateId={candidateId}
          feePct={feePct}
          saving={saving}
          onUnlock={handleUnlock}
          onSave={() => {
            fetch("/api/shortlist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ candidate_id: c.id }),
            }).catch(() => {});
          }}
        />
      </div>
    </>
  );
}
