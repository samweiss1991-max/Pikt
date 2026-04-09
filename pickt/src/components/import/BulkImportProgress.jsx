import { useCallback, useEffect, useRef, useState } from "react";

/**
 * BulkImportProgress — polls job status, shows progress bar.
 *
 * Props:
 *   jobId: string
 *   onComplete: (results) => void
 */

const s = {
  wrapper: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,.04)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
  },
  status: (complete) => ({
    fontSize: 11,
    fontWeight: 500,
    color: complete ? "var(--green)" : "var(--accent)",
  }),
  track: {
    height: 8,
    borderRadius: 99,
    background: "var(--surface2)",
    overflow: "hidden",
    marginBottom: 8,
  },
  fill: (pct) => ({
    height: "100%",
    width: `${pct}%`,
    borderRadius: 99,
    background: "var(--accent)",
    transition: "width 0.3s ease",
  }),
  label: {
    fontSize: 12,
    color: "var(--muted)",
  },
  error: {
    fontSize: 11,
    color: "var(--red)",
    marginTop: 8,
  },
  resultSummary: {
    display: "flex",
    gap: 16,
    marginTop: 12,
    fontSize: 12,
  },
  resultStat: (color) => ({
    fontWeight: 600,
    color,
  }),
};

export default function BulkImportProgress({ jobId, onComplete }) {
  const [job, setJob] = useState(null);
  const intervalRef = useRef(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/ats/import-bulk/${jobId}/status`);
      if (res.ok) {
        const data = await res.json();
        setJob(data);

        if (data.status.startsWith("completed")) {
          clearInterval(intervalRef.current);
          onComplete?.(data);
        }
      }
    } catch {
      // Retry on next interval
    }
  }, [jobId, onComplete]);

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => clearInterval(intervalRef.current);
  }, [poll]);

  if (!job) {
    return (
      <div style={s.wrapper}>
        <div style={s.title}>Starting import...</div>
      </div>
    );
  }

  const isComplete = job.status.startsWith("completed");
  const pct = job.progress || 0;
  const current = job.completed + job.failed;

  return (
    <div style={s.wrapper}>
      <div style={s.header}>
        <div style={s.title}>
          {isComplete ? "Import complete" : "Importing candidates"}
        </div>
        <div style={s.status(isComplete)}>
          {isComplete ? "\u2713 Done" : `${pct}%`}
        </div>
      </div>

      <div style={s.track}>
        <div style={s.fill(pct)} />
      </div>

      <div style={s.label}>
        {isComplete
          ? `Processed ${job.total} candidates`
          : `Importing ${current} of ${job.total} candidates\u2026`}
      </div>

      {isComplete && (
        <div style={s.resultSummary}>
          <span>
            <span style={s.resultStat("var(--green)")}>{job.completed}</span> successful
          </span>
          {job.failed > 0 && (
            <span>
              <span style={s.resultStat("var(--red)")}>{job.failed}</span> failed
            </span>
          )}
        </div>
      )}

      {isComplete && job.errors?.length > 0 && (
        <div style={s.error}>
          {job.errors.map((e, i) => (
            <div key={i}>Candidate {e.index + 1}: {e.error}</div>
          ))}
        </div>
      )}
    </div>
  );
}
