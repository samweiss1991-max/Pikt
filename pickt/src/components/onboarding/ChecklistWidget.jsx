import { useCallback, useEffect, useState } from "react";

/**
 * ChecklistWidget — sidebar onboarding progress widget.
 * Visible only when onboarding not completed and not dismissed.
 * Positioned in sidebar between nav items and footer.
 */

const s = {
  wrapper: {
    margin: "0 10px",
    padding: "12px 14px",
    borderRadius: 10,
    background: "var(--surface2)",
    border: "1.5px solid var(--accent-border)",
  },
  header: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text2)",
    marginBottom: 8,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    background: "var(--border)",
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: (pct) => ({
    height: "100%",
    width: `${pct}%`,
    borderRadius: 2,
    background: "var(--accent)",
    transition: "width 0.4s ease",
  }),
  progressLabel: {
    fontSize: 10,
    color: "var(--muted)",
    marginBottom: 10,
    textAlign: "right",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 0",
    fontSize: 12,
    cursor: "pointer",
    textDecoration: "none",
  },
  ring: (completed) => ({
    width: 16,
    height: 16,
    borderRadius: "50%",
    border: completed ? "none" : "1.5px solid var(--border2)",
    background: completed ? "var(--green)" : "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  }),
  check: {
    fontSize: 9,
    color: "#fff",
    fontWeight: 700,
    lineHeight: 1,
  },
  label: (completed) => ({
    flex: 1,
    color: completed ? "var(--green)" : "var(--muted)",
    textDecoration: completed ? "line-through" : "none",
    fontSize: 12,
  }),
  arrow: {
    fontSize: 12,
    color: "var(--muted)",
  },
  dismiss: {
    display: "block",
    textAlign: "right",
    marginTop: 8,
    border: "none",
    background: "none",
    fontSize: 10,
    color: "var(--muted)",
    cursor: "pointer",
    padding: 0,
  },
  successMsg: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--green)",
    padding: "8px 0",
  },
};

export default function ChecklistWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/status");
      if (res.ok) {
        const json = await res.json();
        setData(json);

        // Show success animation if just completed
        if (json.all_complete && !json.onboarding_completed_at) {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleDismiss() {
    await fetch("/api/onboarding/dismiss", { method: "POST" });
    setData((prev) => prev ? { ...prev, visible: false } : null);
  }

  if (loading || !data || !data.visible) return null;

  if (showSuccess) {
    return (
      <div style={s.wrapper}>
        <div style={s.successMsg}>You're all set &#127881;</div>
      </div>
    );
  }

  const pct = (data.completed_count / data.total) * 100;

  return (
    <div style={s.wrapper}>
      <div style={s.header}>Get started</div>

      {/* Progress bar */}
      <div style={s.progressTrack}>
        <div style={s.progressFill(pct)} />
      </div>
      <div style={s.progressLabel}>
        {data.completed_count}/{data.total}
      </div>

      {/* Checklist items */}
      {data.steps.map((step) => (
        <a
          key={step.id}
          href={step.completed ? undefined : step.url}
          style={s.item}
          onClick={(e) => {
            if (step.completed) e.preventDefault();
          }}
        >
          <div style={s.ring(step.completed)}>
            {step.completed && <span style={s.check}>&#10003;</span>}
          </div>
          <span style={s.label(step.completed)}>{step.label}</span>
          {!step.completed && <span style={s.arrow}>&#8594;</span>}
        </a>
      ))}

      {/* Dismiss */}
      <button type="button" style={s.dismiss} onClick={handleDismiss}>
        Dismiss
      </button>
    </div>
  );
}
