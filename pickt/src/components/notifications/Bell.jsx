import { useCallback, useEffect, useRef, useState } from "react";

/**
 * NotificationBell — topbar bell icon with dropdown panel.
 *
 * Props:
 *   companyId: string — for fetching notifications
 */

// ── Styles ──────────────────────────────────────────────────

const s = {
  wrapper: {
    position: "relative",
    display: "inline-flex",
  },
  button: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "var(--text2)",
    position: "relative",
  },
  badge: (count) => ({
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 99,
    background: "var(--accent)",
    color: "#fff",
    fontSize: 8,
    fontWeight: 700,
    display: count > 0 ? "flex" : "none",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
    lineHeight: 1,
  }),
  panel: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    width: 320,
    maxHeight: 420,
    overflowY: "auto",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 8px 32px rgba(0,0,0,.12)",
    zIndex: 100,
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px 10px",
    borderBottom: "1px solid var(--border)",
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
  },
  markAllBtn: {
    border: "none",
    background: "none",
    color: "var(--accent)",
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
    padding: 0,
  },
  row: (unread) => ({
    display: "flex",
    gap: 10,
    padding: "12px 16px",
    borderBottom: "1px solid var(--border)",
    borderLeft: unread ? "2px solid var(--accent)" : "2px solid transparent",
    background: unread ? "var(--surface2)" : "var(--surface)",
    cursor: "pointer",
    transition: "background 0.1s ease",
  }),
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: "var(--accent-dim)",
    border: "1px solid var(--accent-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowContent: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  rowBody: {
    fontSize: 11,
    color: "var(--muted)",
    marginTop: 2,
    lineHeight: 1.4,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  rowTime: {
    fontSize: 10,
    color: "var(--muted)",
    marginTop: 3,
  },
  footer: {
    textAlign: "center",
    padding: "10px 16px",
  },
  footerLink: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--accent)",
    textDecoration: "none",
    cursor: "pointer",
  },
  empty: {
    textAlign: "center",
    padding: "32px 16px",
    fontSize: 12,
    color: "var(--muted)",
  },
};

// ── Helpers ─────────────────────────────────────────────────

const TYPE_ICONS = {
  candidate_unlocked: "\uD83D\uDD13",
  candidate_stage_changed: "\uD83D\uDD04",
  hire_confirmation_due: "\u23F0",
  placement_confirmed: "\u2705",
  fee_disputed: "\u26A0\uFE0F",
  dispute_resolved: "\u2696\uFE0F",
  ats_referral_prompt: "\uD83D\uDCE5",
  system: "\u2139\uFE0F",
};

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
}

// ── Component ───────────────────────────────────────────────

export default function Bell({ companyId }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?limit=15`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Poll every 30s when panel closed, fetch on open
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleMarkAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    );
    setUnreadCount(0);
  }

  async function handleClickRow(notif) {
    // Mark as read
    if (!notif.read_at) {
      await fetch(`/api/notifications/${notif.id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    // Navigate
    if (notif.action_url) {
      window.location.href = notif.action_url;
    }
    setOpen(false);
  }

  const badgeText = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <div style={s.wrapper} ref={panelRef}>
      {/* Bell button */}
      <button
        type="button"
        style={s.button}
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span style={s.badge(unreadCount)}>{badgeText}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <span style={s.panelTitle}>Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                style={s.markAllBtn}
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          {loading && notifications.length === 0 && (
            <div style={s.empty}>Loading...</div>
          )}

          {!loading && notifications.length === 0 && (
            <div style={s.empty}>No notifications yet.</div>
          )}

          {notifications.map((n) => {
            const unread = !n.read_at;
            return (
              <div
                key={n.id}
                style={s.row(unread)}
                onClick={() => handleClickRow(n)}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "var(--surface2)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = unread
                    ? "var(--surface2)"
                    : "var(--surface)";
                }}
              >
                <div style={s.rowIcon}>
                  <span style={{ fontSize: 14 }}>
                    {TYPE_ICONS[n.type] || "\u2139\uFE0F"}
                  </span>
                </div>
                <div style={s.rowContent}>
                  <div style={s.rowTitle}>{n.title}</div>
                  {n.body && <div style={s.rowBody}>{n.body}</div>}
                  <div style={s.rowTime}>{relativeTime(n.created_at)}</div>
                </div>
              </div>
            );
          })}

          <div style={s.footer}>
            <a href="/notifications" style={s.footerLink}>
              View all &rarr;
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
