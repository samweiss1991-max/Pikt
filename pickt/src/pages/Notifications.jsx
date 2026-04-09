import { useCallback, useEffect, useState } from "react";

/**
 * /notifications — full paginated notification list.
 */

const PAGE_SIZE = 20;

const TYPE_LABELS = {
  candidate_unlocked: "Unlocked",
  candidate_stage_changed: "Stage changed",
  hire_confirmation_due: "Hire due",
  placement_confirmed: "Placed",
  fee_disputed: "Disputed",
  dispute_resolved: "Resolved",
  ats_referral_prompt: "ATS prompt",
  system: "System",
};

const TYPE_COLORS = {
  candidate_unlocked:       { bg: "var(--accent-dim)",  border: "var(--accent-border)", text: "var(--accent)" },
  candidate_stage_changed:  { bg: "var(--blue-dim)",    border: "var(--blue-border)",   text: "var(--blue)" },
  hire_confirmation_due:    { bg: "var(--amber-dim)",   border: "var(--amber-border)",  text: "var(--amber)" },
  placement_confirmed:      { bg: "var(--green-dim)",   border: "var(--green-border)",  text: "var(--green)" },
  fee_disputed:             { bg: "var(--red-dim)",     border: "var(--red-border)",    text: "var(--red)" },
  dispute_resolved:         { bg: "var(--green-dim)",   border: "var(--green-border)",  text: "var(--green)" },
  ats_referral_prompt:      { bg: "var(--purple-dim)",  border: "var(--purple-border)", text: "var(--purple)" },
  system:                   { bg: "var(--surface2)",    border: "var(--border)",        text: "var(--muted)" },
};

const TYPES = Object.keys(TYPE_LABELS);

const s = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    padding: 32,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: 13,
    color: "var(--text)",
  },
  container: { maxWidth: 680, margin: "0 auto" },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 28,
    fontWeight: 400,
    margin: 0,
  },
  markAllBtn: {
    padding: "8px 16px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text2)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
  },
  filterRow: {
    display: "flex",
    gap: 6,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  filterBtn: (active) => ({
    padding: "4px 12px",
    borderRadius: 99,
    fontSize: 11,
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
  row: (unread) => ({
    display: "flex",
    gap: 14,
    padding: "14px 20px",
    borderBottom: "1px solid var(--border)",
    borderLeft: unread ? "3px solid var(--accent)" : "3px solid transparent",
    background: unread ? "var(--surface2)" : "var(--surface)",
    cursor: "pointer",
    transition: "background 0.1s ease",
  }),
  typePill: (type) => {
    const c = TYPE_COLORS[type] || TYPE_COLORS.system;
    return {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 99,
      fontSize: 10,
      fontWeight: 600,
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
      whiteSpace: "nowrap",
      flexShrink: 0,
      alignSelf: "flex-start",
      marginTop: 2,
    };
  },
  content: { flex: 1, minWidth: 0 },
  notifTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text)",
  },
  notifBody: {
    fontSize: 12,
    color: "var(--muted)",
    marginTop: 2,
    lineHeight: 1.5,
  },
  notifTime: {
    fontSize: 11,
    color: "var(--muted)",
    marginTop: 4,
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

function formatDate(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        offset: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      });
      if (typeFilter !== "all") params.set("type", typeFilter);

      const res = await fetch(`/api/notifications?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { setPage(0); }, [typeFilter]);

  async function handleMarkAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    );
  }

  async function handleClickRow(notif) {
    if (!notif.read_at) {
      await fetch(`/api/notifications/${notif.id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
    }
    if (notif.action_url) window.location.href = notif.action_url;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <h1 style={s.title}>Notifications</h1>
          <button type="button" style={s.markAllBtn} onClick={handleMarkAllRead}>
            Mark all read
          </button>
        </div>

        {/* Filters */}
        <div style={s.filterRow}>
          <button
            type="button"
            style={s.filterBtn(typeFilter === "all")}
            onClick={() => setTypeFilter("all")}
          >
            All
          </button>
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              style={s.filterBtn(typeFilter === t)}
              onClick={() => setTypeFilter(t)}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={s.card}>
          {loading && notifications.length === 0 && (
            <div style={s.empty}>Loading...</div>
          )}
          {!loading && notifications.length === 0 && (
            <div style={s.empty}>No notifications.</div>
          )}

          {notifications.map((n) => {
            const unread = !n.read_at;
            return (
              <div
                key={n.id}
                style={s.row(unread)}
                onClick={() => handleClickRow(n)}
              >
                <span style={s.typePill(n.type)}>
                  {TYPE_LABELS[n.type] || n.type}
                </span>
                <div style={s.content}>
                  <div style={s.notifTitle}>{n.title}</div>
                  {n.body && <div style={s.notifBody}>{n.body}</div>}
                  <div style={s.notifTime}>{formatDate(n.created_at)}</div>
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
