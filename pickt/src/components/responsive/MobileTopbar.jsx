/**
 * MobileTopbar — compact topbar for mobile (<640px).
 * Shows: logo + notification bell + account avatar.
 * Hides page title text.
 *
 * Props:
 *   unreadCount: number
 *   userInitial: string
 *   onBellClick: () => void
 *   onAvatarClick: () => void
 */

const s = {
  bar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 48,
    padding: "0 16px",
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
  },
  logo: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 19,
    color: "var(--text)",
    lineHeight: 1,
  },
  logoT: {
    fontStyle: "italic",
    color: "var(--accent)",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  bellBtn: {
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
    minWidth: 44,
    minHeight: 44,
    padding: 0,
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 14,
    height: 14,
    borderRadius: 99,
    background: "var(--accent)",
    color: "#fff",
    fontSize: 8,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 3px",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 99,
    background: "linear-gradient(135deg, var(--accent) 0%, #5a9020 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    minWidth: 44,
    minHeight: 44,
    padding: 8,
  },
};

export default function MobileTopbar({
  unreadCount,
  userInitial,
  onBellClick,
  onAvatarClick,
}) {
  return (
    <div style={s.bar}>
      <div style={s.logo}>
        pick<span style={s.logoT}>t</span>
      </div>

      <div style={s.right}>
        <button type="button" style={s.bellBtn} onClick={onBellClick}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span style={s.bellBadge}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <button type="button" style={s.avatar} onClick={onAvatarClick}>
          {userInitial || "?"}
        </button>
      </div>
    </div>
  );
}
