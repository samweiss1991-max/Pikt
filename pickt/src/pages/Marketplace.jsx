import { useCallback, useEffect, useRef, useState } from "react";
import CandidateTile from "../components/marketplace/CandidateTile.jsx";

/**
 * Marketplace — server-side search + filtering.
 * Light theme: var(--bg) background, white cards.
 */

// ── Quick filter chip definitions ───────────────────────────

const QUICK_FILTERS = [
  { id: "all", label: "All" },
  { id: "engineering", label: "Engineering", param: { q: "engineer developer" } },
  { id: "design", label: "Design", param: { q: "design ux ui" } },
  { id: "data", label: "Data", param: { q: "data analytics ml" } },
  { id: "product", label: "Product", param: { q: "product manager owner" } },
  { id: "senior", label: "Senior+", param: { seniority: ["Senior", "Staff/Lead", "Principal", "Director+"] } },
  { id: "remote", label: "Remote", param: { q: "remote" } },
  { id: "final", label: "Final round \u2713", param: { interview_stage: "Final round" } },
];

const SENIORITY_OPTIONS = ["Junior", "Mid-level", "Senior", "Staff/Lead", "Principal", "Director+", "Manager"];
const LISTED_WITHIN_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 14 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

// ── Styles ──────────────────────────────────────────────────

const shimmerKeyframes = `
@keyframes tile-shimmer {
  0% { background-position: -300px 0; }
  100% { background-position: 300px 0; }
}
`;

const s = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    padding: "24px 32px",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: 13,
    color: "var(--text)",
  },
  container: { maxWidth: 1000, margin: "0 auto" },

  // Search bar
  searchWrap: {
    position: "relative",
    marginBottom: 16,
  },
  searchInput: {
    width: "100%",
    height: 42,
    padding: "0 40px 0 40px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 14,
    outline: "none",
  },
  searchIcon: {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    color: "var(--muted)",
    pointerEvents: "none",
  },
  searchClear: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "none",
    color: "var(--muted)",
    fontSize: 18,
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: 1,
  },
  searchSpinner: {
    position: "absolute",
    right: 14,
    top: "50%",
    transform: "translateY(-50%)",
    width: 16,
    height: 16,
    border: "2px solid var(--border)",
    borderTop: "2px solid var(--accent)",
    borderRadius: "50%",
    animation: "tile-shimmer 0.8s linear infinite",
  },

  // Quick filters
  chipRow: {
    display: "flex",
    gap: 6,
    marginBottom: 16,
    overflowX: "auto",
    paddingBottom: 4,
  },
  chip: (active) => ({
    padding: "6px 16px",
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 500,
    border: active ? "1px solid var(--accent-border)" : "1px solid var(--border)",
    background: active ? "var(--accent-dim)" : "var(--surface)",
    color: active ? "var(--accent)" : "var(--muted)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  }),

  // Results header
  resultsHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 8,
  },
  resultCount: { fontSize: 13, color: "var(--text2)" },
  activeFilters: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    alignItems: "center",
  },
  filterChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 10px",
    borderRadius: 99,
    fontSize: 11,
    background: "var(--accent-dim)",
    border: "1px solid var(--accent-border)",
    color: "var(--accent)",
  },
  filterChipX: {
    border: "none",
    background: "none",
    color: "var(--accent)",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  },
  filterToggle: {
    padding: "6px 16px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text2)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
  },

  // Grid
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  gridSingle: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 14,
  },

  // Skeleton
  skeleton: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
    minHeight: 180,
  },
  shimmerBar: (w) => ({
    width: w,
    height: 14,
    borderRadius: 6,
    background: "linear-gradient(90deg, var(--surface2) 25%, var(--surface) 50%, var(--surface2) 75%)",
    backgroundSize: "600px 100%",
    animation: "tile-shimmer 1.5s ease-in-out infinite",
    marginBottom: 10,
  }),

  // Sidebar
  sidebar: (open) => ({
    position: "fixed",
    top: 0,
    right: 0,
    width: 280,
    height: "100vh",
    background: "var(--surface)",
    borderLeft: "1px solid var(--border)",
    boxShadow: open ? "-4px 0 24px rgba(0,0,0,.08)" : "none",
    transform: open ? "translateX(0)" : "translateX(100%)",
    transition: "transform 0.2s ease",
    zIndex: 30,
    overflowY: "auto",
    padding: "20px",
  }),
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  sidebarTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--text)",
  },
  sidebarClose: {
    border: "none",
    background: "none",
    fontSize: 20,
    color: "var(--muted)",
    cursor: "pointer",
  },
  sidebarSection: { marginBottom: 20 },
  sidebarLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 8,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 0",
    fontSize: 12,
    color: "var(--text2)",
    cursor: "pointer",
  },
  checkboxInput: {
    width: 14,
    height: 14,
    accentColor: "var(--accent)",
  },
  sidebarInput: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface2)",
    color: "var(--text)",
    fontSize: 12,
    outline: "none",
  },
  sidebarBtnRow: {
    display: "flex",
    gap: 8,
    marginTop: 20,
  },
  sidebarApply: {
    flex: 1,
    padding: "8px 0",
    borderRadius: 10,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  sidebarClear: {
    flex: 1,
    padding: "8px 0",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--muted)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
  },

  // Pagination
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
  },
  pageBtn: (disabled) => ({
    padding: "8px 18px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: disabled ? "var(--surface2)" : "var(--surface)",
    color: disabled ? "var(--muted)" : "var(--text2)",
    fontSize: 12,
    fontWeight: 500,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
  }),
  pageInfo: { fontSize: 12, color: "var(--muted)" },

  empty: {
    textAlign: "center",
    padding: "48px 20px",
    color: "var(--muted)",
    gridColumn: "1 / -1",
  },
};

// ── Component ───────────────────────────────────────────────

export default function Marketplace() {
  const [query, setQuery] = useState("");
  const [activeChips, setActiveChips] = useState(new Set(["all"]));
  const [candidates, setCandidates] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filtersApplied, setFiltersApplied] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sidebar filter state
  const [seniorityFilter, setSeniorityFilter] = useState([]);
  const [locationFilter, setLocationFilter] = useState("");
  const [skillsFilter, setSkillsFilter] = useState("");
  const [feeMax, setFeeMax] = useState("");
  const [listedWithin, setListedWithin] = useState("");

  const debounceRef = useRef(null);
  const PER_PAGE = 12;

  const fetchCandidates = useCallback(async () => {
    setLoading(true);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", String(PER_PAGE));

    // Search query
    let searchQ = query;

    // Merge quick filter params
    for (const chip of activeChips) {
      if (chip === "all") continue;
      const def = QUICK_FILTERS.find((f) => f.id === chip);
      if (def?.param?.q) searchQ += " " + def.param.q;
      if (def?.param?.seniority) {
        for (const s of def.param.seniority) params.append("seniority", s);
      }
      if (def?.param?.interview_stage) {
        params.set("interview_stage", def.param.interview_stage);
      }
    }

    if (searchQ.trim()) params.set("q", searchQ.trim());

    // Sidebar filters
    for (const s of seniorityFilter) params.append("seniority", s);
    if (locationFilter) params.set("location", locationFilter);
    if (skillsFilter) {
      for (const sk of skillsFilter.split(",").map((s) => s.trim()).filter(Boolean)) {
        params.append("skills", sk);
      }
    }
    if (feeMax) params.set("fee_max", feeMax);
    if (listedWithin) params.set("listed_within_days", listedWithin);

    try {
      const res = await fetch(`/api/candidates/marketplace?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
        setTotal(data.total || 0);
        setFiltersApplied(data.filters_applied || []);
      }
    } finally {
      setLoading(false);
    }
  }, [page, query, activeChips, seniorityFilter, locationFilter, skillsFilter, feeMax, listedWithin]);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchCandidates();
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, activeChips, seniorityFilter, locationFilter, skillsFilter, feeMax, listedWithin]);

  // Non-debounced page change
  useEffect(() => {
    fetchCandidates();
  }, [page]);

  function toggleChip(chipId) {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (chipId === "all") {
        return new Set(["all"]);
      }
      next.delete("all");
      if (next.has(chipId)) {
        next.delete(chipId);
        if (next.size === 0) next.add("all");
      } else {
        next.add(chipId);
      }
      return next;
    });
    setPage(1);
  }

  function removeFilter(filter) {
    // Parse and remove the specific filter
    if (filter.startsWith("search:")) setQuery("");
    if (filter.startsWith("seniority:")) setSeniorityFilter([]);
    if (filter.startsWith("location:")) setLocationFilter("");
    if (filter.startsWith("skills:")) setSkillsFilter("");
    if (filter.startsWith("fee")) setFeeMax("");
    if (filter.startsWith("within")) setListedWithin("");
    setPage(1);
  }

  function clearAllFilters() {
    setQuery("");
    setActiveChips(new Set(["all"]));
    setSeniorityFilter([]);
    setLocationFilter("");
    setSkillsFilter("");
    setFeeMax("");
    setListedWithin("");
    setPage(1);
  }

  function applySidebar() {
    setSidebarOpen(false);
    setPage(1);
  }

  const totalPages = Math.ceil(total / PER_PAGE);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <>
      <style>{shimmerKeyframes}</style>
      <div style={s.page}>
        <div style={s.container}>
          {/* Search bar */}
          <div style={s.searchWrap}>
            <div style={s.searchIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search roles, skills, locations…"
              style={{
                ...s.searchInput,
                borderColor: query ? "var(--accent)" : "var(--border)",
              }}
            />
            {loading && query && <div style={s.searchSpinner} />}
            {query && !loading && (
              <button type="button" style={s.searchClear} onClick={() => setQuery("")}>
                &#10005;
              </button>
            )}
          </div>

          {/* Quick filter chips */}
          <div style={s.chipRow}>
            {QUICK_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                style={s.chip(activeChips.has(f.id))}
                onClick={() => toggleChip(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Results header */}
          <div style={s.resultsHeader}>
            <div style={s.resultCount}>
              Showing <strong>{candidates.length}</strong> of <strong>{total}</strong> candidates
              {filtersApplied.length > 0 && (
                <span style={s.activeFilters}>
                  {" · "}
                  {filtersApplied.map((f, i) => (
                    <span key={i} style={s.filterChip}>
                      {f}
                      <button type="button" style={s.filterChipX} onClick={() => removeFilter(f)}>
                        &#10005;
                      </button>
                    </span>
                  ))}
                </span>
              )}
            </div>
            <button
              type="button"
              style={s.filterToggle}
              onClick={() => setSidebarOpen(true)}
            >
              Filters
            </button>
          </div>

          {/* Grid */}
          <div style={isMobile ? s.gridSingle : s.grid}>
            {/* Skeleton loading */}
            {loading && candidates.length === 0 && (
              <>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={s.skeleton}>
                    <div style={s.shimmerBar("60%")} />
                    <div style={s.shimmerBar("40%")} />
                    <div style={s.shimmerBar("80%")} />
                    <div style={{ ...s.shimmerBar("50%"), marginTop: 16 }} />
                  </div>
                ))}
              </>
            )}

            {/* Empty state */}
            {!loading && candidates.length === 0 && (
              <div style={s.empty}>
                <div style={{ fontSize: 14, marginBottom: 8 }}>No candidates match your search</div>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  style={{
                    border: "none",
                    background: "none",
                    color: "var(--accent)",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* Candidate tiles */}
            {!loading &&
              candidates.map((c) => (
                <CandidateTile
                  key={c.id}
                  candidate={c}
                  engagement={c.engagement}
                  onClick={() => { window.location.href = `/candidates/${c.id}`; }}
                />
              ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={s.pagination}>
              <button
                type="button"
                style={s.pageBtn(page <= 1)}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span style={s.pageInfo}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                style={s.pageBtn(page >= totalPages)}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* ── Filter sidebar ─────────────────────────────── */}
        <div style={s.sidebar(sidebarOpen)}>
          <div style={s.sidebarHeader}>
            <span style={s.sidebarTitle}>Filters</span>
            <button type="button" style={s.sidebarClose} onClick={() => setSidebarOpen(false)}>
              &#10005;
            </button>
          </div>

          {/* Seniority */}
          <div style={s.sidebarSection}>
            <div style={s.sidebarLabel}>Seniority</div>
            {SENIORITY_OPTIONS.map((level) => (
              <label key={level} style={s.checkboxRow}>
                <input
                  type="checkbox"
                  checked={seniorityFilter.includes(level)}
                  onChange={() => {
                    setSeniorityFilter((prev) =>
                      prev.includes(level)
                        ? prev.filter((s) => s !== level)
                        : [...prev, level]
                    );
                  }}
                  style={s.checkboxInput}
                />
                {level}
              </label>
            ))}
          </div>

          {/* Location */}
          <div style={s.sidebarSection}>
            <div style={s.sidebarLabel}>Location</div>
            <input
              type="text"
              placeholder="City name…"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              style={s.sidebarInput}
            />
          </div>

          {/* Skills */}
          <div style={s.sidebarSection}>
            <div style={s.sidebarLabel}>Skills</div>
            <input
              type="text"
              placeholder="React, Python, SQL…"
              value={skillsFilter}
              onChange={(e) => setSkillsFilter(e.target.value)}
              style={s.sidebarInput}
            />
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
              Comma-separated
            </div>
          </div>

          {/* Fee range */}
          <div style={s.sidebarSection}>
            <div style={s.sidebarLabel}>Max fee (%)</div>
            <input
              type="range"
              min="0"
              max="25"
              value={feeMax || 25}
              onChange={(e) => setFeeMax(e.target.value === "25" ? "" : e.target.value)}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
            <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
              {feeMax ? `≤ ${feeMax}%` : "Any"}
            </div>
          </div>

          {/* Listed within */}
          <div style={s.sidebarSection}>
            <div style={s.sidebarLabel}>Listed within</div>
            {LISTED_WITHIN_OPTIONS.map((opt) => (
              <label key={opt.value} style={s.checkboxRow}>
                <input
                  type="radio"
                  name="listed_within"
                  checked={listedWithin === String(opt.value)}
                  onChange={() => setListedWithin(String(opt.value))}
                  style={s.checkboxInput}
                />
                {opt.label}
              </label>
            ))}
            <label style={s.checkboxRow}>
              <input
                type="radio"
                name="listed_within"
                checked={!listedWithin}
                onChange={() => setListedWithin("")}
                style={s.checkboxInput}
              />
              Any time
            </label>
          </div>

          {/* Actions */}
          <div style={s.sidebarBtnRow}>
            <button type="button" style={s.sidebarClear} onClick={clearAllFilters}>
              Clear all
            </button>
            <button type="button" style={s.sidebarApply} onClick={applySidebar}>
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
