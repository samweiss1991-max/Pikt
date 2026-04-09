import { useCallback, useEffect, useState } from "react";

/**
 * FeeInput — fee percentage input with live health indicator,
 * helper text, and first-time tip card.
 *
 * Props:
 *   value: number | string — current fee percentage
 *   onChange: (value: string) => void
 *   companyId: string — for storing tip dismissed state
 *   isFirstUpload: boolean — show tip card on first upload only
 */

// ── Fee health thresholds ───────────────────────────────────

const FEE_THRESHOLDS = {
  high:     { min: 0,  max: 10, label: "High unlock rate \u2191", color: "var(--green)", bg: "var(--green-dim)", border: "var(--green-border)" },
  moderate: { min: 11, max: 14, label: "Moderate unlock rate",   color: "var(--amber)", bg: "var(--amber-dim)", border: "var(--amber-border)" },
  low:      { min: 15, max: 100, label: "Low unlock rate \u2014 consider reducing", color: "var(--red)", bg: "var(--red-dim)", border: "var(--red-border)" },
};

function getHealthLevel(pct) {
  const n = parseInt(pct, 10);
  if (isNaN(n) || n < 1) return null;
  if (n <= FEE_THRESHOLDS.high.max) return FEE_THRESHOLDS.high;
  if (n <= FEE_THRESHOLDS.moderate.max) return FEE_THRESHOLDS.moderate;
  return FEE_THRESHOLDS.low;
}

const DISMISS_KEY = "pickt_fee_tip_dismissed";

// ── Styles ──────────────────────────────────────────────────

const s = {
  wrapper: { marginBottom: 16 },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  input: {
    width: 100,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface2)",
    color: "var(--text)",
    fontSize: 14,
    fontWeight: 600,
    outline: "none",
    textAlign: "center",
  },
  suffix: {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text2)",
  },
  pill: (health) => ({
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 12px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 600,
    background: health.bg,
    border: `1px solid ${health.border}`,
    color: health.color,
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
  }),
  helper: {
    fontSize: 11,
    color: "var(--muted)",
    marginTop: 6,
    lineHeight: 1.5,
  },
  tipCard: {
    display: "flex",
    gap: 10,
    padding: "14px 16px",
    borderRadius: 10,
    background: "var(--accent-dim)",
    border: "1px solid var(--accent-border)",
    marginBottom: 12,
    fontSize: 12,
    color: "var(--text2)",
    lineHeight: 1.5,
    position: "relative",
  },
  tipIcon: {
    fontSize: 16,
    flexShrink: 0,
    marginTop: 1,
  },
  tipDismiss: {
    position: "absolute",
    top: 8,
    right: 10,
    border: "none",
    background: "none",
    color: "var(--muted)",
    fontSize: 16,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  },
  tipContent: { flex: 1, paddingRight: 20 },
};

// ── Component ───────────────────────────────────────────────

export default function FeeInput({
  value,
  onChange,
  companyId,
  isFirstUpload,
}) {
  const [tipDismissed, setTipDismissed] = useState(false);

  // Check localStorage for dismissed state
  useEffect(() => {
    const key = `${DISMISS_KEY}_${companyId}`;
    if (localStorage.getItem(key) === "true") {
      setTipDismissed(true);
    }
  }, [companyId]);

  const dismissTip = useCallback(() => {
    setTipDismissed(true);
    const key = `${DISMISS_KEY}_${companyId}`;
    localStorage.setItem(key, "true");

    // Also persist to company record (best-effort)
    fetch("/api/company/dismiss-fee-tip", { method: "POST" }).catch(() => {});
  }, [companyId]);

  const health = getHealthLevel(value);
  const showTip = isFirstUpload && !tipDismissed;

  return (
    <div style={s.wrapper}>
      {/* First-time tip card */}
      {showTip && (
        <div style={s.tipCard}>
          <span style={s.tipIcon}>&#128161;</span>
          <div style={s.tipContent}>
            <strong>New to pickt?</strong> Listings between 8–10% get unlocked
            3x more often. You still earn significantly more than a traditional
            agency cut.
          </div>
          <button type="button" style={s.tipDismiss} onClick={dismissTip}>
            &#10005;
          </button>
        </div>
      )}

      <label style={s.label}>Placement fee</label>

      <div style={s.inputRow}>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9]/g, "");
            onChange(v);
          }}
          style={s.input}
          placeholder="8"
        />
        <span style={s.suffix}>%</span>

        {/* Health indicator pill */}
        {health && <span style={s.pill(health)}>{health.label}</span>}
      </div>

      {/* Helper text */}
      <div style={s.helper}>
        Listings at 8–10% receive 3x more unlocks on pickt
      </div>
    </div>
  );
}
