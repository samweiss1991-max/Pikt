/**
 * 90-day window progress indicator.
 * Shown on unlocked profiles in "My candidates" view.
 *
 * Props:
 *   unlockDate: string (ISO) — date the candidate was unlocked
 */

export default function NinetyDayIndicator({ unlockDate }) {
  if (!unlockDate) return null;

  const unlocked = new Date(unlockDate);
  const deadline = new Date(unlocked.getTime() + 90 * 86400000);
  const now = new Date();
  const days = Math.max(0, Math.ceil((deadline - now) / 86400000));
  const elapsed = 90 - days;
  const pct = (elapsed / 90) * 100;

  let color = "var(--green)";
  let bgColor = "var(--green-dim)";
  if (days < 10) {
    color = "var(--red)";
    bgColor = "var(--red-dim)";
  } else if (days <= 30) {
    color = "var(--amber)";
    bgColor = "var(--amber-dim)";
  }

  return (
    <div style={{ marginTop: 6 }} title="Confirm a hire within 90 days of unlocking">
      <div
        style={{
          height: 4,
          borderRadius: 99,
          background: "var(--border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(100, pct)}%`,
            borderRadius: 99,
            background: color,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 3,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 600, color }}>
          {days} day{days !== 1 ? "s" : ""} remaining
        </span>
        <span style={{ fontSize: 10, color: "var(--muted)" }}>
          Confirm hire
        </span>
      </div>
    </div>
  );
}
