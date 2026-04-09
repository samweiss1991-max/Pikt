import { useCallback, useEffect, useRef, useState } from "react";

/**
 * StageTracker — horizontal dot-connector progress bar.
 * Shown on unlocked candidate profiles, right of candidate name.
 *
 * Props:
 *   unlockId: string
 *   candidateId: string
 *   currentStage: string (pipeline_stage enum)
 *   onStageChange: (stage: string) => void — parent callback
 *   onHireTriggered: () => void — opens HireConfirmationModal
 */

const STAGES = [
  { id: "contacted",           label: "Contacted" },
  { id: "interview_scheduled", label: "Interview scheduled" },
  { id: "interviewing",        label: "Interviewing" },
  { id: "offer_made",          label: "Offer made" },
  { id: "hired",               label: "Hired" },
  { id: "passed",              label: "Passed" },
];

const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

const PASS_REASONS = [
  "Culture fit concerns",
  "Technical skills gap",
  "Salary expectations too high",
  "Candidate withdrew",
  "Better candidate found",
  "Role cancelled",
  "Other",
];

// ── Styles ──────────────────────────────────────────────────

const s = {
  wrapper: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    padding: "8px 0",
    userSelect: "none",
  },
  step: {
    display: "flex",
    alignItems: "center",
    position: "relative",
  },
  dot: (state) => ({
    width: state === "active" ? 24 : 14,
    height: state === "active" ? 24 : 14,
    borderRadius: "50%",
    background:
      state === "completed" ? "var(--green)"
      : state === "active" ? "var(--accent)"
      : "var(--border2)",
    border:
      state === "active" ? "2px solid var(--accent-border)" : "none",
    cursor: "pointer",
    transition: "all 0.15s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    position: "relative",
    zIndex: 2,
  }),
  dotCheck: {
    fontSize: 9,
    color: "#fff",
    fontWeight: 700,
    lineHeight: 1,
  },
  connector: (completed) => ({
    width: 20,
    height: 2,
    background: completed ? "var(--green)" : "var(--border)",
    flexShrink: 0,
    zIndex: 1,
  }),
  label: (state) => ({
    position: "absolute",
    top: "100%",
    left: "50%",
    transform: "translateX(-50%)",
    marginTop: 6,
    fontSize: 9,
    fontWeight: state === "active" ? 600 : 400,
    color: state === "active" ? "var(--accent)"
      : state === "completed" ? "var(--green)"
      : "var(--muted)",
    whiteSpace: "nowrap",
    textAlign: "center",
  }),
  // Popover
  popover: {
    position: "absolute",
    top: "calc(100% + 28px)",
    left: "50%",
    transform: "translateX(-50%)",
    width: 260,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 8px 32px rgba(0,0,0,.12)",
    padding: 16,
    zIndex: 50,
  },
  popoverTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 10,
  },
  textarea: {
    width: "100%",
    minHeight: 70,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface2)",
    color: "var(--text)",
    fontSize: 12,
    outline: "none",
    resize: "vertical",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    lineHeight: 1.5,
  },
  select: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface2)",
    color: "var(--text)",
    fontSize: 12,
    outline: "none",
    marginBottom: 8,
  },
  saveBtn: (disabled) => ({
    width: "100%",
    padding: "8px 0",
    borderRadius: 8,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    marginTop: 8,
  }),
};

// ── Component ───────────────────────────────────────────────

export default function StageTracker({
  unlockId,
  candidateId,
  currentStage,
  onStageChange,
  onHireTriggered,
}) {
  const [activePopover, setActivePopover] = useState(null);
  const [notes, setNotes] = useState("");
  const [passReason, setPassReason] = useState("");
  const [saving, setSaving] = useState(false);
  const popoverRef = useRef(null);

  const currentIdx = STAGE_ORDER[currentStage] ?? -1;

  // Close popover on click outside
  useEffect(() => {
    function handleClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setActivePopover(null);
      }
    }
    if (activePopover !== null) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [activePopover]);

  const handleDotClick = useCallback((stageId, idx) => {
    // Can only advance forward or to 'passed' from any point
    if (stageId === "passed" || idx > currentIdx) {
      setActivePopover(stageId);
      setNotes("");
      setPassReason("");
    }
  }, [currentIdx]);

  const handleSave = useCallback(async () => {
    if (!activePopover || saving) return;

    // For 'passed', require a reason
    if (activePopover === "passed" && !passReason) return;

    setSaving(true);
    try {
      const eventNotes = activePopover === "passed"
        ? `${passReason}${notes ? `: ${notes}` : ""}`
        : notes || null;

      const res = await fetch("/api/pipeline-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unlock_id: unlockId,
          candidate_id: candidateId,
          stage: activePopover,
          notes: eventNotes,
        }),
      });

      if (res.ok) {
        setActivePopover(null);
        onStageChange?.(activePopover);

        // Trigger hire modal for 'hired' stage
        if (activePopover === "hired") {
          onHireTriggered?.();
        }
      }
    } finally {
      setSaving(false);
    }
  }, [activePopover, saving, passReason, notes, unlockId, candidateId, onStageChange, onHireTriggered]);

  return (
    <div style={s.wrapper}>
      {STAGES.map((stage, idx) => {
        const isPassed = currentStage === "passed";
        let state = "future";
        if (isPassed && stage.id === "passed") {
          state = "active";
        } else if (!isPassed) {
          if (idx < currentIdx) state = "completed";
          else if (idx === currentIdx) state = "active";
        }

        const isLast = idx === STAGES.length - 1;

        return (
          <div key={stage.id} style={s.step}>
            {/* Dot */}
            <div
              style={s.dot(state)}
              onClick={() => handleDotClick(stage.id, idx)}
              title={stage.label}
            >
              {state === "completed" && (
                <span style={s.dotCheck}>&#10003;</span>
              )}
            </div>

            {/* Label */}
            <span style={s.label(state)}>{stage.label}</span>

            {/* Connector line (not after last) */}
            {!isLast && (
              <div style={s.connector(state === "completed" || (idx < currentIdx && !isPassed))} />
            )}

            {/* Popover */}
            {activePopover === stage.id && (
              <div ref={popoverRef} style={s.popover}>
                <div style={s.popoverTitle}>
                  {stage.id === "passed"
                    ? "Why didn't it work out?"
                    : `Move to: ${stage.label}`}
                </div>

                {/* Pass reason dropdown */}
                {stage.id === "passed" && (
                  <select
                    value={passReason}
                    onChange={(e) => setPassReason(e.target.value)}
                    style={s.select}
                  >
                    <option value="">Select a reason…</option>
                    {PASS_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                )}

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                  placeholder="Add a note about this stage…"
                  style={s.textarea}
                />
                <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "right", marginTop: 2 }}>
                  {notes.length}/500
                </div>

                <button
                  type="button"
                  style={s.saveBtn(saving || (stage.id === "passed" && !passReason))}
                  disabled={saving || (stage.id === "passed" && !passReason)}
                  onClick={handleSave}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
