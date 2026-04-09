/**
 * MarketplaceFilters — availability filter with "Show all" toggle.
 *
 * Default view: available + interviewing_elsewhere only.
 * "Show all" includes placed, withdrawn, unconfirmed.
 *
 * Props:
 *   showAll: boolean
 *   onToggleShowAll: () => void
 *   candidateCount: number
 *   totalCount: number
 */

const s = {
  bar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 0",
    fontSize: 12,
    color: "var(--muted)",
  },
  toggle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    border: "none",
    background: "none",
    fontSize: 12,
    color: "var(--accent)",
    fontWeight: 500,
    padding: 0,
  },
  toggleDot: (active) => ({
    width: 14,
    height: 14,
    borderRadius: 4,
    border: `1.5px solid ${active ? "var(--accent)" : "var(--border2)"}`,
    background: active ? "var(--accent)" : "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  }),
  check: {
    width: 8,
    height: 8,
    color: "#fff",
  },
};

export default function MarketplaceFilters({
  showAll,
  onToggleShowAll,
  candidateCount,
  totalCount,
}) {
  return (
    <div style={s.bar}>
      <span>
        Showing <strong style={{ color: "var(--text)" }}>{candidateCount}</strong>
        {!showAll && totalCount > candidateCount && (
          <> of {totalCount} candidates</>
        )}
        {showAll && <> candidates (all statuses)</>}
      </span>
      <button type="button" style={s.toggle} onClick={onToggleShowAll}>
        <span style={s.toggleDot(showAll)}>
          {showAll && (
            <svg style={s.check} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </span>
        Show all statuses
      </button>
    </div>
  );
}
