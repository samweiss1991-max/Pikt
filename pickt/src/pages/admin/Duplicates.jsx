import { useCallback, useEffect, useState } from "react";

const PAGE_SIZE = 25;

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    padding: 32,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: 13,
    color: "var(--text)",
  },
  container: { maxWidth: 1000, margin: "0 auto" },
  title: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 28,
    fontWeight: 400,
    margin: "0 0 8px",
  },
  subtitle: { fontSize: 13, color: "var(--muted)", marginBottom: 24 },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 8px rgba(0,0,0,.03)",
    overflow: "hidden",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 100px 100px 120px",
    gap: 12,
    padding: "14px 20px",
    borderBottom: "1px solid var(--border)",
    alignItems: "center",
    fontSize: 13,
  },
  headerRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 100px 100px 120px",
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
  candidateCell: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  roleText: { fontWeight: 500, color: "var(--text)" },
  metaText: { fontSize: 11, color: "var(--muted)" },
  scorePill: (score) => ({
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 600,
    background: score >= 0.9 ? "var(--red-dim)" : score >= 0.8 ? "var(--amber-dim)" : "var(--blue-dim)",
    border: `1px solid ${score >= 0.9 ? "var(--red-border)" : score >= 0.8 ? "var(--amber-border)" : "var(--blue-border)"}`,
    color: score >= 0.9 ? "var(--red)" : score >= 0.8 ? "var(--amber)" : "var(--blue)",
  }),
  resolutionPill: (res) => {
    const map = {
      different_person: { bg: "var(--green-dim)", border: "var(--green-border)", text: "var(--green)" },
      same_person_withdrawn: { bg: "var(--amber-dim)", border: "var(--amber-border)", text: "var(--amber)" },
      support_contacted: { bg: "var(--blue-dim)", border: "var(--blue-border)", text: "var(--blue)" },
      ignored: { bg: "var(--surface2)", border: "var(--border)", text: "var(--muted)" },
    };
    const c = map[res] || map.ignored;
    return {
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 500,
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
    };
  },
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

export default function Duplicates() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDuplicates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        offset: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
        min_score: "0.8",
      });
      const res = await fetch(`/api/admin/duplicates?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.duplicates || []);
        setTotal(json.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchDuplicates();
  }, [fetchDuplicates]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Duplicate review</h1>
        <p style={styles.subtitle}>
          Candidate pairs with similarity above 80% flagged for manual review.
        </p>

        <div style={styles.card}>
          {/* Header */}
          <div style={styles.headerRow}>
            <span>Existing candidate</span>
            <span>Submitted by</span>
            <span>Score</span>
            <span>Resolution</span>
            <span>Date</span>
          </div>

          {/* Rows */}
          {loading && <div style={styles.empty}>Loading...</div>}

          {!loading && data.length === 0 && (
            <div style={styles.empty}>No high-similarity duplicates found.</div>
          )}

          {!loading &&
            data.map((d) => (
              <div key={d.id} style={styles.row}>
                <div style={styles.candidateCell}>
                  <span style={styles.roleText}>
                    {d.candidate?.role_applied_for || "—"}
                  </span>
                  <span style={styles.metaText}>
                    {[d.candidate?.location_city, d.candidate?.current_company_name]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </span>
                </div>
                <div style={styles.candidateCell}>
                  <span style={styles.roleText}>{d.company_name || "—"}</span>
                  <span style={styles.metaText}>
                    {d.candidate?.referred_at
                      ? new Date(d.candidate.referred_at).toLocaleDateString("en-AU", {
                          day: "2-digit",
                          month: "short",
                        })
                      : "—"}
                  </span>
                </div>
                <div>
                  <span style={styles.scorePill(d.similarity_score)}>
                    {Math.round(d.similarity_score * 100)}%
                  </span>
                </div>
                <div>
                  {d.resolution ? (
                    <span style={styles.resolutionPill(d.resolution)}>
                      {d.resolution.replace(/_/g, " ")}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--amber)" }}>
                      Pending
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {new Date(d.created_at).toLocaleDateString("en-AU", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            ))}

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div style={styles.pagination}>
              <span>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
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
          )}
        </div>
      </div>
    </div>
  );
}
