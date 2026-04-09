import { useCallback, useEffect, useMemo, useState } from "react";

// ── Event type pill colours (mapped to CSS variables) ────────

const EVENT_COLOURS = {
  profile_viewed:           { bg: "var(--blue-dim)",    border: "var(--blue-border)",    text: "var(--blue)" },
  profile_unlocked:         { bg: "var(--green-dim)",   border: "var(--green-border)",   text: "var(--green)" },
  pii_accessed:             { bg: "var(--amber-dim)",   border: "var(--amber-border)",   text: "var(--amber)" },
  cv_downloaded:            { bg: "var(--purple-dim)",  border: "var(--purple-border)",  text: "var(--purple)" },
  candidate_contacted:      { bg: "var(--blue-dim)",    border: "var(--blue-border)",    text: "var(--blue)" },
  pipeline_stage_changed:   { bg: "var(--accent-dim)",  border: "var(--accent-border)",  text: "var(--accent)" },
  placement_confirmed:      { bg: "var(--green-dim)",   border: "var(--green-border)",   text: "var(--green)" },
  fee_disputed:             { bg: "var(--red-dim)",     border: "var(--red-border)",     text: "var(--red)" },
  shortlist_added:          { bg: "var(--accent-dim)",  border: "var(--accent-border)",  text: "var(--accent)" },
  shortlist_removed:        { bg: "var(--amber-dim)",   border: "var(--amber-border)",   text: "var(--amber)" },
  similar_candidate_clicked:{ bg: "var(--purple-dim)",  border: "var(--purple-border)",  text: "var(--purple)" },
  ats_import_triggered:     { bg: "var(--blue-dim)",    border: "var(--blue-border)",    text: "var(--blue)" },
};

const EVENT_TYPES = Object.keys(EVENT_COLOURS);
const PAGE_SIZE = 25;

// ── Styles ──────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    padding: "32px",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: 13,
    color: "var(--text)",
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 28,
    fontWeight: 400,
    color: "var(--text)",
    margin: 0,
  },
  exportBtn: {
    padding: "8px 16px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text2)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 8px rgba(0,0,0,.03)",
    overflow: "hidden",
  },
  filters: {
    display: "flex",
    gap: 12,
    padding: "16px 20px",
    borderBottom: "1px solid var(--border)",
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  input: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface2)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    minWidth: 140,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "10px 16px",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: "1px solid var(--border)",
    background: "var(--surface2)",
  },
  td: {
    padding: "10px 16px",
    borderBottom: "1px solid var(--border)",
    fontSize: 13,
    verticalAlign: "middle",
  },
  pill: (type) => {
    const c = EVENT_COLOURS[type] || EVENT_COLOURS.profile_viewed;
    return {
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 500,
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
      whiteSpace: "nowrap",
    };
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderTop: "1px solid var(--border)",
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
  emptyRow: {
    textAlign: "center",
    padding: "40px 16px",
    color: "var(--muted)",
    fontSize: 13,
  },
};

// ── Component ───────────────────────────────────────────────

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [companySearch, setCompanySearch] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        offset: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      });
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      if (selectedTypes.length) params.set("types", selectedTypes.join(","));
      if (companySearch.trim()) params.set("company", companySearch.trim());

      const res = await fetch(`/api/admin/audit-log?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, dateFrom, dateTo, selectedTypes, companySearch]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [dateFrom, dateTo, selectedTypes, companySearch]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── CSV export ──────────────────────────────────────────

  function handleExport() {
    const header = "Timestamp,Event Type,Company,Candidate Role,IP Address\n";
    const rows = logs
      .map(
        (l) =>
          `"${l.created_at}","${l.event_type}","${l.company_name || ""}","${l.candidate_role || ""}","${l.ip_address || ""}"`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Event type multi-select toggle ──────────────────────

  function toggleType(type) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  // ── Render ──────────────────────────────────────────────

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>Audit log</h1>
          <button
            type="button"
            style={styles.exportBtn}
            onClick={handleExport}
          >
            Export CSV
          </button>
        </div>

        {/* Card */}
        <div style={styles.card}>
          {/* Filters */}
          <div style={styles.filters}>
            <div style={styles.filterGroup}>
              <span style={styles.filterLabel}>From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.filterGroup}>
              <span style={styles.filterLabel}>To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.filterGroup}>
              <span style={styles.filterLabel}>Company</span>
              <input
                type="text"
                placeholder="Search company..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.filterGroup}>
              <span style={styles.filterLabel}>Event type</span>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  maxWidth: 500,
                }}
              >
                {EVENT_TYPES.map((type) => {
                  const active = selectedTypes.includes(type);
                  const c = EVENT_COLOURS[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      style={{
                        padding: "2px 8px",
                        borderRadius: 99,
                        fontSize: 10,
                        fontWeight: 500,
                        border: `1px solid ${active ? c.border : "var(--border)"}`,
                        background: active ? c.bg : "var(--surface2)",
                        color: active ? c.text : "var(--muted)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {type.replace(/_/g, " ")}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Timestamp</th>
                  <th style={styles.th}>Event type</th>
                  <th style={styles.th}>Company</th>
                  <th style={styles.th}>Candidate role</th>
                  <th style={styles.th}>IP address</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} style={styles.emptyRow}>
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={5} style={styles.emptyRow}>
                      No audit events found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td style={styles.td}>
                        <span style={{ whiteSpace: "nowrap" }}>
                          {new Date(log.created_at).toLocaleDateString("en-AU", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <br />
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          {new Date(log.created_at).toLocaleTimeString("en-AU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.pill(log.event_type)}>
                          {log.event_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {log.company_name || (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        {log.candidate_role || (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: 12,
                            color: "var(--muted)",
                          }}
                        >
                          {log.ip_address || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={styles.pagination}>
            <span>
              {total === 0
                ? "No results"
                : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                style={styles.pageBtn(page === 0)}
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                style={styles.pageBtn(page >= totalPages - 1)}
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
