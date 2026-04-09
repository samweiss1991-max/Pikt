import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Referrer Dashboard — candidate performance panel.
 * Shows aggregate views, unlocks (as dots, never numbers to protect
 * buyer privacy), and placement status.
 *
 * Cache: 5min client-side, refresh every 6 hours.
 */

const PAGE_SIZE = 10;

// ── Styles ──────────────────────────────────────────────────

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
    margin: "0 0 24px",
  },

  // Summary cards
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
    marginBottom: 24,
  },
  summaryCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 8px rgba(0,0,0,.03)",
    padding: "20px 24px",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 8,
  },
  summaryValue: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 32,
    color: "var(--accent)",
    lineHeight: 1,
  },
  summaryTrend: (positive) => ({
    fontSize: 11,
    fontWeight: 600,
    color: positive ? "var(--green)" : "var(--muted)",
    marginTop: 6,
  }),

  // Table
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 8px rgba(0,0,0,.03)",
    overflow: "hidden",
  },
  headerRow: {
    display: "grid",
    gridTemplateColumns: "1fr 110px 90px 80px 100px 100px",
    gap: 8,
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
    gridTemplateColumns: "1fr 110px 90px 80px 100px 100px",
    gap: 8,
    padding: "12px 20px",
    borderBottom: "1px solid var(--border)",
    alignItems: "center",
    fontSize: 13,
  },
  roleText: { fontWeight: 500, color: "var(--text)" },
  seniorityText: { fontSize: 12, color: "var(--muted)" },
  dateText: { fontSize: 12, color: "var(--muted)" },
  viewsText: { fontWeight: 500, color: "var(--text2)" },

  // Unlock dots
  unlockDots: {
    display: "flex",
    alignItems: "center",
    gap: 3,
    position: "relative",
  },
  dot: (filled) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: filled ? "var(--accent)" : "var(--border2)",
    flexShrink: 0,
  }),
  dotOverflow: {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--accent)",
    marginLeft: 3,
  },
  tooltip: {
    position: "absolute",
    bottom: "calc(100% + 6px)",
    left: "50%",
    transform: "translateX(-50%)",
    background: "var(--text)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 500,
    padding: "4px 10px",
    borderRadius: 6,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    zIndex: 10,
  },

  // Status pill
  statusPill: (status) => {
    const map = {
      interviewing: { bg: "var(--amber-dim)", border: "var(--amber-border)", color: "var(--amber)" },
      placed:       { bg: "var(--green-dim)", border: "var(--green-border)", color: "var(--green)" },
      not_placed:   { bg: "var(--surface2)",  border: "var(--border)",       color: "var(--muted)" },
    };
    const c = map[status] || map.not_placed;
    return {
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.color,
    };
  },

  // Pagination / footer
  footer: {
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
  lastUpdated: {
    fontSize: 11,
    color: "var(--muted)",
    marginTop: 12,
    textAlign: "center",
  },
  empty: {
    textAlign: "center",
    padding: "40px 20px",
    color: "var(--muted)",
  },
};

const STATUS_LABELS = {
  interviewing: "Interviewing",
  placed: "Placed \u2713",
  not_placed: "Not placed",
};

// ── Unlock Dots Component ───────────────────────────────────

function UnlockDots({ count }) {
  const [hover, setHover] = useState(false);
  const filled = Math.min(count, 5);
  const empty = Math.max(0, 5 - filled);
  const overflow = count > 5 ? count - 5 : 0;

  return (
    <div
      style={s.unlockDots}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {Array.from({ length: filled }).map((_, i) => (
        <div key={`f${i}`} style={s.dot(true)} />
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <div key={`e${i}`} style={s.dot(false)} />
      ))}
      {overflow > 0 && (
        <span style={s.dotOverflow}>+{overflow}</span>
      )}
      {hover && (
        <div style={s.tooltip}>
          {count} {count === 1 ? "company has" : "companies have"} unlocked this profile
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────

export default function ReferrerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [lastFetched, setLastFetched] = useState(null);
  const refreshInterval = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/referrer/candidates/performance");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastFetched(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + 6-hour refresh
  useEffect(() => {
    fetchData();
    refreshInterval.current = setInterval(fetchData, 6 * 60 * 60 * 1000);
    return () => clearInterval(refreshInterval.current);
  }, [fetchData]);

  const candidates = data?.candidates || [];
  const summary = data?.summary || { total_views: 0, total_unlocks: 0, total_placements: 0 };
  const totalPages = Math.ceil(candidates.length / PAGE_SIZE);
  const paged = candidates.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function minutesAgo() {
    if (!lastFetched) return "—";
    const mins = Math.floor((Date.now() - lastFetched.getTime()) / 60000);
    if (mins < 1) return "just now";
    return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <h1 style={s.title}>Performance</h1>

        {/* Summary cards */}
        <div style={s.summaryRow}>
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>Total profile views</div>
            <div style={s.summaryValue}>{summary.total_views}</div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>Total unlocks</div>
            <div style={s.summaryValue}>{summary.total_unlocks}</div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>Successful placements</div>
            <div style={s.summaryValue}>{summary.total_placements}</div>
          </div>
        </div>

        {/* Performance table */}
        <div style={s.card}>
          <div style={s.headerRow}>
            <span>Candidate role</span>
            <span>Seniority</span>
            <span>Referred</span>
            <span>Views</span>
            <span>Unlocks</span>
            <span>Status</span>
          </div>

          {loading && !data && <div style={s.empty}>Loading...</div>}

          {!loading && paged.length === 0 && (
            <div style={s.empty}>
              No candidates referred yet. Upload your first candidate to get started.
            </div>
          )}

          {paged.map((c) => (
            <div key={c.candidate_id} style={s.row}>
              <div style={s.roleText}>{c.role_applied_for}</div>
              <div style={s.seniorityText}>{c.seniority_level}</div>
              <div style={s.dateText}>
                {new Date(c.referred_at).toLocaleDateString("en-AU", {
                  day: "2-digit",
                  month: "short",
                })}
              </div>
              <div style={s.viewsText}>{c.views}</div>
              <UnlockDots count={c.unlock_count} />
              <span style={s.statusPill(c.placement_status)}>
                {STATUS_LABELS[c.placement_status] || "Not placed"}
              </span>
            </div>
          ))}

          {candidates.length > PAGE_SIZE && (
            <div style={s.footer}>
              <span>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, candidates.length)} of {candidates.length}
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

        {/* Last updated */}
        <div style={s.lastUpdated}>
          Last updated {minutesAgo()}
        </div>
      </div>
    </div>
  );
}
