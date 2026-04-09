import { useCallback, useMemo, useState } from "react";

/**
 * HireConfirmationModal — multi-step workflow.
 *
 * Props:
 *   isOpen: boolean
 *   candidate: { id, role_applied_for, fee_percentage }
 *   unlockId: string
 *   unlockDate: string (ISO) — for 90-day window calculation
 *   onSuccess: () => void
 *   onCancel: () => void
 */

// ── Styles ──────────────────────────────────────────────────

const backdrop = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(26,32,16,.55)",
  backdropFilter: "blur(6px)",
};

const modal = {
  width: 440,
  maxWidth: "92vw",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "var(--surface)",
  borderRadius: 16,
  boxShadow: "0 20px 60px rgba(0,0,0,.15)",
  padding: "28px 24px 24px",
};

const s = {
  title: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 22,
    color: "var(--text)",
    margin: "0 0 4px",
  },
  subtitle: { fontSize: 12, color: "var(--muted)", marginBottom: 20 },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface2)",
    color: "var(--text)",
    fontSize: 14,
    outline: "none",
  },
  fieldGroup: { marginBottom: 16 },
  feeLive: {
    fontSize: 13,
    color: "var(--text2)",
    marginTop: 8,
    padding: "10px 14px",
    borderRadius: 10,
    background: "var(--accent-dim)",
    border: "1px solid var(--accent-border)",
  },
  feeHighlight: { fontWeight: 700, color: "var(--accent)" },
  progressBar: { marginTop: 16 },
  progressLabel: { fontSize: 11, color: "var(--muted)", marginBottom: 4 },
  progressTrack: {
    height: 6,
    borderRadius: 99,
    background: "var(--border)",
    overflow: "hidden",
  },
  progressFill: (pct, color) => ({
    height: "100%",
    width: `${Math.min(100, Math.max(0, pct))}%`,
    borderRadius: 99,
    background: color,
    transition: "width 0.3s ease",
  }),
  daysLabel: (color) => ({
    fontSize: 11,
    fontWeight: 600,
    color,
    marginTop: 4,
  }),
  bigFee: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 36,
    color: "var(--accent)",
    textAlign: "center",
    margin: "20px 0 8px",
  },
  bigFeeSub: {
    fontSize: 12,
    color: "var(--muted)",
    textAlign: "center",
    marginBottom: 20,
  },
  payToggle: {
    display: "flex",
    borderRadius: 10,
    border: "1px solid var(--border)",
    overflow: "hidden",
    marginBottom: 16,
  },
  payOption: (active) => ({
    flex: 1,
    padding: "10px 0",
    textAlign: "center",
    fontSize: 13,
    fontWeight: 500,
    background: active ? "var(--accent-dim)" : "var(--surface)",
    color: active ? "var(--accent)" : "var(--muted)",
    border: "none",
    cursor: "pointer",
    borderRight: "1px solid var(--border)",
  }),
  checkRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 16,
    fontSize: 12,
    color: "var(--text2)",
    lineHeight: 1.5,
  },
  checkbox: {
    width: 16,
    height: 16,
    marginTop: 2,
    accentColor: "var(--accent)",
    flexShrink: 0,
  },
  btnRow: { display: "flex", gap: 8, marginTop: 20 },
  btnGhost: {
    flex: 1,
    padding: "11px 0",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--muted)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  btnPrimary: (disabled) => ({
    flex: 1,
    padding: "11px 0",
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.35 : 1,
  }),
  successRing: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "var(--green-dim)",
    border: "2px solid var(--green-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
  },
  successTitle: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 24,
    color: "var(--text)",
    textAlign: "center",
    margin: "0 0 8px",
  },
  successSub: {
    fontSize: 13,
    color: "var(--muted)",
    textAlign: "center",
  },
  error: { fontSize: 12, color: "var(--red)", marginTop: 8, textAlign: "center" },
};

// ── Helpers ─────────────────────────────────────────────────

function daysRemaining(unlockDate) {
  if (!unlockDate) return 90;
  const unlocked = new Date(unlockDate);
  const deadline = new Date(unlocked.getTime() + 90 * 86400000);
  const now = new Date();
  return Math.max(0, Math.ceil((deadline - now) / 86400000));
}

function windowColor(days) {
  if (days > 30) return "var(--green)";
  if (days >= 10) return "var(--amber)";
  return "var(--red)";
}

function fmtCurrency(n) {
  return "$" + n.toLocaleString();
}

// ── Component ───────────────────────────────────────────────

export default function HireConfirmationModal({
  isOpen,
  candidate,
  unlockId,
  unlockDate,
  onSuccess,
  onCancel,
}) {
  const [step, setStep] = useState(1);
  const [hireDate, setHireDate] = useState("");
  const [salary, setSalary] = useState("");
  const [payMethod, setPayMethod] = useState("stripe");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const c = candidate || {};
  const feePct = c.fee_percentage || 8;
  const salaryNum = parseInt(salary, 10) || 0;
  const feeAmount = salaryNum ? Math.round(salaryNum * feePct / 100) : 0;
  const days = daysRemaining(unlockDate);
  const dayColor = windowColor(days);
  const dayPct = ((90 - days) / 90) * 100;

  const handleConfirmStep1 = useCallback(() => {
    if (!hireDate || !salaryNum) return;
    setStep(2);
  }, [hireDate, salaryNum]);

  const handleSubmit = useCallback(async () => {
    if (!termsAgreed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${c.id}/confirm-hire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unlock_id: unlockId,
          hired_at: hireDate,
          annual_salary: salaryNum,
          fee_percentage: feePct,
          fee_amount: feeAmount,
          payment_method: payMethod,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setStep(3);
      onSuccess?.();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [termsAgreed, submitting, c.id, unlockId, hireDate, salaryNum, feePct, feeAmount, payMethod, onSuccess]);

  if (!isOpen) return null;

  return (
    <div style={backdrop} onClick={onCancel}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>

        {/* ── Step 1: Hire details ──────────────────────── */}
        {step === 1 && (
          <>
            <h2 style={s.title}>Confirm hire</h2>
            <p style={s.subtitle}>
              Confirming hire for{" "}
              <strong>{c.role_applied_for}</strong>
            </p>

            <div style={s.fieldGroup}>
              <label style={s.label}>Hire date</label>
              <input
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                style={s.input}
              />
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Annual salary ($)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 160000"
                value={salary}
                onChange={(e) => setSalary(e.target.value.replace(/[^0-9]/g, ""))}
                style={s.input}
              />
            </div>

            {/* Dynamic fee display */}
            <div style={s.feeLive}>
              {salaryNum > 0 ? (
                <span>
                  Your placement fee:{" "}
                  <span style={s.feeHighlight}>
                    {feePct}% of {fmtCurrency(salaryNum)} = {fmtCurrency(feeAmount)}
                  </span>
                </span>
              ) : (
                <span>
                  Your placement fee:{" "}
                  <span style={s.feeHighlight}>{feePct}%</span> of annual salary
                </span>
              )}
            </div>

            {/* 90-day window */}
            <div style={s.progressBar}>
              <div style={s.progressLabel}>90-day confirmation window</div>
              <div style={s.progressTrack}>
                <div style={s.progressFill(dayPct, dayColor)} />
              </div>
              <div style={s.daysLabel(dayColor)}>
                {days} day{days !== 1 ? "s" : ""} remaining
              </div>
            </div>

            <div style={s.btnRow}>
              <button type="button" style={s.btnGhost} onClick={onCancel}>
                Cancel
              </button>
              <button
                type="button"
                style={s.btnPrimary(!hireDate || !salaryNum)}
                disabled={!hireDate || !salaryNum}
                onClick={handleConfirmStep1}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Fee confirmation ─────────────────── */}
        {step === 2 && (
          <>
            <h2 style={s.title}>Confirm payment</h2>
            <p style={s.subtitle}>Review and confirm placement fee</p>

            <div style={s.bigFee}>{fmtCurrency(feeAmount)}</div>
            <div style={s.bigFeeSub}>
              {feePct}% of {fmtCurrency(salaryNum)}
            </div>

            {/* Payment method toggle */}
            <div style={s.payToggle}>
              <button
                type="button"
                style={s.payOption(payMethod === "stripe")}
                onClick={() => setPayMethod("stripe")}
              >
                Pay with card
              </button>
              <button
                type="button"
                style={{ ...s.payOption(payMethod === "invoice"), borderRight: "none" }}
                onClick={() => setPayMethod("invoice")}
              >
                Invoice me
              </button>
            </div>

            {payMethod === "stripe" && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--surface2)",
                  marginBottom: 16,
                  fontSize: 12,
                  color: "var(--muted)",
                  textAlign: "center",
                }}
              >
                Stripe payment element placeholder
              </div>
            )}

            {payMethod === "invoice" && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--surface2)",
                  marginBottom: 16,
                  fontSize: 12,
                  color: "var(--text2)",
                }}
              >
                An invoice for {fmtCurrency(feeAmount)} will be sent to your
                company&apos;s billing email. Payment due within 14 days.
              </div>
            )}

            <label style={s.checkRow}>
              <input
                type="checkbox"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                style={s.checkbox}
              />
              <span>
                I confirm this hire and agree to the placement fee terms.
              </span>
            </label>

            {error && <p style={s.error}>{error}</p>}

            <div style={s.btnRow}>
              <button
                type="button"
                style={s.btnGhost}
                onClick={() => { setStep(1); setTermsAgreed(false); }}
              >
                Back
              </button>
              <button
                type="button"
                style={s.btnPrimary(!termsAgreed || submitting)}
                disabled={!termsAgreed || submitting}
                onClick={handleSubmit}
              >
                {submitting ? "Processing…" : "Confirm & pay"}
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Success ──────────────────────────── */}
        {step === 3 && (
          <>
            <div style={s.successRing}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 style={s.successTitle}>Placement confirmed</h2>
            <p style={s.successSub}>
              The referring company has been notified. Your invoice will be
              available in your dashboard.
            </p>
            <div style={{ ...s.btnRow, justifyContent: "center" }}>
              <button type="button" style={s.btnPrimary(false)} onClick={onCancel}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
