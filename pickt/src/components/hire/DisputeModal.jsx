import { useCallback, useState } from "react";

/**
 * DisputeModal — triggered from "Dispute this placement" link.
 *
 * Props:
 *   isOpen: boolean
 *   unlockId: string
 *   candidateRole: string
 *   onSuccess: () => void
 *   onCancel: () => void
 */

const REASONS = [
  "Hired through different channel",
  "Candidate withdrew before offer",
  "Role was cancelled",
  "We already knew this candidate",
  "Other",
];

const MIN_NOTES = 50;

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
  iconRing: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: "var(--red-dim)",
    border: "1.5px solid var(--red-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto",
  },
  title: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 21,
    color: "var(--text)",
    textAlign: "center",
    margin: "16px 0 0",
  },
  subtitle: {
    fontSize: 12,
    color: "var(--muted)",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
  },
  fieldGroup: { marginBottom: 16 },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface2)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    appearance: "none",
    cursor: "pointer",
  },
  textarea: {
    width: "100%",
    minHeight: 100,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface2)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    resize: "vertical",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    lineHeight: 1.5,
  },
  charCount: (valid) => ({
    fontSize: 11,
    color: valid ? "var(--muted)" : "var(--red)",
    textAlign: "right",
    marginTop: 4,
  }),
  dropZone: (dragOver) => ({
    padding: 20,
    borderRadius: 10,
    border: `2px dashed ${dragOver ? "var(--accent-border)" : "var(--border)"}`,
    background: dragOver ? "var(--accent-dim)" : "var(--surface2)",
    textAlign: "center",
    color: "var(--muted)",
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.15s ease",
  }),
  fileName: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    borderRadius: 8,
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    fontSize: 12,
    color: "var(--text2)",
    marginTop: 8,
  },
  removeFile: {
    border: "none",
    background: "none",
    color: "var(--red)",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
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
  btnDanger: (disabled) => ({
    flex: 1,
    padding: "11px 0",
    borderRadius: 12,
    border: "none",
    background: "var(--red)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.35 : 1,
  }),
  error: { fontSize: 12, color: "var(--red)", marginTop: 8, textAlign: "center" },
};

// ── Component ───────────────────────────────────────────────

export default function DisputeModal({
  isOpen,
  unlockId,
  candidateRole,
  onSuccess,
  onCancel,
}) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const notesValid = notes.length >= MIN_NOTES;
  const canSubmit = reason && notesValid && !submitting;

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  }

  function handleFileInput(e) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      // Upload evidence file if provided
      let evidenceUrl = null;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload/evidence", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadJson = await uploadRes.json();
          evidenceUrl = uploadJson.url;
        }
      }

      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unlock_id: unlockId,
          reason,
          notes,
          evidence_url: evidenceUrl,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");

      onSuccess?.();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, file, unlockId, reason, notes, onSuccess]);

  if (!isOpen) return null;

  return (
    <div style={backdrop} onClick={onCancel}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        {/* Icon */}
        <div style={s.iconRing}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h2 style={s.title}>Dispute placement</h2>
        <p style={s.subtitle}>
          {candidateRole
            ? `Disputing placement fee for ${candidateRole}`
            : "Submit a dispute for review by the pickt team"}
        </p>

        {/* Reason */}
        <div style={s.fieldGroup}>
          <label style={s.label}>Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={s.select}
          >
            <option value="">Select a reason…</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div style={s.fieldGroup}>
          <label style={s.label}>Details (min {MIN_NOTES} characters)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Please describe the circumstances in detail…"
            style={s.textarea}
          />
          <div style={s.charCount(notesValid || notes.length === 0)}>
            {notes.length} / {MIN_NOTES} min
          </div>
        </div>

        {/* Evidence upload */}
        <div style={s.fieldGroup}>
          <label style={s.label}>Evidence (optional)</label>
          {!file ? (
            <div
              style={s.dropZone(dragOver)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("dispute-file-input")?.click()}
            >
              <div>Drop a file here or click to browse</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                PDF, image, or document up to 10MB
              </div>
              <input
                id="dispute-file-input"
                type="file"
                onChange={handleFileInput}
                style={{ display: "none" }}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              />
            </div>
          ) : (
            <div style={s.fileName}>
              <span>{file.name}</span>
              <button
                type="button"
                style={s.removeFile}
                onClick={() => setFile(null)}
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {error && <p style={s.error}>{error}</p>}

        {/* Buttons */}
        <div style={s.btnRow}>
          <button type="button" style={s.btnGhost} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            style={s.btnDanger(!canSubmit)}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting ? "Submitting…" : "Submit dispute"}
          </button>
        </div>
      </div>
    </div>
  );
}
