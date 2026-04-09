import { useCallback, useEffect, useState } from "react";

const PAGE_SIZE = 25;

const STATUS_COLORS = {
  open:                 { bg: "var(--amber-dim)", border: "var(--amber-border)", text: "var(--amber)" },
  under_review:         { bg: "var(--blue-dim)",  border: "var(--blue-border)",  text: "var(--blue)" },
  resolved_in_favour:   { bg: "var(--green-dim)", border: "var(--green-border)", text: "var(--green)" },
  resolved_against:     { bg: "var(--red-dim)",   border: "var(--red-border)",   text: "var(--red)" },
  withdrawn:            { bg: "var(--surface2)",  border: "var(--border)",       text: "var(--muted)" },
};

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
    margin: 0,
  },
  filterRow: {
    display: "flex",
    gap: 8,
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
    padding: 20,
    marginBottom: 12,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  reason: { fontSize: 14, fontWeight: 600, color: "var(--text)" },
  pill: (status) => {
    const c = STATUS_COLORS[status] || STATUS_COLORS.open;
    return {
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
    };
  },
  meta: { fontSize: 12, color: "var(--muted)", lineHeight: 1.6 },
  notes: {
    fontSize: 12,
    color: "var(--text2)",
    lineHeight: 1.5,
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    background: "var(--surface2)",
    border: "1px solid var(--border)",
  },
  actions: {
    display: "flex",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  actionBtn: (variant) => ({
    padding: "7px 16px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 500,
    border: variant === "danger"
      ? "1px solid var(--red-border)"
      : variant === "success"
        ? "1px solid var(--green-border)"
        : "1px solid var(--border)",
    background: variant === "danger"
      ? "var(--red-dim)"
      : variant === "success"
        ? "var(--green-dim)"
        : "var(--surface)",
    color: variant === "danger"
      ? "var(--red)"
      : variant === "success"
        ? "var(--green)"
        : "var(--text2)",
    cursor: "pointer",
  }),
  empty: {
    textAlign: "center",
    padding: "40px 20px",
    color: "var(--muted)",
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
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
};

export default function Disputes() {
  const [disputes, setDisputes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        offset: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
        status: filter,
      });
      const res = await fetch(`/api/admin/disputes?${params}`);
      if (res.ok) {
        const json = await res.json();
        setDisputes(json.disputes || []);
        setTotal(json.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);
  useEffect(() => { setPage(0); }, [filter]);

  async function resolve(disputeId, resolution) {
    await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: resolution }),
    });
    fetchDisputes();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const filters = ["open", "under_review", "resolved_in_favour", "resolved_against", "withdrawn"];

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <h1 style={s.title}>Disputes</h1>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {total} total
          </span>
        </div>

        {/* Filters */}
        <div style={s.filterRow}>
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              style={s.filterBtn(filter === f)}
              onClick={() => setFilter(f)}
            >
              {f.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {/* Dispute cards */}
        {loading && <div style={s.empty}>Loading...</div>}

        {!loading && disputes.length === 0 && (
          <div style={s.empty}>No disputes found.</div>
        )}

        {!loading && disputes.map((d) => (
          <div key={d.id} style={s.card}>
            <div style={s.cardHeader}>
              <div>
                <div style={s.reason}>{d.reason}</div>
                <div style={s.meta}>
                  {d.company_name || "Unknown company"} &middot;{" "}
                  {new Date(d.created_at).toLocaleDateString("en-AU", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
              <span style={s.pill(d.status)}>
                {d.status.replace(/_/g, " ")}
              </span>
            </div>

            <div style={s.notes}>{d.notes}</div>

            {d.evidence_url && (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <a
                  href={d.evidence_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)", textDecoration: "underline" }}
                >
                  View evidence
                </a>
              </div>
            )}

            {/* Resolve actions (only for open/under_review) */}
            {(d.status === "open" || d.status === "under_review") && (
              <div style={s.actions}>
                {d.status === "open" && (
                  <button
                    type="button"
                    style={s.actionBtn("default")}
                    onClick={() => resolve(d.id, "under_review")}
                  >
                    Mark reviewing
                  </button>
                )}
                <button
                  type="button"
                  style={s.actionBtn("success")}
                  onClick={() => resolve(d.id, "resolved_in_favour")}
                >
                  Resolve in favour
                </button>
                <button
                  type="button"
                  style={s.actionBtn("danger")}
                  onClick={() => resolve(d.id, "resolved_against")}
                >
                  Resolve against
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Pagination */}
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
  );
}
