import { useCallback, useEffect, useState } from "react";
import { formatRangeSaving } from "../lib/feeCalculations.js";

/**
 * Shortlist — expanded card layout with full snapshot data.
 */

// ── Styles ──────────────────────────────────────────────────

const shimmerKeyframes = `
@keyframes sl-shimmer {
  0% { background-position: -300px 0; }
  100% { background-position: 300px 0; }
}
@keyframes sl-slide-in {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
`;

const page = {
  minHeight: "100vh",
  background: "var(--bg)",
  padding: "24px 32px",
  fontFamily: "'DM Sans', system-ui, sans-serif",
  fontSize: 13,
  color: "var(--text)",
};

const container = { maxWidth: 880, margin: "0 auto" };

const titleStyle = {
  fontFamily: "'Instrument Serif', serif",
  fontSize: 28,
  fontWeight: 400,
  margin: "0 0 20px",
};

// Tabs
const tabBar = {
  display: "flex",
  gap: 24,
  borderBottom: "1px solid var(--border)",
  marginBottom: 16,
  background: "var(--surface)",
  padding: "0 16px",
  borderRadius: "10px 10px 0 0",
};

const tab = (active) => ({
  padding: "12px 4px",
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  color: active ? "var(--text)" : "var(--muted)",
  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
  cursor: "pointer",
  background: "none",
  border: "none",
  borderBottomStyle: "solid",
  marginBottom: -1,
});

const tabCount = {
  fontSize: 11,
  color: "var(--muted)",
  marginLeft: 4,
};

// Action bar
const actionBar = {
  display: "flex",
  gap: 10,
  marginBottom: 16,
  alignItems: "center",
};

const searchInput = {
  flex: 1,
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
};

const sortSelect = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 12,
  outline: "none",
};

// Bulk action bar
const bulkBar = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 16px",
  marginBottom: 12,
  borderRadius: 10,
  background: "var(--accent-dim)",
  border: "1px solid var(--accent-border)",
  animation: "sl-slide-in 0.2s ease",
};

const bulkText = { fontSize: 13, color: "var(--text2)" };
const bulkClear = {
  border: "none", background: "none", color: "var(--accent)",
  fontSize: 12, fontWeight: 500, cursor: "pointer", marginLeft: 10,
};
const bulkBtn = {
  padding: "8px 18px", borderRadius: 10, border: "none",
  background: "var(--accent)", color: "#fff", fontSize: 12,
  fontWeight: 600, cursor: "pointer",
};

// Card
const card = (selected) => ({
  background: selected ? "var(--accent-dim)" : "var(--surface)",
  border: `1px solid ${selected ? "var(--accent-border)" : "var(--border)"}`,
  borderRadius: 12,
  boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 8px rgba(0,0,0,.03)",
  marginBottom: 14,
  overflow: "hidden",
});

const cardTop = {
  display: "flex",
  gap: 14,
  padding: "18px 20px",
  borderBottom: "1px solid var(--border)",
  alignItems: "flex-start",
};

const checkbox = {
  width: 16, height: 16, marginTop: 4,
  accentColor: "var(--accent)", cursor: "pointer",
};

const avatar = (hasName) => ({
  width: 42, height: 42, borderRadius: 10, flexShrink: 0,
  background: hasName
    ? "linear-gradient(135deg, var(--accent) 0%, #5a9020 100%)"
    : "var(--surface2)",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: hasName ? "#fff" : "var(--muted)",
  fontSize: hasName ? 16 : 14, fontWeight: 600,
});

const nameText = { fontSize: 15, fontWeight: 500, color: "var(--text)" };
const roleText = (locked) => ({
  fontFamily: locked ? "'Instrument Serif', serif" : "inherit",
  fontSize: locked ? 17 : 12,
  fontWeight: locked ? 400 : 400,
  color: locked ? "var(--text)" : "var(--muted)",
  marginTop: locked ? 0 : 2,
});
const metaRow = { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 };

const chip = (bg, border, color) => ({
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 500,
  background: bg, border: `1px solid ${border}`, color, whiteSpace: "nowrap",
});

const feeArea = {
  marginLeft: "auto", textAlign: "right", flexShrink: 0, paddingLeft: 12,
};
const feeNum = {
  fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "var(--accent)",
};
const feeSaving = { fontSize: 10, fontWeight: 500, color: "var(--green)", marginTop: 2 };
const feeSalary = { fontSize: 11, color: "var(--amber)", marginTop: 2 };

// Snapshot grid
const snapshotGrid = {
  display: "grid", gridTemplateColumns: "1fr 1fr", background: "var(--surface2)",
};
const snapshotCol = { padding: "16px 20px" };
const snapshotTitle = {
  fontSize: 10, fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 12,
};

// Work history item
const historyItem = { marginBottom: 12 };
const historyTop = {
  display: "flex", justifyContent: "space-between", alignItems: "baseline",
};
const historyCompany = { fontSize: 12, fontWeight: 600, color: "var(--text)" };
const historyTenure = { fontSize: 10, color: "var(--muted)" };
const historyDates = {
  fontSize: 10, fontWeight: 500, color: "var(--accent)", marginTop: 1,
};
const historyAchievement = {
  fontSize: 10, color: "var(--muted)", lineHeight: 1.4, marginTop: 3,
};
const historyDivider = {
  height: 1, background: "var(--border)", margin: "10px 0",
};

// Skill cluster
const clusterItem = { marginBottom: 12 };
const clusterName = { fontSize: 11, fontWeight: 500, color: "var(--text2)" };
const tagRow = { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 };
const tagPill = {
  padding: "2px 8px", borderRadius: 6, fontSize: 10,
  background: "var(--surface3, #e8edde)", border: "1px solid var(--border2)",
  color: "var(--text2)",
};

// Footer
const cardFooter = (unlocked) => ({
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "10px 20px",
  background: unlocked ? "rgba(45,125,70,.05)" : "var(--surface2)",
  fontSize: 12,
});
const footerLeft = { display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" };
const footerBtns = { display: "flex", gap: 8 };
const btnGhost = {
  padding: "7px 16px", borderRadius: 10,
  border: "1px solid var(--border)", background: "transparent",
  color: "var(--text2)", fontSize: 12, fontWeight: 500, cursor: "pointer",
};
const btnAccentOutline = {
  padding: "7px 16px", borderRadius: 10,
  border: "1px solid var(--accent-border)", background: "transparent",
  color: "var(--accent)", fontSize: 12, fontWeight: 500, cursor: "pointer",
};
const btnPrimary = {
  padding: "7px 16px", borderRadius: 10, border: "none",
  background: "var(--accent)", color: "#fff",
  fontSize: 12, fontWeight: 600, cursor: "pointer",
};

// Dots
const dotRow = { display: "flex", alignItems: "center", gap: 3 };
const dot = (filled) => ({
  width: 8, height: 8, borderRadius: "50%",
  background: filled ? "var(--accent)" : "var(--border2)",
});

const emptyState = {
  textAlign: "center", padding: "48px 20px", color: "var(--muted)",
};
const skeleton = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 12, padding: 20, marginBottom: 14, minHeight: 200,
};
const shimBar = (w) => ({
  width: w, height: 14, borderRadius: 6, marginBottom: 10,
  background: "linear-gradient(90deg, var(--surface2) 25%, var(--surface) 50%, var(--surface2) 75%)",
  backgroundSize: "600px 100%", animation: "sl-shimmer 1.5s ease-in-out infinite",
});

// ── Helpers ─────────────────────────────────────────────────

function fmtK(v) { return v ? `$${Math.round(v / 1000)}k` : null; }

function salaryDisplay(low, high) {
  if (low && high) return `Seeking ${fmtK(low)} – ${fmtK(high)}`;
  if (low) return `Seeking ${fmtK(low)}+`;
  if (high) return `Up to ${fmtK(high)}`;
  return null;
}

// ── Component ───────────────────────────────────────────────

export default function Shortlist() {
  const [data, setData] = useState([]);
  const [counts, setCounts] = useState({ all: 0, unlocked: 0, locked: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("added_at");
  const [selected, setSelected] = useState(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        filter: activeTab,
        sort,
        q: search,
      });
      const res = await fetch(`/api/shortlist?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.candidates || []);
        setCounts(json.counts || { all: 0, unlocked: 0, locked: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, sort, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleRemove(candidateId) {
    await fetch(`/api/shortlist/${candidateId}`, { method: "DELETE" });
    setData((prev) => prev.filter((d) => d.candidate.id !== candidateId));
    setSelected((prev) => { const next = new Set(prev); next.delete(candidateId); return next; });
  }

  return (
    <>
      <style>{shimmerKeyframes}</style>
      <div style={page}>
        <div style={container}>
          <h1 style={titleStyle}>Shortlist</h1>

          {/* Tabs */}
          <div style={tabBar}>
            {[
              { id: "all", label: "All", count: counts.all },
              { id: "unlocked", label: "Unlocked", count: counts.unlocked },
              { id: "locked", label: "Locked", count: counts.locked },
            ].map((t) => (
              <button key={t.id} type="button" style={tab(activeTab === t.id)}
                onClick={() => { setActiveTab(t.id); setSelected(new Set()); }}>
                {t.label}<span style={tabCount}>({t.count})</span>
              </button>
            ))}
          </div>

          {/* Action bar */}
          <div style={actionBar}>
            <input type="text" placeholder="Search by role or skill…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={searchInput} />
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={sortSelect}>
              <option value="added_at">Date added</option>
              <option value="fee_asc">Fee low → high</option>
              <option value="interviews_desc">Interviews high → low</option>
              <option value="salary_band">Salary band</option>
            </select>
          </div>

          {/* Bulk action bar */}
          {selected.size >= 2 && (
            <div style={bulkBar}>
              <div>
                <span style={bulkText}>{selected.size} candidates selected</span>
                <button type="button" style={bulkClear}
                  onClick={() => setSelected(new Set())}>Clear selection</button>
              </div>
              <button type="button" style={bulkBtn}>Bulk action</button>
            </div>
          )}

          {/* Loading */}
          {loading && data.length === 0 && (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={skeleton}>
                  <div style={shimBar("55%")} />
                  <div style={shimBar("35%")} />
                  <div style={shimBar("70%")} />
                </div>
              ))}
            </>
          )}

          {/* Empty */}
          {!loading && data.length === 0 && (
            <div style={emptyState}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No candidates in your shortlist</div>
              <a href="/marketplace" style={{ color: "var(--accent)", fontSize: 13 }}>
                Browse marketplace
              </a>
            </div>
          )}

          {/* Cards */}
          {!loading && data.map((item) => {
            const c = item.candidate;
            const unlocked = item.is_unlocked;
            const isSelected = selected.has(c.id);
            const fee = c.fee_percentage || 8;
            const saving = formatRangeSaving(c.salary_band_low, c.salary_band_high, fee);
            const salary = salaryDisplay(c.salary_band_low, c.salary_band_high);
            const wh = c.work_history || [];
            const ts = c.top_skills || [];
            const initial = unlocked && item.candidate_name
              ? item.candidate_name[0].toUpperCase()
              : null;

            return (
              <div key={c.id} style={card(isSelected)}>
                {/* Top section */}
                <div style={cardTop}>
                  <input type="checkbox" checked={isSelected}
                    onChange={() => toggleSelect(c.id)} style={checkbox} />

                  <div style={avatar(unlocked)}>
                    {unlocked ? (initial || "?") : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {unlocked && item.candidate_name && (
                      <div style={nameText}>{item.candidate_name}</div>
                    )}
                    <div style={roleText(!unlocked)}>{c.role_applied_for}</div>
                    {!unlocked && (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {c.seniority_level} · {c.location_city}
                      </div>
                    )}
                    {unlocked && (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {c.role_applied_for} · {c.seniority_level} · {c.location_city}
                      </div>
                    )}

                    <div style={metaRow}>
                      {c.current_company_name && (
                        <span style={chip("var(--surface2)", "var(--border)", "var(--muted)")}>
                          Currently at {c.current_company_name}
                        </span>
                      )}
                      {c.years_experience && (
                        <span style={chip("var(--purple-dim)", "var(--purple-border)", "var(--purple)")}>
                          {c.years_experience} yrs experience
                        </span>
                      )}
                      <div style={{ ...dotRow, marginLeft: 4 }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} style={dot(i < (c.interview_count || 0))} />
                        ))}
                        <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 4 }}>
                          {c.interview_count || 0} interviews
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={feeArea}>
                    <div style={feeNum}>{fee}%</div>
                    {saving && <div style={feeSaving}>{saving}</div>}
                    {salary && <div style={feeSalary}>{salary}</div>}
                  </div>
                </div>

                {/* Snapshot grid */}
                <div style={snapshotGrid}>
                  {/* Career history */}
                  <div style={snapshotCol}>
                    <div style={snapshotTitle}>Career history</div>
                    {wh.length > 0 ? wh.slice(0, 3).map((w, i) => (
                      <div key={i}>
                        {i > 0 && <div style={historyDivider} />}
                        <div style={historyItem}>
                          <div style={historyTop}>
                            <span style={historyCompany}>{w.company}</span>
                            {w.tenure && <span style={historyTenure}>{w.tenure}</span>}
                          </div>
                          {w.dates && <div style={historyDates}>{w.dates}</div>}
                          {w.achievement && <div style={historyAchievement}>{w.achievement}</div>}
                        </div>
                      </div>
                    )) : (
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>No work history available</div>
                    )}
                  </div>

                  {/* Top skill sets */}
                  <div style={{ ...snapshotCol, borderLeft: "1px solid var(--border)" }}>
                    <div style={snapshotTitle}>Top skill sets</div>
                    {ts.length > 0 ? ts.slice(0, 3).map((cluster, i) => (
                      <div key={i} style={clusterItem}>
                        <div style={clusterName}>{cluster.name}</div>
                        {cluster.tags && (
                          <div style={tagRow}>
                            {cluster.tags.slice(0, 3).map((t, j) => (
                              <span key={j} style={tagPill}>{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )) : c.skills?.length > 0 ? (
                      <div style={tagRow}>
                        {c.skills.slice(0, 6).map((sk, i) => (
                          <span key={i} style={tagPill}>{sk}</span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>No skills data</div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div style={cardFooter(unlocked)}>
                  {unlocked ? (
                    <>
                      <div style={footerLeft}>
                        {item.ats_synced ? (
                          <span style={{ color: "var(--green)" }}>&#10003; Imported to Greenhouse</span>
                        ) : (
                          <span>Not yet imported to ATS</span>
                        )}
                      </div>
                      <div style={footerBtns}>
                        <button type="button" style={btnGhost}
                          onClick={() => { window.location.href = `/candidates/${c.id}`; }}>
                          View profile
                        </button>
                        {!item.ats_synced && (
                          <button type="button" style={btnAccentOutline}>
                            Import to ATS
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={footerLeft}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <span>Name &amp; contact details locked</span>
                      </div>
                      <div style={footerBtns}>
                        <button type="button" style={btnPrimary}
                          onClick={() => { window.location.href = `/candidates/${c.id}`; }}>
                          Unlock {fee}%
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
