import { useCallback, useEffect, useRef, useState } from "react";

/**
 * UnlockModal — fires from locked profile page or shortlist page.
 *
 * Props:
 *   isOpen: boolean
 *   candidate: object from CANDIDATE_PUBLIC
 *     { id, fee_percentage, interview_count, salary_band_low, salary_band_high,
 *       uploaded_by_company_id }
 *   referringCompany: { name, rep_score } | null
 *   onSuccess: (unlockId: string) => void
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
  WebkitBackdropFilter: "blur(6px)",
};

const modal = {
  width: 400,
  maxWidth: "92vw",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "var(--surface)",
  borderRadius: 16,
  boxShadow: "0 20px 60px rgba(0,0,0,.15)",
  padding: "28px 24px 24px",
};

// Mobile bottom sheet override (applied via media query in component)
const mobileSheet = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  width: "100%",
  maxWidth: "100%",
  borderRadius: "20px 20px 0 0",
  maxHeight: "85vh",
};

const dragHandle = {
  width: 36,
  height: 4,
  borderRadius: 99,
  background: "var(--border2)",
  margin: "0 auto 16px",
};

const lockRing = {
  width: 52,
  height: 52,
  borderRadius: "50%",
  background: "var(--accent-dim)",
  border: "1.5px solid var(--accent-border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto",
};

const title = {
  fontFamily: "'Instrument Serif', serif",
  fontSize: 21,
  color: "var(--text)",
  textAlign: "center",
  margin: "16px 0 0",
};

const subtitle = {
  fontSize: 11,
  color: "var(--muted)",
  textAlign: "center",
  lineHeight: 1.65,
  margin: "8px 0 0",
};

const feeBox = {
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  marginTop: 20,
  overflow: "hidden",
};

const feeRow = (isFirst) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "9px 16px",
  fontSize: 12,
  borderTop: isFirst ? "none" : "1px solid var(--border)",
});

const feeLabel = { color: "var(--muted)" };
const feeValueAccent = { fontWeight: 600, color: "var(--accent)" };
const feeValueAmber = { fontWeight: 600, color: "var(--amber)" };
const feeValueDefault = { color: "var(--text)" };

const savingsBar = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 14px",
  borderRadius: 10,
  background: "rgba(45,125,70,.08)",
  border: "1px solid rgba(45,125,70,.2)",
  marginTop: 12,
  fontSize: 12,
};

const savingsLeft = { color: "var(--muted)" };
const savingsRight = { fontWeight: 700, color: "var(--green)" };

// Fee calculator
const calcSection = {
  marginTop: 14,
  borderRadius: 10,
  border: "1px solid var(--border)",
  overflow: "hidden",
};

const calcHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 14px",
  background: "var(--surface2)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--text2)",
  userSelect: "none",
};

const calcTag = (isCustom) => ({
  fontSize: 10,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 99,
  background: isCustom ? "var(--accent-dim)" : "var(--amber-dim)",
  border: `1px solid ${isCustom ? "var(--accent-border)" : "var(--amber-border)"}`,
  color: isCustom ? "var(--accent)" : "var(--amber)",
});

const calcBody = { padding: "12px 14px" };

const calcInput = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface3, #e8edde)",
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
  marginBottom: 10,
};

const calcRow = {
  display: "flex",
  justifyContent: "space-between",
  padding: "4px 0",
  fontSize: 12,
};

const resetBtn = {
  border: "none",
  background: "none",
  fontSize: 11,
  color: "var(--accent)",
  cursor: "pointer",
  padding: 0,
  marginTop: 4,
};

// Checkbox
const checkboxRow = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  marginTop: 18,
  fontSize: 12,
  color: "var(--text2)",
  lineHeight: 1.5,
};

const checkbox = {
  width: 16,
  height: 16,
  marginTop: 2,
  accentColor: "var(--accent)",
  flexShrink: 0,
  cursor: "pointer",
};

// Buttons
const btnRow = {
  display: "flex",
  gap: 8,
  marginTop: 20,
};

const btnCancel = {
  flex: 1,
  padding: "11px 0",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

const btnConfirm = (disabled) => ({
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
  transition: "opacity 0.15s ease",
});

const errorText = {
  fontSize: 12,
  color: "var(--red)",
  marginTop: 10,
  textAlign: "center",
};

// ── Helpers ─────────────────────────────────────────────────

function fmtK(v) {
  return `$${Math.round(v / 1000)}k`;
}

function calcAgencyFee(salary) {
  return Math.round(salary * 0.22);
}

function calcSaving(salary, feePct) {
  return Math.round(salary * (0.22 - feePct / 100));
}

// ── Component ───────────────────────────────────────────────

export default function UnlockModal({
  isOpen,
  candidate,
  referringCompany,
  onSuccess,
  onCancel,
}) {
  const [agreed, setAgreed] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState(null);
  const [calcOpen, setCalcOpen] = useState(false);
  const [salaryOverride, setSalaryOverride] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const inputRef = useRef(null);

  // Detect mobile
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 640); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAgreed(false);
      setError(null);
      setSalaryOverride("");
      setCalcOpen(false);
    }
  }, [isOpen]);

  const c = candidate || {};
  const feePct = c.fee_percentage || 8;
  const bandLow = c.salary_band_low || 0;
  const bandHigh = c.salary_band_high || 0;
  const hasBand = bandLow > 0 || bandHigh > 0;
  const overrideValue = parseInt(salaryOverride, 10);
  const isCustomMode = salaryOverride.trim() !== "" && !isNaN(overrideValue) && overrideValue > 0;

  // Savings for the savings bar (always from band)
  const savLow = bandLow ? calcSaving(bandLow, feePct) : 0;
  const savHigh = bandHigh ? calcSaving(bandHigh, feePct) : 0;
  const hasSavings = savLow > 0 || savHigh > 0;

  // Calculator values
  const calcSalaryLow = isCustomMode ? overrideValue : bandLow;
  const calcSalaryHigh = isCustomMode ? overrideValue : bandHigh;
  const calcAgencyLow = calcSalaryLow ? calcAgencyFee(calcSalaryLow) : 0;
  const calcAgencyHigh = calcSalaryHigh ? calcAgencyFee(calcSalaryHigh) : 0;
  const calcSavingLow = calcSalaryLow ? calcSaving(calcSalaryLow, feePct) : 0;
  const calcSavingHigh = calcSalaryHigh ? calcSaving(calcSalaryHigh, feePct) : 0;

  const handleConfirm = useCallback(async () => {
    if (!agreed || unlocking) return;
    setUnlocking(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${c.id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unlock failed");
      onSuccess?.(json.unlock_id);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setUnlocking(false);
    }
  }, [agreed, unlocking, c.id, onSuccess]);

  if (!isOpen) return null;

  const salaryDisplay =
    bandLow && bandHigh
      ? `${fmtK(bandLow)} – ${fmtK(bandHigh)}`
      : bandLow
        ? `${fmtK(bandLow)}+`
        : bandHigh
          ? `Up to ${fmtK(bandHigh)}`
          : "Not specified";

  const refDisplay = referringCompany
    ? `${referringCompany.name} · ${referringCompany.rep_score} ★`
    : "…";

  const modalStyle = isMobile ? { ...modal, ...mobileSheet } : modal;

  return (
    <div
      style={backdrop}
      onClick={onCancel}
    >
      <div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        {isMobile && <div style={dragHandle} />}

        {/* 1. Lock icon ring */}
        <div style={lockRing}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* 2. Title */}
        <h2 style={title}>
          Unlock{" "}
          <span style={{ fontStyle: "italic", color: "var(--accent)" }}>
            profile
          </span>
        </h2>

        {/* 3. Subtitle */}
        <p style={subtitle}>
          You&apos;re about to unlock full access to this candidate — including
          name, email, LinkedIn, and employer history.
        </p>

        {/* 4. Fee details box */}
        <div style={feeBox}>
          <div style={feeRow(true)}>
            <span style={feeLabel}>Placement fee</span>
            <span style={feeValueAccent}>{feePct}% of first-year salary</span>
          </div>
          <div style={feeRow(false)}>
            <span style={feeLabel}>When charged</span>
            <span style={feeValueDefault}>On successful hire only</span>
          </div>
          <div style={feeRow(false)}>
            <span style={feeLabel}>Candidate&apos;s desired salary</span>
            <span style={feeValueAmber}>{salaryDisplay}</span>
          </div>
          <div style={feeRow(false)}>
            <span style={feeLabel}>Referred by</span>
            <span style={feeValueDefault}>{refDisplay}</span>
          </div>
          <div style={feeRow(false)}>
            <span style={feeLabel}>Interviews completed</span>
            <span style={feeValueDefault}>
              {c.interview_count || 0} interview
              {(c.interview_count || 0) !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* 5. Agency savings bar */}
        {hasSavings && (
          <div style={savingsBar}>
            <span style={savingsLeft}>vs. typical agency (20–25%)</span>
            <span style={savingsRight}>
              Save ~{fmtK(savLow)}
              {savHigh !== savLow ? ` – ${fmtK(savHigh)}` : ""}
            </span>
          </div>
        )}

        {/* 6. Fee calculator (collapsible) */}
        {hasBand && (
          <div style={calcSection}>
            <div
              style={calcHeader}
              onClick={() => setCalcOpen(!calcOpen)}
            >
              <span>
                Fee calculator{" "}
                <span style={calcTag(isCustomMode)}>
                  {isCustomMode ? "Custom salary" : "From candidate band"}
                </span>
              </span>
              <span style={{ fontSize: 14, color: "var(--muted)" }}>
                {calcOpen ? "▴" : "▾"}
              </span>
            </div>

            {calcOpen && (
              <div style={calcBody}>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="Override salary…"
                  value={salaryOverride}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    setSalaryOverride(v);
                  }}
                  style={calcInput}
                />

                <div style={calcRow}>
                  <span style={{ color: "var(--muted)" }}>
                    Equivalent agency fee (22%)
                  </span>
                  <span style={{ color: "var(--muted)" }}>
                    {isCustomMode
                      ? fmtK(calcAgencyLow)
                      : calcAgencyLow && calcAgencyHigh
                        ? `${fmtK(calcAgencyLow)} – ${fmtK(calcAgencyHigh)}`
                        : fmtK(calcAgencyLow || calcAgencyHigh)}
                  </span>
                </div>

                <div style={calcRow}>
                  <span style={{ color: "var(--muted)" }}>
                    Your saving vs agency
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--green)" }}>
                    {isCustomMode
                      ? fmtK(calcSavingLow)
                      : calcSavingLow && calcSavingHigh
                        ? `${fmtK(calcSavingLow)} – ${fmtK(calcSavingHigh)}`
                        : fmtK(calcSavingLow || calcSavingHigh)}
                  </span>
                </div>

                {isCustomMode && (
                  <button
                    type="button"
                    style={resetBtn}
                    onClick={() => setSalaryOverride("")}
                  >
                    &#8617; Reset
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && <p style={errorText}>{error}</p>}

        {/* 7. T&C checkbox */}
        <label style={checkboxRow}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={checkbox}
          />
          <span>
            By unlocking this profile I acknowledge that I have read and agree
            to the pickt{" "}
            <a
              href="#"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
              onClick={(e) => e.stopPropagation()}
            >
              Terms &amp; Conditions of Use and Access
            </a>
            .
          </span>
        </label>

        {/* 8. Buttons */}
        <div style={btnRow}>
          <button
            type="button"
            style={btnCancel}
            onClick={onCancel}
            disabled={unlocking}
          >
            Cancel
          </button>
          <button
            type="button"
            style={btnConfirm(!agreed || unlocking)}
            disabled={!agreed || unlocking}
            onClick={handleConfirm}
          >
            {unlocking ? "Unlocking…" : "Confirm & unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}
