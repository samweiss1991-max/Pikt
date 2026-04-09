import { useCallback, useEffect, useState } from "react";

/**
 * UploadExamplePanel — first-time upload experience.
 * Collapsible "What makes a high-performing listing?" panel.
 * Shows annotated example listing.
 * Shown when company has 0 submissions.
 * Accessible via "?" icon next to form title.
 *
 * Props:
 *   isFirstUpload: boolean
 *   showHelpIcon: boolean — always show the "?" trigger
 */

const s = {
  wrapper: {
    marginBottom: 16,
  },
  helpIcon: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--muted)",
    fontSize: 12,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    marginLeft: 6,
    verticalAlign: "middle",
  },
  panel: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    overflow: "hidden",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    cursor: "pointer",
    userSelect: "none",
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
  },
  panelToggle: {
    fontSize: 14,
    color: "var(--muted)",
  },
  panelBody: {
    padding: "0 20px 20px",
  },
  intro: {
    fontSize: 12,
    color: "var(--muted)",
    lineHeight: 1.6,
    marginBottom: 16,
  },

  // Example card
  exampleCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: 16,
  },
  exampleLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--muted)",
    marginBottom: 12,
  },
  exampleField: {
    marginBottom: 14,
  },
  fieldContent: {
    fontSize: 13,
    color: "var(--text)",
    lineHeight: 1.5,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: "var(--text2)",
    marginBottom: 4,
  },

  // Annotation chip
  annotation: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 10px",
    borderRadius: 99,
    fontSize: 10,
    fontWeight: 500,
    background: "var(--green-dim)",
    border: "1px solid var(--green-border)",
    color: "var(--green)",
    marginTop: 4,
  },
  annotationIcon: {
    fontSize: 11,
  },

  // Divider
  divider: {
    height: 1,
    background: "var(--border)",
    margin: "12px 0",
  },

  // Tags
  tagRow: {
    display: "flex",
    gap: 4,
    flexWrap: "wrap",
    marginTop: 4,
  },
  tag: {
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 10,
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    color: "var(--text2)",
  },

  // Fee display
  feeRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  feeValue: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 20,
    color: "var(--accent)",
  },
  feeSub: {
    fontSize: 11,
    color: "var(--muted)",
  },

  // Interview dots
  dotRow: {
    display: "flex",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  dot: (filled) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: filled ? "var(--accent)" : "var(--border)",
  }),
  dotLabel: {
    fontSize: 11,
    color: "var(--muted)",
    marginLeft: 6,
  },
};

export default function UploadExamplePanel({ isFirstUpload, showHelpIcon }) {
  const [expanded, setExpanded] = useState(false);
  const [autoExpand, setAutoExpand] = useState(isFirstUpload);

  // Auto-expand for first-time uploaders
  useEffect(() => {
    if (isFirstUpload && autoExpand) {
      setExpanded(true);
      setAutoExpand(false);
    }
  }, [isFirstUpload, autoExpand]);

  const handleToggle = useCallback(() => {
    const newState = !expanded;
    setExpanded(newState);

    // Mark as seen on first expand
    if (newState) {
      fetch("/api/onboarding/seen-example", { method: "POST" }).catch(() => {});
    }
  }, [expanded]);

  // Help icon trigger (always available)
  if (!isFirstUpload && showHelpIcon && !expanded) {
    return (
      <button type="button" style={s.helpIcon} onClick={handleToggle} title="What makes a high-performing listing?">
        ?
      </button>
    );
  }

  if (!isFirstUpload && !expanded) return null;

  return (
    <div style={s.wrapper}>
      <div style={s.panel}>
        <div style={s.panelHeader} onClick={handleToggle}>
          <span style={s.panelTitle}>What makes a high-performing listing?</span>
          <span style={s.panelToggle}>{expanded ? "\u25B4" : "\u25BE"}</span>
        </div>

        {expanded && (
          <div style={s.panelBody}>
            <div style={s.intro}>
              Listings with strong data get unlocked faster. Here's an annotated example
              of what top-performing referrals look like on pickt.
            </div>

            <div style={s.exampleCard}>
              <div style={s.exampleLabel}>Example listing</div>

              {/* Work achievement */}
              <div style={s.exampleField}>
                <div style={s.fieldLabel}>Work achievement</div>
                <div style={s.fieldContent}>
                  "Led migration of 2.4M user accounts from legacy monolith to
                  microservices architecture, reducing p99 latency by 68% and
                  saving $340k/year in infrastructure costs."
                </div>
                <div style={s.annotation}>
                  <span style={s.annotationIcon}>&#10003;</span>
                  Specific metric builds confidence
                </div>
              </div>

              <div style={s.divider} />

              {/* Skill cluster */}
              <div style={s.exampleField}>
                <div style={s.fieldLabel}>Skill cluster</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text2)", marginBottom: 4 }}>
                  Cloud Infrastructure
                </div>
                <div style={s.tagRow}>
                  <span style={s.tag}>AWS</span>
                  <span style={s.tag}>Terraform</span>
                  <span style={s.tag}>Kubernetes</span>
                </div>
                <div style={s.annotation}>
                  <span style={s.annotationIcon}>&#10003;</span>
                  Clusters not just tech lists
                </div>
              </div>

              <div style={s.divider} />

              {/* Fee */}
              <div style={s.exampleField}>
                <div style={s.fieldLabel}>Placement fee</div>
                <div style={s.feeRow}>
                  <span style={s.feeValue}>8%</span>
                  <span style={s.feeSub}>of first-year salary</span>
                </div>
                <div style={s.annotation}>
                  <span style={s.annotationIcon}>&#10003;</span>
                  8% sits in highest-converting band
                </div>
              </div>

              <div style={s.divider} />

              {/* Interviews */}
              <div style={s.exampleField}>
                <div style={s.fieldLabel}>Interview count</div>
                <div style={s.dotRow}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={s.dot(i < 4)} />
                  ))}
                  <span style={s.dotLabel}>4 interviews</span>
                </div>
                <div style={s.annotation}>
                  <span style={s.annotationIcon}>&#10003;</span>
                  4+ signals a well-assessed candidate
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
