import { useState } from "react";

/**
 * BottomNav — mobile bottom navigation bar.
 * Replaces sidebar on screens <= 640px.
 *
 * Props:
 *   activeRoute: string — current route path
 *   shortlistBadge: number — pending review count
 */

const NAV_ITEMS = [
  {
    id: "home",
    label: "Home",
    path: "/",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "marketplace",
    label: "Discover",
    path: "/marketplace",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
  {
    id: "shortlist",
    label: "Shortlist",
    path: "/shortlist",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    id: "upload",
    label: "Upload",
    path: "/upload",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    id: "account",
    label: "Account",
    path: "/settings",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

const s = {
  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    background: "var(--surface)",
    borderTop: "1px solid var(--border)",
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
  },
  item: (active) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    padding: "6px 12px",
    border: "none",
    background: "none",
    cursor: "pointer",
    color: active ? "var(--accent)" : "var(--muted)",
    position: "relative",
    minWidth: 44,
    minHeight: 44,
  }),
  label: {
    fontSize: 9,
    fontWeight: 500,
    lineHeight: 1,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 99,
    background: "var(--accent)",
    color: "#fff",
    fontSize: 8,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
  },
};

export default function BottomNav({ activeRoute, shortlistBadge }) {
  function isActive(path) {
    if (path === "/") return activeRoute === "/";
    return activeRoute?.startsWith(path);
  }

  return (
    <nav style={s.nav} className="bottom-nav">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.path);
        return (
          <a
            key={item.id}
            href={item.path}
            style={s.item(active)}
          >
            {item.icon}
            <span style={s.label}>{item.label}</span>
            {item.id === "shortlist" && shortlistBadge > 0 && (
              <span style={s.badge}>
                {shortlistBadge > 9 ? "9+" : shortlistBadge}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
}
