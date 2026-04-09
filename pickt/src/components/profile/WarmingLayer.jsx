import { useCallback, useEffect, useState } from "react";

/**
 * WarmingLayer — 3-second unlock delay + warming UI.
 *
 * On mount:
 *   1. Unlock button disabled at 35% opacity
 *   2. "Available in 3s…" label with spinner
 *   3. After 3s: smooth enable (0.4s ease), label → "Ready"
 *   4. Logs profile_viewed to AUDIT_LOG
 *
 * Props:
 *   candidateId: string
 *   feePct: number
 *   saving: string | null — e.g. "saves ~$14k–$20k"
 *   onUnlock: () => void
 *   onSave: () => void
 */

const WARMUP_SECONDS = 3;

const s = {
  bar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    background: "var(--surface)",
    borderTop: "1px solid var(--border)",
    boxShadow: "0 -2px 12px rgba(0,0,0,.06)",
    padding: "12px 0",
  },
  inner: {
    maxWidth: 800,
    margin: "0 auto",
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  feeArea: {},
  feeLine: { fontSize: 13, color: "var(--text)" },
  savingLine: { fontSize: 12, fontWeight: 600, color: "var(--green)", marginTop: 2 },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  saveBtn: {
    padding: "10px 18px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text2)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  unlockBtn: (ready) => ({
    padding: "10px 24px",
    borderRadius: 10,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: ready ? "pointer" : "default",
    opacity: ready ? 1 : 0.35,
    transition: "opacity 0.4s ease",
    minWidth: 160,
    textAlign: "center",
  }),
  statusLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    color: "var(--muted)",
    marginRight: 4,
  },
  spinner: {
    width: 12,
    height: 12,
    border: "2px solid var(--border)",
    borderTop: "2px solid var(--accent)",
    borderRadius: "50%",
    animation: "warming-spin 0.8s linear infinite",
    flexShrink: 0,
  },
  readyDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--green)",
    flexShrink: 0,
  },
};

const spinKeyframes = `
@keyframes warming-spin {
  to { transform: rotate(360deg); }
}
`;

export default function WarmingLayer({
  candidateId,
  feePct,
  saving,
  onUnlock,
  onSave,
}) {
  const [secondsLeft, setSecondsLeft] = useState(WARMUP_SECONDS);
  const ready = secondsLeft <= 0;

  // Countdown
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  // Log profile_viewed on mount
  useEffect(() => {
    fetch(`/api/audit/profile-viewed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate_id: candidateId }),
    }).catch(() => {});
  }, [candidateId]);

  const handleUnlock = useCallback(() => {
    if (!ready) return;
    onUnlock?.();
  }, [ready, onUnlock]);

  return (
    <>
      <style>{spinKeyframes}</style>
      <div style={s.bar}>
        <div style={s.inner}>
          <div style={s.feeArea}>
            <div style={s.feeLine}>
              <strong>{feePct}%</strong> placement fee
            </div>
            {saving && <div style={s.savingLine}>{saving}</div>}
          </div>
          <div style={s.actions}>
            {/* Status label */}
            <div style={s.statusLabel}>
              {ready ? (
                <>
                  <div style={s.readyDot} />
                  <span style={{ color: "var(--green)", fontWeight: 500 }}>Ready</span>
                </>
              ) : (
                <>
                  <div style={s.spinner} />
                  <span>Available in {secondsLeft}s…</span>
                </>
              )}
            </div>

            <button type="button" style={s.saveBtn} onClick={onSave}>
              &#9825; Save to shortlist
            </button>
            <button
              type="button"
              style={s.unlockBtn(ready)}
              disabled={!ready}
              onClick={handleUnlock}
            >
              Unlock profile
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
