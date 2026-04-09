import { useCallback, useEffect, useState } from "react";
import useBreakpoint from "./useBreakpoint.js";
import BottomNav from "./BottomNav.jsx";
import MobileTopbar from "./MobileTopbar.jsx";
import Sidebar from "../layout/Sidebar.jsx";
import Topbar from "../layout/Topbar.jsx";

/**
 * ResponsiveShell — replaces Shell.jsx with responsive behaviour.
 *
 * <640px: MobileTopbar + BottomNav, no sidebar
 * >=640px: Sidebar + Topbar (original layout)
 *
 * Props:
 *   children: ReactNode
 *   pageTitle: string
 *   actions: ReactNode
 *   activeRoute: string
 */

const s = {
  desktopShell: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
  },
  desktopMain: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  desktopContent: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 32px",
  },
  mobileShell: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
  },
  mobileContent: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    paddingBottom: "calc(60px + 16px + env(safe-area-inset-bottom, 0px))",
  },
};

export default function ResponsiveShell({
  children,
  pageTitle,
  actions,
  activeRoute,
}) {
  const { isMobile } = useBreakpoint();
  const [shortlistBadge, setShortlistBadge] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch badges
  useEffect(() => {
    fetch("/api/shortlist/count")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setShortlistBadge(d.count || 0); })
      .catch(() => {});

    fetch("/api/notifications?limit=0")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setUnreadCount(d.unread_count || 0); })
      .catch(() => {});
  }, []);

  if (isMobile) {
    return (
      <div style={s.mobileShell}>
        <MobileTopbar
          unreadCount={unreadCount}
          userInitial="A"
          onBellClick={() => { window.location.href = "/notifications"; }}
          onAvatarClick={() => { window.location.href = "/settings"; }}
        />
        <main style={s.mobileContent}>
          {children}
        </main>
        <BottomNav
          activeRoute={activeRoute}
          shortlistBadge={shortlistBadge}
        />
      </div>
    );
  }

  return (
    <div style={s.desktopShell}>
      <Sidebar />
      <div style={s.desktopMain}>
        <Topbar title={pageTitle} actions={actions} />
        <main style={s.desktopContent}>
          {children}
        </main>
      </div>
    </div>
  );
}
