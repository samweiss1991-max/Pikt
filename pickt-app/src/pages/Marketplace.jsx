import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCandidates } from '../lib/seedData'
import { CANDIDATES as MOCK_CANDIDATES } from '../data/discoveryOptions'
import { COPY } from '../lib/copy'
import { useViewMode } from '../context/ViewModeContext'
import { useSearch } from '../context/SearchContext'
import { addToShortlist } from '../lib/shortlist'
import CandidateCard from '../components/CandidateCard'
import GhostCandidateCard from '../components/GhostCandidateCard'
import RightInsightsPanel from '../components/marketplace/RightInsightsPanel'
import EmptyState from '../components/shared/EmptyState'
import ErrorBanner from '../components/shared/ErrorBanner'
import SkeletonCard from '../components/shared/SkeletonCard'
import { useScrollReveal, useStaggerReveal } from '../hooks/useScrollReveal'
import { computeCategoryCounts } from '../lib/roleCategories'
import './Marketplace.css'

const GHOST_DELAYS = [0, 0.15, 0.3, 0.1, 0.25, 0.4]

const CATEGORY_CHIPS = [
  { key: 'Engineering', icon: '\uD83D\uDCBB' },
  { key: 'Sales', icon: '\uD83D\uDCC8' },
  { key: 'Product', icon: '\uD83C\uDFA8' },
  { key: 'Data', icon: '\uD83D\uDCCA' },
  { key: 'Operations', icon: '\u2699\uFE0F' },
  { key: 'Finance', icon: '\uD83D\uDCB3' },
  { key: 'Final round', icon: '\uD83C\uDFC6' },
  { key: 'Remote', icon: '\uD83C\uDF0F' },
]

const DEFAULT_ROLES = [
  'Account Executive', 'Backend Engineer', 'Customer Success Manager',
  'Data Analyst', 'DevOps Engineer', 'Frontend Engineer',
  'Head of Product', 'Head of Sales', 'ML / AI Engineer',
  'Product Manager', 'Solutions Architect', 'UX / UI Designer',
]

const EXPANDED_ROLES = [
  'Analytics Engineer', 'Brand Manager', 'CFO / Finance Director',
  'Compliance Manager', 'Content / SEO', 'Data Engineer',
  'Data Scientist', 'Growth Marketer', 'Head of CS',
  'Head of Data', 'SDR / BDR', 'Talent Acquisition',
]

const VIEW_MODES = [
  { key: 'stack', label: COPY.viewModes.stack, icon: 'view_agenda' },
  { key: 'carousel', label: COPY.viewModes.carousel, icon: 'view_carousel' },
  { key: 'matrix', label: COPY.viewModes.matrix, icon: 'grid_view' },
  { key: 'tinder', label: COPY.viewModes.fickt, icon: 'swipe' },
  { key: 'compact', label: COPY.viewModes.compact, icon: 'density_small' },
  { key: 'focus', label: COPY.viewModes.focus, icon: 'center_focus_strong' },
]

const MOBILE_MODES = ['stack', 'tinder', 'compact']

function mapDbCandidate(c) {
  return {
    id: c.id,
    role: c.role_applied_for || c.role,
    seniority: c.seniority_level || c.seniority,
    city: c.location_city || c.city,
    company: c.current_employer || c.referring_company || c.company || 'Unknown',
    referringCompany: c.referring_company || c.referringCompany || c.company || 'Unknown',
    skills: c.skills || [],
    interviews: c.interviews_completed ?? c.interviews ?? 0,
    interview_stage_reached: c.interview_stage_reached || c.stage || 'Technical screen',
    fee: c.fee_percentage ?? c.fee ?? 8,
    salaryLow: c.salary_expectation_min ?? c.salaryLow ?? 0,
    salaryHigh: c.salary_expectation_max ?? c.salaryHigh ?? 0,
    years: c.years_experience ?? c.years ?? 0,
    daysAgo: c.referred_at ? Math.floor((Date.now() - new Date(c.referred_at).getTime()) / 86400000) : (c.daysAgo ?? 5),
    strengths: c.strengths,
    gaps: c.gaps,
    feedback_summary: c.feedback_summary,
    recommendation: c.recommendation,
    industry: c.industry,
    status: c.status || 'available',
    preferred_work_type: c.preferred_work_type || 'Hybrid',
  }
}

// ── Tinder stack ──
function TinderView({ candidates, onSave, onSkip }) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const cardRef = useRef(null)
  const remaining = candidates.length - currentIdx

  function handlePointerDown(e) { startX.current = e.clientX; setDragging(true); cardRef.current?.setPointerCapture(e.pointerId) }
  function handlePointerMove(e) { if (dragging) setDragX(e.clientX - startX.current) }
  function handlePointerUp() {
    if (!dragging) return
    setDragging(false)
    if (dragX > 80) doSave()
    else if (dragX < -80) doSkip()
    setDragX(0)
  }
  function doSave() { if (currentIdx < candidates.length) { onSave?.(candidates[currentIdx]); setCurrentIdx(i => i + 1) } }
  function doSkip() { if (currentIdx < candidates.length) { onSkip?.(candidates[currentIdx]); setCurrentIdx(i => i + 1) } }

  if (remaining <= 0) return <EmptyState message="You've reviewed all candidates" />

  return (
    <div className="mk-tinder-wrap">
      <div className="mk-tinder-counter">{remaining} candidates remaining</div>
      <div className="mk-tinder-stack">
        {[2, 1, 0].map(offset => {
          const idx = currentIdx + offset
          if (idx >= candidates.length) return null
          const isFront = offset === 0
          const style = isFront
            ? { transform: `translateX(${dragX}px) rotate(${dragX * 0.1}deg)`, zIndex: 3 }
            : { transform: `scale(${1 - offset * 0.03}) translateY(${offset * 6}px)`, zIndex: 3 - offset, pointerEvents: 'none' }
          return (
            <div key={candidates[idx].id} ref={isFront ? cardRef : undefined} className="mk-tinder-card" style={style}
              onPointerDown={isFront ? handlePointerDown : undefined} onPointerMove={isFront ? handlePointerMove : undefined} onPointerUp={isFront ? handlePointerUp : undefined}>
              {isFront && dragging && <>
                <div className="mk-tinder-hint mk-tinder-hint--save" style={{ opacity: Math.max(0, dragX / 150) }}>SAVE {'\u2713'}</div>
                <div className="mk-tinder-hint mk-tinder-hint--skip" style={{ opacity: Math.max(0, -dragX / 150) }}>SKIP {'\u2717'}</div>
              </>}
              <CandidateCard candidate={candidates[idx]} viewMode="tinder" index={idx} />
            </div>
          )
        })}
      </div>
      <div className="mk-tinder-actions">
        <button className="mk-tinder-btn mk-tinder-btn--skip" onClick={doSkip}>{'\u2717'}</button>
        <button className="mk-tinder-btn mk-tinder-btn--save" onClick={doSave}>{'\u2713'}</button>
      </div>
    </div>
  )
}

// ── Carousel ──
function CarouselView({ candidates }) {
  const [current, setCurrent] = useState(0)
  const total = candidates.length
  const prev = useCallback(() => setCurrent(i => (i - 1 + total) % total), [total])
  const next = useCallback(() => setCurrent(i => (i + 1) % total), [total])

  useEffect(() => {
    const h = e => { if (e.key === 'ArrowLeft') prev(); if (e.key === 'ArrowRight') next() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [prev, next])

  const startXRef = useRef(0)
  if (total === 0) return null
  return (
    <div className="mk-carousel" onPointerDown={e => { startXRef.current = e.clientX }} onPointerUp={e => { const d = e.clientX - startXRef.current; if (d > 60) prev(); else if (d < -60) next() }}>
      <button className="mk-carousel-arrow mk-carousel-arrow--left" onClick={prev}>{'\u2039'}</button>
      <CandidateCard candidate={candidates[current]} viewMode="carousel" index={current} />
      <button className="mk-carousel-arrow mk-carousel-arrow--right" onClick={next}>{'\u203A'}</button>
      <div className="mk-carousel-dots">{candidates.map((_, i) => <span key={i} className={`mk-carousel-dot ${i === current ? 'mk-carousel-dot--active' : ''}`} onClick={() => setCurrent(i)} />)}</div>
    </div>
  )
}

// ── Focus ──
function FocusView({ candidates }) {
  const [current, setCurrent] = useState(0)
  const total = candidates.length
  const prev = useCallback(() => setCurrent(i => (i - 1 + total) % total), [total])
  const next = useCallback(() => setCurrent(i => (i + 1) % total), [total])

  useEffect(() => {
    const h = e => { if (e.key === 'ArrowLeft') prev(); if (e.key === 'ArrowRight') next() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [prev, next])

  if (total === 0) return null
  return (
    <div className="mk-focus">
      <div className="mk-focus-counter">Candidate {current + 1} of {total}</div>
      <button className="mk-focus-arrow mk-focus-arrow--left" onClick={prev}>{'\u2039'}</button>
      <CandidateCard candidate={candidates[current]} viewMode="focus" index={current} />
      <button className="mk-focus-arrow mk-focus-arrow--right" onClick={next}>{'\u203A'}</button>
    </div>
  )
}

// ══ MAIN ══
export default function Marketplace() {
  const navigate = useNavigate()
  const { viewMode, setViewMode } = useViewMode()
  const { query: searchQuery } = useSearch()

  const [allCandidates, setAllCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // ── Discovery / tray state ──
  const [activeCategories, setActiveCategories] = useState([])
  const [activeRole, setActiveRole] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [categoryCounts, setCategoryCounts] = useState({})
  const [ghostBlur, setGhostBlur] = useState(4)
  const [ghostOpacity, setGhostOpacity] = useState(0.6)
  const [discoveryConfirmed, setDiscoveryConfirmed] = useState(false)
  const [trayDismissing, setTrayDismissing] = useState(false)
  const [showAllRoles, setShowAllRoles] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (isMobile && !MOBILE_MODES.includes(viewMode)) setViewMode('stack')
  }, [isMobile, viewMode, setViewMode])

  useEffect(() => {
    setLoading(true); setError(null)
    try {
      const stored = getCandidates()
      setAllCandidates((stored && stored.length > 0) ? stored.map(mapDbCandidate) : MOCK_CANDIDATES.map(mapDbCandidate))
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  // Compute category counts from loaded candidates
  useEffect(() => {
    if (allCandidates.length === 0) return
    const { totalCount: t, categoryCounts: c } = computeCategoryCounts(allCandidates)
    setTotalCount(t)
    setCategoryCounts(c)
  }, [allCandidates])

  // Ghost blur/opacity reacts to filter state
  useEffect(() => {
    if (activeCategories.length > 0) {
      setGhostBlur(0); setGhostOpacity(1)
    } else if (activeRole !== null) {
      setGhostBlur(1); setGhostOpacity(0.85)
    } else {
      setGhostBlur(4); setGhostOpacity(0.6)
    }
  }, [activeCategories, activeRole])

  const displayCount = useMemo(() => {
    if (activeCategories.length > 0) {
      return activeCategories.reduce((sum, cat) => sum + (categoryCounts[cat] || 0), 0)
    }
    return totalCount
  }, [activeCategories, categoryCounts, totalCount])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return allCandidates
    const q = searchQuery.toLowerCase()
    return allCandidates.filter(c =>
      c.role.toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q) ||
      (c.skills || []).some(s => s.toLowerCase().includes(q)) ||
      (c.seniority || '').toLowerCase().includes(q)
    )
  }, [allCandidates, searchQuery])

  function switchView(mode) {
    if (mode === viewMode) return
    setTransitioning(true)
    setTimeout(() => { setViewMode(mode); setTimeout(() => setTransitioning(false), 20) }, 150)
  }

  const visibleModes = isMobile ? VIEW_MODES.filter(m => MOBILE_MODES.includes(m.key)) : VIEW_MODES
  const candidateCountText = COPY.marketplace.candidateCount(filtered.length)

  const headerRef = useScrollReveal()
  const cardsRef = useStaggerReveal({ staggerMs: 100 })

  return (
    <div className="mk-page" style={{ position: 'relative', minHeight: 'calc(100vh - 4rem)' }}>
      {/* ── Page header ── */}
      <header className="mk-header reveal-fade-up" ref={headerRef} data-parallax-speed="0.08">
        <div className="mk-header-left">
          <h2 className="mk-heading text-reveal">
            <span className="text-reveal-word" style={{ animationDelay: '100ms' }}>{COPY.marketplace.headingStart}</span>
            <span className="text-reveal-word mk-heading-italic" style={{ animationDelay: '220ms' }}>{COPY.marketplace.headingItalic}</span>
            <span className="text-reveal-word" style={{ animationDelay: '340ms' }}>{COPY.marketplace.headingEnd}</span>
          </h2>
          <p className="mk-subtitle text-reveal-word" style={{ animationDelay: '460ms' }}>{COPY.marketplace.subtitle}</p>
        </div>
        <div className="mk-header-right">
          <button className="mk-filter-btn press-scale">
            <span className="material-symbols-outlined">filter_list</span>
            {COPY.marketplace.filterBtn}
          </button>
          <button className="mk-new-search-btn press-scale">
            <span className="material-symbols-outlined">add</span>
            {COPY.marketplace.newSearchBtn}
          </button>
        </div>
      </header>

      {/* ── Candidate count ── */}
      <p className="mk-candidate-count">{candidateCountText}</p>

      {/* ── View switcher ── */}
      <div className="mk-view-switcher">
        {visibleModes.map(m => (
          <button key={m.key} className={`mk-view-btn ${viewMode === m.key ? 'mk-view-btn--active' : ''}`} onClick={() => switchView(m.key)}>
            <span className="material-symbols-outlined mk-view-icon">{m.icon}</span>
            <span className="mk-view-label">{m.label}</span>
          </button>
        ))}
      </div>

      {/* ── Bento grid ── */}
      <div className="mk-bento">
        {/* Left: candidate list OR ghost grid */}
        <div className={`mk-left ${transitioning ? 'mk-left--transitioning' : ''}`}>
          {!discoveryConfirmed ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, padding: '20px 0 160px' }}>
              {GHOST_DELAYS.map((delay, i) => (
                <GhostCandidateCard key={i} animationDelay={delay} blur={ghostBlur} opacity={ghostOpacity} />
              ))}
            </div>
          ) : (
            <>
              {loading && <SkeletonCard count={3} />}

              {!loading && error && <ErrorBanner message={error} onRetry={() => { setError(null); setLoading(true); try { const s = getCandidates(); setAllCandidates((s && s.length > 0) ? s.map(mapDbCandidate) : MOCK_CANDIDATES.map(mapDbCandidate)) } catch (e) { setError(e.message) } finally { setLoading(false) } }} />}

              {!loading && !error && filtered.length === 0 && (
                <EmptyState icon="search_off" message={COPY.emptyStates.marketplace} ctaLabel={COPY.emptyStates.marketplaceCta} onCta={() => navigate('/marketplace')} />
              )}

              {!loading && !error && filtered.length > 0 && (
                <>
                  {viewMode === 'stack' && (
                    <div className="mk-grid-stack" ref={cardsRef}>{filtered.map((c, i) => <div key={c.id} data-reveal><CandidateCard candidate={c} viewMode="stack" index={i} /></div>)}</div>
                  )}
                  {viewMode === 'carousel' && <CarouselView candidates={filtered} />}
                  {viewMode === 'matrix' && (
                    <div className="mk-grid-matrix" ref={cardsRef}>{filtered.map((c, i) => <div key={c.id} data-reveal><CandidateCard candidate={c} viewMode="matrix" index={i} /></div>)}</div>
                  )}
                  {viewMode === 'tinder' && <TinderView candidates={filtered} onSave={c => addToShortlist(c.id)} />}
                  {viewMode === 'compact' && (
                    <div className="mk-compact-list">{filtered.map((c, i) => <CandidateCard key={c.id} candidate={c} viewMode="compact" index={i} />)}</div>
                  )}
                  {viewMode === 'focus' && <FocusView candidates={filtered} />}
                </>
              )}
            </>
          )}
        </div>

        {/* Right: insights panel */}
        <div className="mk-right">
          <RightInsightsPanel />
        </div>
      </div>

      {/* ── Discovery tray (floating card, visible until confirmed) ── */}
      {!discoveryConfirmed && (
        <div style={{
          position: 'fixed', bottom: 24, left: 0, right: 0, zIndex: 50,
          pointerEvents: 'none',
          opacity: trayDismissing ? 0 : 1,
          transform: trayDismissing ? 'translateY(12px)' : 'translateY(0)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}>
          {/* Floating tray card */}
          <div style={{
            pointerEvents: 'auto',
            maxWidth: 780,
            width: 'calc(100% - 48px)',
            margin: '0 auto',
            background: 'var(--surface-container-lowest, #ffffff)',
            border: '1px solid var(--outline-variant, #e8e4d9)',
            borderRadius: 20,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            padding: '16px 24px 20px',
          }}>
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--on-surface)', lineHeight: 1.2, margin: 0 }}>
                    Find the right{' '}
                    <span style={{ color: 'var(--primary)', fontStyle: 'italic' }}>candidate</span>
                  </h3>
                  <p style={{ marginTop: 4, marginBottom: 0, fontSize: 12, fontWeight: 400, color: 'var(--on-surface-variant)' }}>
                    Filter by category or pick a specific role below
                  </p>
                </div>
                <div style={{ flexShrink: 0, marginTop: 2, background: 'var(--tertiary-container)', color: 'var(--primary)', borderRadius: 99, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                  {totalCount > 0 ? (
                    <>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)' }} />
                      {displayCount} candidates ready
                    </>
                  ) : ('Loading\u2026')}
                </div>
              </div>

              {/* Category chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORY_CHIPS.map(({ key, icon }) => {
                  const active = activeCategories.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveCategories(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key])}
                      style={{
                        padding: '7px 14px', borderRadius: 10,
                        border: `1px solid ${active ? 'var(--primary)' : 'var(--outline-variant)'}`,
                        background: active ? 'var(--tertiary-container)' : 'var(--surface-container-low)',
                        fontSize: 12, fontWeight: 600,
                        color: active ? 'var(--primary)' : 'var(--on-surface-variant)',
                        cursor: 'pointer', transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', gap: 7,
                      }}
                    >
                      <span>{icon}</span>
                      {key}
                      <span style={{ fontSize: 10, fontWeight: 700, background: active ? 'var(--primary)' : 'var(--tertiary-container)', color: active ? '#ffffff' : 'var(--primary)', padding: '1px 5px', borderRadius: 99 }}>
                        {categoryCounts[key] || 0}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--outline-variant)', margin: '14px 0 12px' }} />

              {/* Role chips section */}
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--on-surface-variant)', marginBottom: 10, marginTop: 0 }}>
                Or pick a specific role
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
                {(showAllRoles ? [...DEFAULT_ROLES, ...EXPANDED_ROLES] : DEFAULT_ROLES).map(r => {
                  const active = activeRole === r
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        if (activeRole === r) { setActiveRole(null) }
                        else { setActiveRole(r); setActiveCategories([]) }
                      }}
                      style={{
                        padding: '6px 14px', borderRadius: 8,
                        border: `1.5px solid ${active ? 'var(--primary)' : 'var(--outline-variant)'}`,
                        background: active ? 'var(--tertiary-container)' : 'var(--surface-container-low)',
                        fontSize: 12, fontWeight: 600,
                        color: active ? 'var(--primary)' : 'var(--on-surface-variant)',
                        cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.15s',
                      }}
                    >
                      {r}
                    </button>
                  )
                })}
              </div>

              {/* Show all toggle + confirm button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowAllRoles(v => !v)}
                  style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
                >
                  {showAllRoles ? 'Show less \u2191' : 'See all roles \u2192'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTrayDismissing(true)
                    setTimeout(() => { setDiscoveryConfirmed(true); setTrayDismissing(false) }, 200)
                  }}
                  style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(45,114,53,0.25)' }}
                >
                  Show me candidates &rarr;
                </button>
              </div>
          </div>
        </div>
      )}

      {/* Reset to discovery button (only after confirmed) */}
      {discoveryConfirmed && (
        <button
          type="button"
          onClick={() => setDiscoveryConfirmed(false)}
          style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 50, background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        >
          ↺ Back to discovery
        </button>
      )}
    </div>
  )
}
