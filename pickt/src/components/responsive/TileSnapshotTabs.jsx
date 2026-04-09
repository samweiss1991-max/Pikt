import { useState } from "react";

/**
 * TileSnapshotTabs — replaces 2-column snapshot grid on mobile.
 * Tab interface: "Career" | "Skills"
 *
 * Props:
 *   workHistory: array
 *   topSkills: array
 *   skills: string[] (fallback)
 */

const s = {
  wrapper: {
    background: "var(--surface2)",
    borderTop: "1px solid var(--border)",
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid var(--border)",
  },
  tab: (active) => ({
    flex: 1,
    padding: "10px 0",
    textAlign: "center",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    color: active ? "var(--text)" : "var(--muted)",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    background: "none",
    border: "none",
    borderBottomStyle: "solid",
    cursor: "pointer",
    minHeight: 44,
  }),
  content: {
    padding: "14px 16px",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--muted)",
    marginBottom: 10,
  },

  // Work history
  historyItem: { marginBottom: 10 },
  historyTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  historyCompany: { fontSize: 12, fontWeight: 600, color: "var(--text)" },
  historyTenure: { fontSize: 10, color: "var(--muted)" },
  historyDates: { fontSize: 10, fontWeight: 500, color: "var(--accent)", marginTop: 1 },
  historyAchievement: { fontSize: 10, color: "var(--muted)", lineHeight: 1.4, marginTop: 3 },
  historyDivider: { height: 1, background: "var(--border)", margin: "8px 0" },

  // Skills
  clusterItem: { marginBottom: 10 },
  clusterName: { fontSize: 11, fontWeight: 500, color: "var(--text2)" },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 },
  tag: {
    padding: "2px 8px", borderRadius: 6, fontSize: 10,
    background: "var(--surface3, #e8edde)", border: "1px solid var(--border2)",
    color: "var(--text2)",
  },

  empty: { fontSize: 11, color: "var(--muted)" },
};

export default function TileSnapshotTabs({ workHistory, topSkills, skills }) {
  const [activeTab, setActiveTab] = useState("career");
  const wh = workHistory || [];
  const ts = topSkills || [];

  return (
    <div style={s.wrapper}>
      <div style={s.tabs}>
        <button type="button" style={s.tab(activeTab === "career")} onClick={() => setActiveTab("career")}>
          Career
        </button>
        <button type="button" style={s.tab(activeTab === "skills")} onClick={() => setActiveTab("skills")}>
          Skills
        </button>
      </div>

      <div style={s.content}>
        {activeTab === "career" && (
          <>
            <div style={s.sectionTitle}>Career history</div>
            {wh.length > 0 ? wh.slice(0, 3).map((w, i) => (
              <div key={i}>
                {i > 0 && <div style={s.historyDivider} />}
                <div style={s.historyItem}>
                  <div style={s.historyTop}>
                    <span style={s.historyCompany}>{w.company}</span>
                    {w.tenure && <span style={s.historyTenure}>{w.tenure}</span>}
                  </div>
                  {w.dates && <div style={s.historyDates}>{w.dates}</div>}
                  {w.achievement && <div style={s.historyAchievement}>{w.achievement}</div>}
                </div>
              </div>
            )) : <div style={s.empty}>No work history available</div>}
          </>
        )}

        {activeTab === "skills" && (
          <>
            <div style={s.sectionTitle}>Top skill sets</div>
            {ts.length > 0 ? ts.slice(0, 3).map((cluster, i) => (
              <div key={i} style={s.clusterItem}>
                <div style={s.clusterName}>{cluster.name}</div>
                {cluster.tags && (
                  <div style={s.tagRow}>
                    {cluster.tags.slice(0, 3).map((t, j) => (
                      <span key={j} style={s.tag}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )) : skills?.length > 0 ? (
              <div style={s.tagRow}>
                {skills.slice(0, 8).map((sk, i) => (
                  <span key={i} style={s.tag}>{sk}</span>
                ))}
              </div>
            ) : <div style={s.empty}>No skills data</div>}
          </>
        )}
      </div>
    </div>
  );
}
