import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getCandidates } from '../lib/seedData'
import { CANDIDATES as MOCK_CANDIDATES } from '../data/discoveryOptions'
import { COPY } from '../lib/copy'
import { useViewMode } from '../context/ViewModeContext'
import CandidateCard from '../components/CandidateCard'
import RightInsightsPanel from '../components/marketplace/RightInsightsPanel'
import EmptyState from '../components/shared/EmptyState'
import ErrorBanner from '../components/shared/ErrorBanner'
import SkeletonCard from '../components/shared/SkeletonCard'
import './Marketplace.css'

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

  const [allCandidates, setAllCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

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

  const filtered = useMemo(() => allCandidates, [allCandidates])

  function switchView(mode) {
    if (mode === viewMode) return
    setTransitioning(true)
    setTimeout(() => { setViewMode(mode); setTimeout(() => setTransitioning(false), 20) }, 150)
  }

  const visibleModes = isMobile ? VIEW_MODES.filter(m => MOBILE_MODES.includes(m.key)) : VIEW_MODES
  const candidateCountText = COPY.marketplace.candidateCount(filtered.length)

  return (
    <div className="mk-page">
      {/* ── Page header ── */}
      <header className="mk-header">
        <div className="mk-header-left">
          <h2 className="mk-heading">
            {COPY.marketplace.headingStart}
            <span className="mk-heading-italic">{COPY.marketplace.headingItalic}</span>
            {COPY.marketplace.headingEnd}
          </h2>
          <p className="mk-subtitle">{COPY.marketplace.subtitle}</p>
        </div>
        <div className="mk-header-right">
          <button className="mk-filter-btn">
            <span className="material-symbols-outlined">filter_list</span>
            {COPY.marketplace.filterBtn}
          </button>
          <button className="mk-new-search-btn">
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
        {/* Left: candidate list */}
        <div className={`mk-left ${transitioning ? 'mk-left--transitioning' : ''}`}>
          {loading && <SkeletonCard count={3} />}

          {!loading && error && <ErrorBanner message={error} onRetry={() => { setError(null); setLoading(true); try { const s = getCandidates(); setAllCandidates((s && s.length > 0) ? s.map(mapDbCandidate) : MOCK_CANDIDATES.map(mapDbCandidate)) } catch (e) { setError(e.message) } finally { setLoading(false) } }} />}

          {!loading && !error && filtered.length === 0 && (
            <EmptyState icon="search_off" message={COPY.emptyStates.marketplace} ctaLabel={COPY.emptyStates.marketplaceCta} onCta={() => navigate('/marketplace')} />
          )}

          {!loading && !error && filtered.length > 0 && (
            <>
              {viewMode === 'stack' && (
                <div className="mk-grid-stack">{filtered.map((c, i) => <CandidateCard key={c.id} candidate={c} viewMode="stack" index={i} />)}</div>
              )}
              {viewMode === 'carousel' && <CarouselView candidates={filtered} />}
              {viewMode === 'matrix' && (
                <div className="mk-grid-matrix">{filtered.map((c, i) => <CandidateCard key={c.id} candidate={c} viewMode="matrix" index={i} />)}</div>
              )}
              {viewMode === 'tinder' && <TinderView candidates={filtered} />}
              {viewMode === 'compact' && (
                <div className="mk-compact-list">{filtered.map((c, i) => <CandidateCard key={c.id} candidate={c} viewMode="compact" index={i} />)}</div>
              )}
              {viewMode === 'focus' && <FocusView candidates={filtered} />}
            </>
          )}
        </div>

        {/* Right: insights panel */}
        <div className="mk-right">
          <RightInsightsPanel />
        </div>
      </div>
    </div>
  )
}
