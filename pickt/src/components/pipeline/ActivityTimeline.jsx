import { useCallback, useEffect, useState } from "react";

/**
 * ActivityTimeline — collapsible timeline below CV on unlocked profile.
 * Shows pipeline events in reverse chronological order.
 *
 * Props:
 *   candidateId: string
 *   events: array (pre-fetched) OR null (will fetch)
 */

const STAGE_DISPLAY = {
  unlocked:            { label: "Profile unlocked",     color: "var(--accent)", icon: "\uD83D\uDD13" },
  contacted:           { label: "Contacted",            color: "var(--blue)",   icon: "\uD83D\uDCE7" },
  interview_scheduled: { label: "Interview scheduled",  color: "var(--blue)",   icon: "\uD83D\uDCC5" },
  interviewing:        { label: "Interviewing",         color: "var(--accent)", icon: "\uD83C\uDFAF" },
  offer_made:          { label: "Offer made",           color: "var(--green)",  icon: "\uD83D\uDE80" },
  hired:               { label: "Hired",                color: "var(--green)",  icon: "\uD83D\uDCB0" },
  passed:              { label: "Passed",               color: "var(--amber)",  icon: "\u274C" },
};

const s = {
  wrapper: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    cursor: "pointer",
    userSelect: "none",
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
  },
  headerToggle: {
    fontSize: 14,
    color: "var(--muted)",
  },
  body: {
    padding: "0 16px 16px",
  },
  event: {
    display: "flex",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid var(--border)",
  },
  eventLast: {
    display: "flex",
    gap: 12,
    padding: "12px 0",
  },
  dotCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: 2,
  },
  eventDot: (color) => ({
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
  }),
  eventLine: {
    flex: 1,
    width: 1,
    background: "var(--border)",
    marginTop: 4,
  },
  eventContent: { flex: 1 },
  eventLabel: (color) => ({
    fontSize: 13,
    fontWeight: 500,
    color,
  }),
  eventNotes: {
    fontSize: 12,
    color: "var(--text2)",
    marginTop: 4,
    lineHeight: 1.5,
  },
  eventTime: {
    fontSize: 11,
    color: "var(--muted)",
    marginTop: 4,
  },
  empty: {
    padding: "16px 0",
    fontSize: 12,
    color: "var(--muted)",
    textAlign: "center",
  },
};

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ActivityTimeline({ candidateId, events: initialEvents }) {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState(initialEvents || []);
  const [loading, setLoading] = useState(!initialEvents);

  const fetchEvents = useCallback(async () => {
    if (initialEvents) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pipeline-events?candidate_id=${candidateId}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } finally {
      setLoading(false);
    }
  }, [candidateId, initialEvents]);

  useEffect(() => {
    if (expanded && !initialEvents) fetchEvents();
  }, [expanded, fetchEvents, initialEvents]);

  // Reverse chronological
  const sorted = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div style={s.wrapper}>
      <div style={s.header} onClick={() => setExpanded(!expanded)}>
        <span style={s.headerTitle}>
          Activity timeline ({events.length})
        </span>
        <span style={s.headerToggle}>{expanded ? "\u25B4" : "\u25BE"}</span>
      </div>

      {expanded && (
        <div style={s.body}>
          {loading && <div style={s.empty}>Loading...</div>}

          {!loading && sorted.length === 0 && (
            <div style={s.empty}>No activity yet.</div>
          )}

          {!loading && sorted.map((ev, i) => {
            const display = STAGE_DISPLAY[ev.stage] || STAGE_DISPLAY.unlocked;
            const isLast = i === sorted.length - 1;

            return (
              <div key={ev.id} style={isLast ? s.eventLast : s.event}>
                <div style={s.dotCol}>
                  <div style={s.eventDot(display.color)} />
                  {!isLast && <div style={s.eventLine} />}
                </div>
                <div style={s.eventContent}>
                  <div style={s.eventLabel(display.color)}>
                    {display.icon} {display.label}
                  </div>
                  {ev.notes && <div style={s.eventNotes}>{ev.notes}</div>}
                  <div style={s.eventTime}>{relativeTime(ev.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
