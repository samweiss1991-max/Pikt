import { useCallback, useEffect, useState } from "react";

/**
 * ImportModal — 3-step ATS import flow.
 * Light theme: white modal, var(--border) dividers.
 *
 * Props:
 *   isOpen: boolean
 *   candidateIds: string[] — IDs to import (must be unlocked)
 *   candidates: array — candidate objects with name/role for display
 *   onSuccess: (result) => void
 *   onCancel: () => void
 */

// ── Styles ──────────────────────────────────────────────────

const backdrop = {
  position: "fixed", inset: 0, zIndex: 50,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "rgba(26,32,16,.55)", backdropFilter: "blur(6px)",
};

const modal = {
  width: 520, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto",
  background: "var(--surface)", borderRadius: 16,
  boxShadow: "0 20px 60px rgba(0,0,0,.15)", padding: "24px",
};

const s = {
  title: { fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "var(--text)", margin: "0 0 4px" },
  subtitle: { fontSize: 12, color: "var(--muted)", marginBottom: 20 },

  // Step indicator
  steps: { display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 24 },
  dot: (state) => ({
    width: state === "active" ? 28 : 22, height: state === "active" ? 28 : 22,
    borderRadius: "50%",
    background: state === "done" ? "var(--green)" : state === "active" ? "var(--accent)" : "transparent",
    border: state === "idle" ? "2px solid var(--border2)" : "none",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontSize: state === "done" ? 12 : 11, fontWeight: 600,
    flexShrink: 0,
  }),
  connector: (done) => ({
    width: 32, height: 2,
    background: done ? "var(--green)" : "var(--border)",
  }),

  // Candidate list
  candidateRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" },
  candidateAvatar: {
    width: 32, height: 32, borderRadius: 8,
    background: "linear-gradient(135deg, var(--accent) 0%, #5a9020 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontSize: 13, fontWeight: 600, flexShrink: 0,
  },
  candidateName: { fontSize: 13, fontWeight: 500, color: "var(--text)" },
  candidateRole: { fontSize: 11, color: "var(--muted)" },
  syncedPill: {
    marginLeft: "auto", padding: "2px 10px", borderRadius: 99, fontSize: 10, fontWeight: 600,
    background: "var(--green-dim)", border: "1px solid var(--green-border)", color: "var(--green)",
  },

  // ATS grid
  atsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 },
  atsCard: (selected, disabled) => ({
    padding: 16, borderRadius: 12, textAlign: "center", cursor: disabled ? "default" : "pointer",
    background: selected ? "var(--accent-dim)" : "var(--surface)",
    border: `1px solid ${selected ? "var(--accent-border)" : "var(--border)"}`,
    opacity: disabled ? 0.45 : 1, position: "relative",
  }),
  atsName: { fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 },
  atsStatus: (connected) => ({
    position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: "50%",
    background: connected ? "var(--green)" : "var(--border2)",
  }),
  atsDisconnected: { fontSize: 10, color: "var(--muted)", marginTop: 4 },

  // CSV card
  csvCard: {
    padding: 14, borderRadius: 12, textAlign: "center", cursor: "pointer",
    border: "1px solid var(--border)", background: "var(--surface)", marginBottom: 16,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    fontSize: 13, fontWeight: 500, color: "var(--text2)",
  },

  // Field mapping
  mappingTable: { width: "100%", borderCollapse: "collapse", marginBottom: 16 },
  mappingTh: { textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", borderBottom: "1px solid var(--border)" },
  mappingTd: { padding: "8px 10px", fontSize: 12, color: "var(--text2)", borderBottom: "1px solid var(--border)" },
  mappingCheck: { color: "var(--green)", fontWeight: 600 },

  // Info banner
  infoBanner: {
    display: "flex", gap: 8, padding: "10px 14px", borderRadius: 10,
    background: "var(--blue-dim)", border: "1px solid var(--blue-border)",
    fontSize: 12, color: "var(--blue)", marginBottom: 16, lineHeight: 1.5,
  },

  // Buttons
  btnRow: { display: "flex", gap: 8, marginTop: 20 },
  btnGhost: { flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 13, fontWeight: 500, cursor: "pointer" },
  btnPrimary: (disabled) => ({ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1 }),

  // Success
  successRing: { width: 56, height: 56, borderRadius: "50%", background: "var(--green-dim)", border: "2px solid var(--green-border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" },
  successTitle: { fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "var(--text)", textAlign: "center", margin: "0 0 8px" },
  successSub: { fontSize: 12, color: "var(--muted)", textAlign: "center", lineHeight: 1.5, marginBottom: 8 },
  successNote: { fontSize: 11, color: "var(--muted)", textAlign: "center", fontStyle: "italic", marginBottom: 16 },

  jobSelect: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: 13, outline: "none", marginBottom: 16 },

  error: { fontSize: 12, color: "var(--red)", marginTop: 8, textAlign: "center" },
};

const FIELD_MAPPINGS = [
  ["Full name", "Candidate name", true],
  ["Email", "Email", true],
  ["Phone", "Phone", true],
  ["LinkedIn URL", "Social media", true],
  ["Current role", "Current title", true],
  ["Skills", "Tags", true],
  ["Interview history", "Candidate note", true],
  ["pickt profile ID", "External ID", true],
];

const ATS_PROVIDERS = [
  { id: "greenhouse", name: "Greenhouse" },
  { id: "lever", name: "Lever" },
  { id: "workday", name: "Workday" },
];

// ── Component ───────────────────────────────────────────────

export default function ImportModal({
  isOpen, candidateIds, candidates, onSuccess, onCancel,
}) {
  const [step, setStep] = useState(1);
  const [selectedAts, setSelectedAts] = useState(null);
  const [connectedProviders, setConnectedProviders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Fetch connected ATS
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setSelectedAts(null);
    setResult(null);
    setError(null);

    fetch("/api/settings/integrations")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          const connected = (d.integrations || [])
            .filter((i) => i.connected)
            .map((i) => i.provider);
          setConnectedProviders(connected);
          if (connected.length === 1) setSelectedAts(connected[0]);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Fetch jobs when ATS selected
  useEffect(() => {
    if (!selectedAts) return;
    fetch(`/api/ats/jobs?provider=${selectedAts}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setJobs(d.jobs || []); })
      .catch(() => {});
  }, [selectedAts]);

  const alreadySynced = (candidates || []).filter((c) => c.ats_synced);
  const toImport = (candidates || []).filter((c) => !c.ats_synced);

  async function handleCsvExport() {
    const ids = candidateIds.join(",");
    window.open(`/api/ats/import-csv?ids=${ids}`, "_blank");
  }

  const handleImport = useCallback(async () => {
    if (importing) return;
    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/ats/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ats_provider: selectedAts,
          job_id: selectedJob || null,
          candidate_ids: toImport.map((c) => c.id || c.candidate_id),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setResult(json);
      setStep(4); // success
      onSuccess?.(json);
    } catch (e) {
      setError(e.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }, [importing, selectedAts, selectedJob, toImport, onSuccess]);

  if (!isOpen) return null;

  function stepState(n) {
    if (step > n) return "done";
    if (step === n) return "active";
    return "idle";
  }

  return (
    <div style={backdrop} onClick={onCancel}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>

        {/* Step indicator */}
        {step <= 3 && (
          <div style={s.steps}>
            {[1, 2, 3].map((n, i) => (
              <div key={n} style={{ display: "flex", alignItems: "center" }}>
                <div style={s.dot(stepState(n))}>
                  {stepState(n) === "done" ? "\u2713" : n}
                </div>
                {i < 2 && <div style={s.connector(step > n)} />}
              </div>
            ))}
          </div>
        )}

        {/* ── STEP 1: Destination ─────────────────────────── */}
        {step === 1 && (
          <>
            <h2 style={s.title}>Import to ATS</h2>
            <p style={s.subtitle}>{candidateIds.length} candidate{candidateIds.length !== 1 ? "s" : ""} selected</p>

            {/* Candidate list */}
            {(candidates || []).slice(0, 5).map((c) => (
              <div key={c.id || c.candidate_id} style={s.candidateRow}>
                <div style={s.candidateAvatar}>{(c.name || c.role_applied_for || "?")[0]}</div>
                <div>
                  <div style={s.candidateName}>{c.name || c.role_applied_for}</div>
                  <div style={s.candidateRole}>{c.role_applied_for}</div>
                </div>
                {c.ats_synced && <span style={s.syncedPill}>Already synced</span>}
              </div>
            ))}
            {(candidates || []).length > 5 && (
              <div style={{ fontSize: 11, color: "var(--muted)", padding: "8px 0" }}>
                +{candidates.length - 5} more
              </div>
            )}

            {/* ATS grid */}
            <div style={{ ...s.subtitle, marginTop: 16, marginBottom: 8 }}>Choose destination</div>
            <div style={s.atsGrid}>
              {ATS_PROVIDERS.map((ats) => {
                const connected = connectedProviders.includes(ats.id);
                const selected = selectedAts === ats.id;
                return (
                  <div
                    key={ats.id}
                    style={s.atsCard(selected, !connected)}
                    onClick={() => { if (connected) setSelectedAts(ats.id); }}
                  >
                    <div style={s.atsStatus(connected)} />
                    <div style={s.atsName}>{ats.name}</div>
                    {!connected && (
                      <div style={s.atsDisconnected}>
                        <a href="/settings/integrations" style={{ color: "var(--accent)", fontSize: 10 }}>Connect</a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* CSV option */}
            <div style={s.csvCard} onClick={handleCsvExport}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download CSV instead
            </div>

            <div style={s.btnRow}>
              <button type="button" style={s.btnGhost} onClick={onCancel}>Cancel</button>
              <button type="button" style={s.btnPrimary(!selectedAts)} disabled={!selectedAts}
                onClick={() => setStep(2)}>Continue</button>
            </div>
          </>
        )}

        {/* ── STEP 2: Field mapping ──────────────────────── */}
        {step === 2 && (
          <>
            <h2 style={s.title}>Map fields</h2>
            <p style={s.subtitle}>Pushing to {selectedAts}</p>

            <div style={{ ...s.subtitle, marginBottom: 8 }}>Assign to job</div>
            <select value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)} style={s.jobSelect}>
              <option value="">No specific job</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title} — {j.department}</option>
              ))}
            </select>

            <table style={s.mappingTable}>
              <thead>
                <tr>
                  <th style={s.mappingTh}>pickt field</th>
                  <th style={s.mappingTh}>{selectedAts} field</th>
                  <th style={s.mappingTh}></th>
                </tr>
              </thead>
              <tbody>
                {FIELD_MAPPINGS.map(([from, to, mapped]) => (
                  <tr key={from}>
                    <td style={s.mappingTd}>{from}</td>
                    <td style={s.mappingTd}>{to}</td>
                    <td style={{ ...s.mappingTd, ...s.mappingCheck }}>{mapped ? "\u2713" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {alreadySynced.length > 0 && (
              <div style={s.infoBanner}>
                <span>&#8505;&#65039;</span>
                <span>
                  {alreadySynced.map((c) => c.name || c.role_applied_for).join(" and ")}{" "}
                  {alreadySynced.length === 1 ? "is" : "are"} already in {selectedAts} and will be skipped to avoid duplicates.
                </span>
              </div>
            )}

            <div style={s.btnRow}>
              <button type="button" style={s.btnGhost} onClick={() => setStep(1)}>Back</button>
              <button type="button" style={s.btnPrimary(false)} onClick={() => setStep(3)}>Continue</button>
            </div>
          </>
        )}

        {/* ── STEP 3: Confirm ────────────────────────────── */}
        {step === 3 && (
          <>
            <h2 style={s.title}>Confirm import</h2>
            <p style={s.subtitle}>
              Destination: <strong>{selectedAts}</strong>
              {selectedJob && <> · Job: {jobs.find((j) => j.id === selectedJob)?.title}</>}
            </p>

            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>
              <strong>{toImport.length}</strong> new candidate{toImport.length !== 1 ? "s" : ""} to push
              {alreadySynced.length > 0 && (
                <span style={{ color: "var(--muted)" }}> · {alreadySynced.length} skipped (already synced)</span>
              )}
            </div>

            {toImport.map((c) => (
              <div key={c.id || c.candidate_id} style={s.candidateRow}>
                <div style={s.candidateAvatar}>{(c.name || c.role_applied_for || "?")[0]}</div>
                <div>
                  <div style={s.candidateName}>{c.name || c.role_applied_for}</div>
                  <div style={s.candidateRole}>{c.role_applied_for}</div>
                </div>
              </div>
            ))}

            {error && <p style={s.error}>{error}</p>}

            <div style={s.btnRow}>
              <button type="button" style={s.btnGhost} onClick={() => setStep(2)}>Back</button>
              <button type="button" style={s.btnPrimary(importing)} disabled={importing}
                onClick={handleImport}>
                {importing ? "Pushing\u2026" : `Push to ${selectedAts}`}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 4: Success ────────────────────────────── */}
        {step === 4 && result && (
          <>
            <div style={s.successRing}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 style={s.successTitle}>Import complete</h2>
            <p style={s.successSub}>
              {result.imported} candidate{result.imported !== 1 ? "s" : ""} pushed to {selectedAts}
              {result.skipped > 0 && `, ${result.skipped} skipped`}
            </p>
            <p style={s.successNote}>
              pickt profile IDs stored as External IDs in {selectedAts} for source tracking.
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
