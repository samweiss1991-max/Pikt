/**
 * StagePill — colour-coded pipeline stage badge.
 * Used in "My candidates" table rows.
 *
 * Props:
 *   stage: string (pipeline_stage enum value)
 */

const STAGE_STYLES = {
  unlocked:            { bg: "var(--accent-dim)",  border: "var(--accent-border)", text: "var(--accent)",  label: "Unlocked" },
  contacted:           { bg: "var(--blue-dim)",    border: "var(--blue-border)",   text: "var(--blue)",    label: "Contacted" },
  interview_scheduled: { bg: "var(--blue-dim)",    border: "var(--blue-border)",   text: "var(--blue)",    label: "Interview scheduled" },
  interviewing:        { bg: "var(--accent-dim)",  border: "var(--accent-border)", text: "var(--accent)",  label: "Interviewing" },
  offer_made:          { bg: "var(--green-dim)",   border: "var(--green-border)",  text: "var(--green)",   label: "Offer made" },
  hired:               { bg: "var(--green-dim)",   border: "var(--green-border)",  text: "var(--green)",   label: "Hired" },
  passed:              { bg: "var(--amber-dim)",   border: "var(--amber-border)",  text: "var(--amber)",   label: "Passed" },
};

export default function StagePill({ stage }) {
  const s = STAGE_STYLES[stage] || STAGE_STYLES.unlocked;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}
