import { useCallback, useEffect, useState } from "react";
import StagePill from "../components/pipeline/StagePill.jsx";
import NinetyDayIndicator from "../components/hire/NinetyDayIndicator.jsx";

/**
 * My Candidates — buyer's unlocked candidates with pipeline stage.
 */

const STAGES = [
  { id: "all", label: "All" },
  { id: "unlocked", label: "Unlocked" },
  { id: "contacted", label: "Contacted" },
  { id: "interview_scheduled", label: "Interview" },
  { id: "interviewing", label: "Interviewing" },
  { id: "offer_made", label: "Offer" },
  { id: "hired", label: "Hired" },
  { id: "passed", label: "Passed" },
];

const PAGE_SIZE = 25;

const s = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    padding: 32,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: 13,
    color: "var(--text)",
  },
  container: { maxWidth: 900, margin: "0 auto" },
  title: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 28,
    fontWeight: 400,
    margin: "0 0 20px",
  },
  filterRow: {
    display: "flex",
    gap: 6,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  filterBtn: (active) => ({
    padding: "5px 14px",
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 500,
    border: active ? "1px solid var(--accent-border)" : "1px solid var(--border)",
    background: active ? "var(--accent-dim)" : "var(--surface)",
    color: active ? "var(--accent)" : "var(--muted)",
    cursor: "pointer",
  }),
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 8px rgba(0,0,0,.03)",
    overflow: "hidden",
  },
  headerRow: {
    display: "grid",
    gridTemplateColumns: "1fr 140px 120px 100px",
    gap: 12,
    padding: "10px 20px",
    background: "var(--surface2)",
    borderBottom: "1px solid var(--border)",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 140px 120px 100px",
    gap: 12,
    padding: "14px 20px",
    borderBottom: "1px solid var(--border)",
    alignItems: "center",
    cursor: "pointer",
    transition: "background 0.1s ease",
  },
  candidateCell: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  roleText: { fontSize: 14, fontWeight: 500, color: "var(--text)" },
  metaText: { fontSize: 11, color: "var(--muted)" },
  dateText: { fontSize: 12, color: "var(--muted)" },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    fontSize: 12,
    color: "var(--muted)",
  },
  pageBtn: (disabled) => ({
    padding: "6px 14px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: disabled ? "var(--surface2)" : "var(--surface)",
    color: disabled ? "var(--muted)" : "var(--text2)",
    fontSize: 12,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
  }),
  empty: {
    textAlign: "center",
    padding: "40px 20px",
    color: "var(--muted)",
  },
};

export default function MyCandidates() {
  const [candidates, setCandidates] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState("all");

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        offset: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      });
      if (stageFilter !== "all") params.set("stage", stageFilter);

      const res = await fetch(`/api/my-candidates?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, stageFilter]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);
  useEffect(() => { setPage(0); }, [stageFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={s.page}>
      <div style={s.container}>
        <h1 style={s.title}>My candidates</h1>

        {/* Stage filters */}
        <div style={s.filterRow}>
          {STAGES.map((st) => (
            <button
              key={st.id}
              type="button"
              style={s.filterBtn(stageFilter === st.id)}
              onClick={() => setStageFilter(st.id)}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={s.card}>
          <div style={s.headerRow}>
            <span>Candidate</span>
            <span>Stage</span>
            <span>Unlocked</span>
            <span>Window</span>
          </div>

          {loading && <div style={s.empty}>Loading...</div>}
          {!loading && candidates.length === 0 && (
            <div style={s.empty}>No candidates yet.</div>
          )}

          {!loading && candidates.map((item) => {
            const c = item.candidate;
            if (!c) return null;

            return (
              <div
                key={item.unlock_id}
                style={s.row}
                onClick={() => {
                  window.location.href = `/candidates/${c.id}`;
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = "var(--surface2)"; }}
                onMouseOut={(e) => { e.currentTarget.style.background = "var(--surface)"; }}
              >
                <div style={s.candidateCell}>
                  <div style={s.roleText}>{c.role_applied_for}</div>
                  <div style={s.metaText}>
                    {[c.seniority_level, c.location_city, c.current_company_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {/* 90-day indicator */}
                  {item.current_stage !== "hired" && item.current_stage !== "passed" && (
                    <NinetyDayIndicator unlockDate={item.unlocked_at} />
                  )}
                </div>
                <div>
                  <StagePill stage={item.current_stage} />
                </div>
                <div style={s.dateText}>
                  {new Date(item.unlocked_at).toLocaleDateString("en-AU", {
                    day: "2-digit",
                    month: "short",
                  })}
                </div>
                <div style={s.dateText}>
                  {item.stage_updated_at && item.stage_updated_at !== item.unlocked_at
                    ? new Date(item.stage_updated_at).toLocaleDateString("en-AU", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "—"}
                </div>
              </div>
            );
          })}

          {total > PAGE_SIZE && (
            <div style={s.pagination}>
              <span>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  style={s.pageBtn(page === 0)}
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  style={s.pageBtn(page >= totalPages - 1)}
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
