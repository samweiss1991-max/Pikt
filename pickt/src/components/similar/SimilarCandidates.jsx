import { useCallback, useEffect, useState } from "react";

/**
 * SimilarCandidates — shared component used on both locked and
 * unlocked profiles. Fetches similar candidates and renders
 * mini-tiles with audit logging.
 *
 * Props:
 *   candidateId: string
 *   layout: 'horizontal' | 'sidebar' — determines card arrangement
 *   showContextLine: boolean — show "3 similar..." text above
 */

const s = {
  // Context line
  contextLine: {
    fontSize: 11,
    color: "var(--muted)",
    marginBottom: 12,
  },
  contextLink: {
    color: "var(--accent)",
    textDecoration: "none",
    fontWeight: 500,
  },

  // Section header
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "var(--muted)",
    whiteSpace: "nowrap",
  },
  sectionLine: {
    flex: 1,
    height: 1,
    background: "var(--border)",
  },

  // Horizontal row
  horizontalRow: {
    display: "flex",
    gap: 12,
    overflowX: "auto",
    paddingBottom: 4,
  },

  // Sidebar column
  sidebarCol: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  // Mini tile
  tile: {
    width: 180,
    minWidth: 180,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 14,
    cursor: "pointer",
    transition: "all 0.15s ease",
    flexShrink: 0,
  },
  tileSidebar: {
    width: "100%",
    minWidth: 0,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 14,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  tileRole: {
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text)",
    lineHeight: 1.3,
    marginBottom: 4,
  },
  tileMeta: {
    fontSize: 11,
    color: "var(--muted)",
    marginBottom: 8,
  },
  tileFee: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 16,
    color: "var(--accent)",
    marginBottom: 6,
  },
  tagRow: {
    display: "flex",
    gap: 4,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  tag: {
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 10,
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    color: "var(--text2)",
  },
  viewBtn: {
    fontSize: 11,
    fontWeight: 500,
    color: "var(--accent)",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },

  // Browse link
  browseLink: {
    display: "block",
    marginTop: 12,
    fontSize: 12,
    fontWeight: 500,
    color: "var(--accent)",
    textDecoration: "none",
  },

  empty: {
    fontSize: 11,
    color: "var(--muted)",
    padding: "12px 0",
  },
};

export default function SimilarCandidates({
  candidateId,
  layout = "horizontal",
  showContextLine = false,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSimilar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/similar`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchSimilar();
  }, [fetchSimilar]);

  function handleClick(clickedId, position) {
    // Log to audit
    fetch("/api/audit/similar-clicked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_candidate_id: candidateId,
        clicked_candidate_id: clickedId,
        position,
      }),
    }).catch(() => {});

    window.location.href = `/candidates/${clickedId}`;
  }

  if (loading) return null;
  if (!data || data.candidates.length === 0) return null;

  const isSidebar = layout === "sidebar";

  return (
    <div>
      {/* Context line */}
      {showContextLine && data.context_line && (
        <div style={s.contextLine}>
          &#8599;{" "}
          <a
            href={`/marketplace?seniority=${encodeURIComponent(data.source_seniority)}`}
            style={s.contextLink}
          >
            {data.context_line}
          </a>
        </div>
      )}

      {/* Section header */}
      <div style={s.sectionHeader}>
        <span style={s.sectionLabel}>You might also like</span>
        <div style={s.sectionLine} />
      </div>

      {/* Tiles */}
      <div style={isSidebar ? s.sidebarCol : s.horizontalRow}>
        {data.candidates.map((c, i) => (
          <div
            key={c.id}
            style={isSidebar ? s.tileSidebar : s.tile}
            onClick={() => handleClick(c.id, i + 1)}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = "var(--accent-border)";
              e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,.06)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={s.tileRole}>{c.role_applied_for}</div>
            <div style={s.tileMeta}>{c.location_city}</div>
            <div style={s.tileFee}>{c.fee_percentage || 8}%</div>
            {c.skills && c.skills.length > 0 && (
              <div style={s.tagRow}>
                {c.skills.map((sk, j) => (
                  <span key={j} style={s.tag}>{sk}</span>
                ))}
              </div>
            )}
            <div style={s.viewBtn}>
              View &#8594;
            </div>
          </div>
        ))}
      </div>

      {/* Browse link */}
      {data.total_matching > 0 && (
        <a
          href={`/marketplace?seniority=${encodeURIComponent(data.source_seniority)}`}
          style={s.browseLink}
        >
          Browse {data.total_matching} candidates &#8594;
        </a>
      )}
    </div>
  );
}
